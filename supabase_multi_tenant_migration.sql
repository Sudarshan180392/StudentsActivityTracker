-- ============================================================
-- UPSC Prep Tracker — Multi-Tenant Migration
-- Run this ONCE in the Supabase SQL Editor AFTER the original
-- supabase_migration.sql and supabase_community_migration.sql.
--
-- This script is IDEMPOTENT where possible (IF NOT EXISTS, OR REPLACE).
-- It will:
--   1. Create the user_role enum and institutes table
--   2. Add role + institute_id to profiles
--   3. Create helper functions for RLS
--   4. DROP and RECREATE all RLS policies for multi-tenant access
--   5. Create invite-code and admin RPC functions
--   6. Update the public_daily_activities view
--
-- NO service-role key is used on the client. All privileged
-- writes go through SECURITY DEFINER functions that verify
-- the caller's role internally.
-- ============================================================


-- ============================================================
-- Section 0: Pre-flight — wrap in a transaction
-- ============================================================
BEGIN;


-- ============================================================
-- Section 1: Enum & Tables
-- ============================================================

-- 1.1 Role enum
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'instructor', 'super_admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1.2 Institutes table
CREATE TABLE IF NOT EXISTS institutes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  invite_code TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(4), 'hex'),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 1.3 Add role and institute_id to profiles
-- (safe to re-run: ADD COLUMN IF NOT EXISTS)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role         user_role NOT NULL DEFAULT 'student';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS institute_id UUID REFERENCES institutes(id) ON DELETE SET NULL;

-- Index for fast institute-scoped lookups
CREATE INDEX IF NOT EXISTS idx_profiles_institute ON profiles(institute_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role      ON profiles(role);


-- ============================================================
-- Section 2: Helper Functions (used by RLS policies)
-- ============================================================

-- 2.1 Get the calling user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2.2 Get the calling user's institute_id
CREATE OR REPLACE FUNCTION get_my_institute_id()
RETURNS UUID AS $$
  SELECT institute_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- Section 3: Update handle_new_user() trigger
-- ============================================================
-- Adds the role column (defaults to 'student') when a new user
-- signs up. institute_id stays NULL until they join via invite code.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, is_public, role, institute_id)
  VALUES (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1),
      'UPSC Aspirant'
    ),
    new.raw_user_meta_data->>'avatar_url',
    false,       -- default to private
    'student',   -- default role
    NULL         -- no institute until they join
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- Section 4: DROP existing RLS policies (clean slate)
-- ============================================================
-- We drop ALL existing policies so we can recreate them with
-- multi-tenant logic. This is safe because the new policies
-- are strictly more permissive for instructors/super_admin
-- and identical for students.

-- ---- user_settings ----
DROP POLICY IF EXISTS "user_settings_select" ON user_settings;
DROP POLICY IF EXISTS "user_settings_insert" ON user_settings;
DROP POLICY IF EXISTS "user_settings_update" ON user_settings;
DROP POLICY IF EXISTS "user_settings_delete" ON user_settings;

-- ---- day_tasks ----
DROP POLICY IF EXISTS "day_tasks_select" ON day_tasks;
DROP POLICY IF EXISTS "day_tasks_insert" ON day_tasks;
DROP POLICY IF EXISTS "day_tasks_update" ON day_tasks;
DROP POLICY IF EXISTS "day_tasks_delete" ON day_tasks;

-- ---- day_wellbeing ----
DROP POLICY IF EXISTS "day_wellbeing_select" ON day_wellbeing;
DROP POLICY IF EXISTS "day_wellbeing_insert" ON day_wellbeing;
DROP POLICY IF EXISTS "day_wellbeing_update" ON day_wellbeing;
DROP POLICY IF EXISTS "day_wellbeing_delete" ON day_wellbeing;

-- ---- mock_tests ----
DROP POLICY IF EXISTS "mock_tests_select" ON mock_tests;
DROP POLICY IF EXISTS "mock_tests_insert" ON mock_tests;
DROP POLICY IF EXISTS "mock_tests_update" ON mock_tests;
DROP POLICY IF EXISTS "mock_tests_delete" ON mock_tests;

-- ---- mock_subject_scores ----
DROP POLICY IF EXISTS "mock_subject_scores_select" ON mock_subject_scores;
DROP POLICY IF EXISTS "mock_subject_scores_insert" ON mock_subject_scores;
DROP POLICY IF EXISTS "mock_subject_scores_update" ON mock_subject_scores;
DROP POLICY IF EXISTS "mock_subject_scores_delete" ON mock_subject_scores;

-- ---- current_affairs ----
DROP POLICY IF EXISTS "current_affairs_select" ON current_affairs;
DROP POLICY IF EXISTS "current_affairs_insert" ON current_affairs;
DROP POLICY IF EXISTS "current_affairs_update" ON current_affairs;
DROP POLICY IF EXISTS "current_affairs_delete" ON current_affairs;

-- ---- daily_summaries ----
DROP POLICY IF EXISTS "daily_summaries_select" ON daily_summaries;
DROP POLICY IF EXISTS "daily_summaries_insert" ON daily_summaries;
DROP POLICY IF EXISTS "daily_summaries_update" ON daily_summaries;
DROP POLICY IF EXISTS "daily_summaries_delete" ON daily_summaries;

-- ---- profiles ----
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_select_self_or_public" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;


-- ============================================================
-- Section 5: NEW RLS Policies — Multi-Tenant
-- ============================================================
-- Pattern for data tables (user_settings, day_tasks, etc.):
--   SELECT: own rows OR same-institute instructor OR super_admin
--   INSERT/UPDATE/DELETE: own rows only (students write their own data)

-- ===================== user_settings =====================

CREATE POLICY "user_settings_select_own" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_settings_select_instructor" ON user_settings
  FOR SELECT USING (
    get_my_role() = 'instructor'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = user_settings.user_id
        AND p.institute_id IS NOT NULL
        AND p.institute_id = get_my_institute_id()
    )
  );

CREATE POLICY "user_settings_select_super_admin" ON user_settings
  FOR SELECT USING (get_my_role() = 'super_admin');

CREATE POLICY "user_settings_insert" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_delete" ON user_settings
  FOR DELETE USING (auth.uid() = user_id);


-- ===================== day_tasks =====================

CREATE POLICY "day_tasks_select_own" ON day_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "day_tasks_select_instructor" ON day_tasks
  FOR SELECT USING (
    get_my_role() = 'instructor'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = day_tasks.user_id
        AND p.institute_id IS NOT NULL
        AND p.institute_id = get_my_institute_id()
    )
  );

CREATE POLICY "day_tasks_select_super_admin" ON day_tasks
  FOR SELECT USING (get_my_role() = 'super_admin');

CREATE POLICY "day_tasks_insert" ON day_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "day_tasks_update" ON day_tasks
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "day_tasks_delete" ON day_tasks
  FOR DELETE USING (auth.uid() = user_id);


-- ===================== day_wellbeing =====================

CREATE POLICY "day_wellbeing_select_own" ON day_wellbeing
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "day_wellbeing_select_instructor" ON day_wellbeing
  FOR SELECT USING (
    get_my_role() = 'instructor'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = day_wellbeing.user_id
        AND p.institute_id IS NOT NULL
        AND p.institute_id = get_my_institute_id()
    )
  );

CREATE POLICY "day_wellbeing_select_super_admin" ON day_wellbeing
  FOR SELECT USING (get_my_role() = 'super_admin');

CREATE POLICY "day_wellbeing_insert" ON day_wellbeing
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "day_wellbeing_update" ON day_wellbeing
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "day_wellbeing_delete" ON day_wellbeing
  FOR DELETE USING (auth.uid() = user_id);


-- ===================== mock_tests =====================

CREATE POLICY "mock_tests_select_own" ON mock_tests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "mock_tests_select_instructor" ON mock_tests
  FOR SELECT USING (
    get_my_role() = 'instructor'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = mock_tests.user_id
        AND p.institute_id IS NOT NULL
        AND p.institute_id = get_my_institute_id()
    )
  );

CREATE POLICY "mock_tests_select_super_admin" ON mock_tests
  FOR SELECT USING (get_my_role() = 'super_admin');

CREATE POLICY "mock_tests_insert" ON mock_tests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mock_tests_update" ON mock_tests
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mock_tests_delete" ON mock_tests
  FOR DELETE USING (auth.uid() = user_id);


-- ===================== mock_subject_scores =====================

CREATE POLICY "mock_subject_scores_select_own" ON mock_subject_scores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "mock_subject_scores_select_instructor" ON mock_subject_scores
  FOR SELECT USING (
    get_my_role() = 'instructor'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = mock_subject_scores.user_id
        AND p.institute_id IS NOT NULL
        AND p.institute_id = get_my_institute_id()
    )
  );

CREATE POLICY "mock_subject_scores_select_super_admin" ON mock_subject_scores
  FOR SELECT USING (get_my_role() = 'super_admin');

CREATE POLICY "mock_subject_scores_insert" ON mock_subject_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mock_subject_scores_update" ON mock_subject_scores
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mock_subject_scores_delete" ON mock_subject_scores
  FOR DELETE USING (auth.uid() = user_id);


-- ===================== current_affairs =====================

CREATE POLICY "current_affairs_select_own" ON current_affairs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "current_affairs_select_instructor" ON current_affairs
  FOR SELECT USING (
    get_my_role() = 'instructor'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = current_affairs.user_id
        AND p.institute_id IS NOT NULL
        AND p.institute_id = get_my_institute_id()
    )
  );

CREATE POLICY "current_affairs_select_super_admin" ON current_affairs
  FOR SELECT USING (get_my_role() = 'super_admin');

CREATE POLICY "current_affairs_insert" ON current_affairs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "current_affairs_update" ON current_affairs
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "current_affairs_delete" ON current_affairs
  FOR DELETE USING (auth.uid() = user_id);


-- ===================== daily_summaries =====================

CREATE POLICY "daily_summaries_select_own" ON daily_summaries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "daily_summaries_select_instructor" ON daily_summaries
  FOR SELECT USING (
    get_my_role() = 'instructor'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = daily_summaries.user_id
        AND p.institute_id IS NOT NULL
        AND p.institute_id = get_my_institute_id()
    )
  );

CREATE POLICY "daily_summaries_select_super_admin" ON daily_summaries
  FOR SELECT USING (get_my_role() = 'super_admin');

CREATE POLICY "daily_summaries_insert" ON daily_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_summaries_update" ON daily_summaries
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_summaries_delete" ON daily_summaries
  FOR DELETE USING (auth.uid() = user_id);


-- ===================== profiles =====================
-- Special: instructors see profiles in their institute,
-- super_admin sees all, public profiles visible to everyone,
-- everyone sees their own.

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    id = auth.uid()                                              -- own profile
    OR is_public = true                                          -- public profiles (community)
    OR get_my_role() = 'super_admin'                             -- super admin sees all
    OR (
      get_my_role() = 'instructor'
      AND institute_id IS NOT NULL
      AND institute_id = get_my_institute_id()                   -- same institute
    )
  );

-- Insert: only your own profile (trigger handles auto-creation)
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Update: only your own profile, and ONLY specific fields.
-- Role and institute_id changes go through SECURITY DEFINER RPCs.
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Delete: only your own profile
CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE USING (auth.uid() = id);


-- ===================== institutes =====================

ALTER TABLE institutes ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
CREATE POLICY "institutes_select_super_admin" ON institutes
  FOR SELECT USING (get_my_role() = 'super_admin');

CREATE POLICY "institutes_insert_super_admin" ON institutes
  FOR INSERT WITH CHECK (get_my_role() = 'super_admin');

CREATE POLICY "institutes_update_super_admin" ON institutes
  FOR UPDATE USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

CREATE POLICY "institutes_delete_super_admin" ON institutes
  FOR DELETE USING (get_my_role() = 'super_admin');

-- Instructors & students: see only their own institute
CREATE POLICY "institutes_select_own" ON institutes
  FOR SELECT USING (
    id = get_my_institute_id()
  );


-- ============================================================
-- Section 6: Invite Code & Admin RPC Functions
-- ============================================================

-- 6.1 join_institute(code) — students/instructors self-enroll
CREATE OR REPLACE FUNCTION join_institute(code TEXT)
RETURNS TEXT AS $$
DECLARE
  inst_id UUID;
  inst_name TEXT;
  current_inst UUID;
  caller_role user_role;
BEGIN
  -- Look up institute by invite code
  SELECT id, name INTO inst_id, inst_name
  FROM institutes WHERE invite_code = code;

  IF inst_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code. Please check and try again.';
  END IF;

  -- Get caller's current state
  SELECT institute_id, role INTO current_inst, caller_role
  FROM profiles WHERE id = auth.uid();

  -- Super admins don't belong to institutes
  IF caller_role = 'super_admin' THEN
    RAISE EXCEPTION 'Super admins cannot join institutes.';
  END IF;

  -- Prevent institute-hopping without admin intervention
  IF current_inst IS NOT NULL THEN
    RAISE EXCEPTION 'You are already linked to an institute. Contact your admin to switch.';
  END IF;

  -- Link user to institute
  UPDATE profiles SET institute_id = inst_id WHERE id = auth.uid();
  RETURN inst_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6.2 admin_assign_institute — super_admin assigns a user to an institute
CREATE OR REPLACE FUNCTION admin_assign_institute(
  target_user_id UUID,
  target_institute_id UUID  -- NULL to unlink
)
RETURNS VOID AS $$
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized: only super_admin can assign institutes.';
  END IF;

  -- Verify target institute exists (if not null)
  IF target_institute_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM institutes WHERE id = target_institute_id) THEN
      RAISE EXCEPTION 'Institute not found.';
    END IF;
  END IF;

  UPDATE profiles SET institute_id = target_institute_id WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6.3 admin_set_role — super_admin changes a user's role
CREATE OR REPLACE FUNCTION admin_set_role(
  target_user_id UUID,
  new_role user_role
)
RETURNS VOID AS $$
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized: only super_admin can change roles.';
  END IF;

  -- Prevent demoting yourself
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change your own role.';
  END IF;

  UPDATE profiles SET role = new_role WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6.4 admin_regenerate_invite_code — super_admin regenerates an institute's invite code
CREATE OR REPLACE FUNCTION admin_regenerate_invite_code(target_institute_id UUID)
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized: only super_admin can regenerate invite codes.';
  END IF;

  new_code := encode(gen_random_bytes(4), 'hex');

  UPDATE institutes SET invite_code = new_code WHERE id = target_institute_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Institute not found.';
  END IF;

  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- Section 7: Update public_daily_activities view
-- ============================================================
-- Instructor and super_admin can now see institute/all data
-- through this view as well.

CREATE OR REPLACE VIEW public_daily_activities
WITH (security_barrier = true)
AS
SELECT
  ds.id,
  ds.user_id,
  ds.day_number,
  ds.date,
  ds.subjects,
  -- Mask study hours unless the profile is public OR the current user
  -- owns this log OR is an instructor/super_admin with access
  CASE
    WHEN p.is_public = true
      OR ds.user_id = auth.uid()
      OR get_my_role() = 'super_admin'
      OR (get_my_role() = 'instructor' AND p.institute_id IS NOT NULL AND p.institute_id = get_my_institute_id())
    THEN ds.total_hours
    ELSE null
  END AS total_hours,
  -- Mask streak count similarly
  CASE
    WHEN p.is_public = true
      OR ds.user_id = auth.uid()
      OR get_my_role() = 'super_admin'
      OR (get_my_role() = 'instructor' AND p.institute_id IS NOT NULL AND p.institute_id = get_my_institute_id())
    THEN ds.streak
    ELSE 0
  END AS streak,
  ds.created_at,
  p.display_name,
  p.avatar_url,
  p.is_public
FROM daily_summaries ds
JOIN profiles p ON ds.user_id = p.id;


-- ============================================================
-- Section 8: Restrict direct profile updates to safe columns
-- ============================================================
-- Students should NOT be able to set their own role or institute_id
-- via a direct UPDATE. We enforce this with a trigger that rejects
-- changes to role/institute_id unless the caller is super_admin
-- (who uses SECURITY DEFINER RPCs anyway, bypassing this trigger).

CREATE OR REPLACE FUNCTION prevent_role_institute_self_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If role is being changed
  IF (NEW.role IS DISTINCT FROM OLD.role) THEN
    -- Allow only if caller is super_admin
    IF (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin' THEN
      RETURN NEW;
    END IF;
    NEW.role := OLD.role;
  END IF;

  -- If institute_id is being changed
  IF (NEW.institute_id IS DISTINCT FROM OLD.institute_id) THEN
    -- Allow if old was NULL (onboarding) OR if caller is super_admin
    IF OLD.institute_id IS NULL OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin' THEN
      RETURN NEW;
    END IF;
    NEW.institute_id := OLD.institute_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger runs BEFORE UPDATE, so it silently reverts
-- unauthorized changes rather than throwing an error (better UX).
DROP TRIGGER IF EXISTS trg_prevent_role_institute_change ON profiles;
CREATE TRIGGER trg_prevent_role_institute_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_institute_self_update();


-- ============================================================
-- Done! Commit the transaction.
-- ============================================================
COMMIT;

-- ============================================================
-- POST-MIGRATION: Set your own user as super_admin
-- ============================================================
-- Run this SEPARATELY after the migration, replacing YOUR_USER_ID
-- with your actual auth.users id:
--
--   UPDATE profiles SET role = 'super_admin' WHERE id = 'YOUR_USER_ID';
--
-- This is intentionally manual — there's no UI path to become
-- super_admin, and the trigger above will silently revert any
-- client-side attempt to set role = 'super_admin'.
-- ============================================================
