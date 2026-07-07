-- ============================================================
-- UPSC Prep Tracker — Multi-Tenant Isolation Test Harness
-- ============================================================
-- Run this AFTER supabase_multi_tenant_migration.sql.
--
-- This script creates:
--   • 2 fake institutes (Alpha Academy, Beta Institute)
--   • 4 test users (2 instructors + 2 students, one pair per institute)
--   • Sample data (day_tasks, mock_tests, daily_summaries) for each student
--   • Verification queries that simulate each user's JWT context
--   • A cleanup section at the bottom
--
-- HOW TO USE:
--   1. Run Section 1 (Setup) in full
--   2. Run Section 2 (Verification) one block at a time
--   3. Check that row counts match the expected values in comments
--   4. Run Section 3 (Cleanup) to remove all test data
--
-- IMPORTANT: The test uses SET LOCAL to simulate JWT contexts.
-- Each verification block must run inside its own transaction
-- (BEGIN...COMMIT) for SET LOCAL to work properly. In the
-- Supabase SQL Editor, you can run each block separately.
-- ============================================================


-- ============================================================
-- Section 1: SETUP — Create test institutes, users, and data
-- ============================================================

-- 1.1 Create two test institutes
INSERT INTO institutes (id, name, invite_code) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Alpha Academy', 'ALPHA123'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Beta Institute', 'BETA4567')
ON CONFLICT (id) DO NOTHING;

-- 1.2 Create four test users in auth.users
-- NOTE: These are fake users for testing only. Supabase allows
-- direct inserts into auth.users from the SQL editor.
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, instance_id, aud, role)
VALUES
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'instructor_alpha@test.local',
    crypt('TestPass123!', gen_salt('bf')),
    now(),
    '{"full_name": "Instructor Alpha"}'::jsonb,
    now(), now(),
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'student_alpha@test.local',
    crypt('TestPass123!', gen_salt('bf')),
    now(),
    '{"full_name": "Student Alpha"}'::jsonb,
    now(), now(),
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000003',
    'instructor_beta@test.local',
    crypt('TestPass123!', gen_salt('bf')),
    now(),
    '{"full_name": "Instructor Beta"}'::jsonb,
    now(), now(),
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000004',
    'student_beta@test.local',
    crypt('TestPass123!', gen_salt('bf')),
    now(),
    '{"full_name": "Student Beta"}'::jsonb,
    now(), now(),
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

-- 1.3 Create profiles (the trigger should auto-create, but let's ensure)
INSERT INTO profiles (id, display_name, is_public, role, institute_id) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Instructor Alpha', false, 'instructor', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Student Alpha',    false, 'student',    'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'Instructor Beta',  false, 'instructor', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'Student Beta',     false, 'student',    'aaaaaaaa-0000-0000-0000-000000000002')
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  institute_id = EXCLUDED.institute_id,
  display_name = EXCLUDED.display_name;

-- 1.4 Seed sample day_tasks for both students
INSERT INTO day_tasks (id, user_id, day_number, sort_order, subject, topic, target_hours, actual_hours) VALUES
  -- Student Alpha: Day 1
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 1, 0, 'History', 'Ancient India', 3, 2.5),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 1, 1, 'Polity', 'Fundamental Rights', 2, 1.5),
  -- Student Alpha: Day 2
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 2, 0, 'Geography', 'Indian Rivers', 2, 2),
  -- Student Beta: Day 1
  ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000004', 1, 0, 'Economy', 'Banking', 3, 3),
  ('cccccccc-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000004', 1, 1, 'Science & Tech', 'Space Tech', 2, 1),
  -- Student Beta: Day 2
  ('cccccccc-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000004', 2, 0, 'History', 'Medieval India', 2, 2.5);

-- 1.5 Seed sample mock_tests
INSERT INTO mock_tests (id, user_id, name, date, total_score, max_score) VALUES
  ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Alpha Mock 1', '2026-07-01', 120, 200),
  ('dddddddd-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000004', 'Beta Mock 1',  '2026-07-02', 145, 200);

-- 1.6 Seed sample daily_summaries
INSERT INTO daily_summaries (id, user_id, day_number, date, total_hours, subjects, streak) VALUES
  ('eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 1, '2026-07-01', 4, ARRAY['History','Polity'], 1),
  ('eeeeeeee-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 2, '2026-07-02', 2, ARRAY['Geography'], 2),
  ('eeeeeeee-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000004', 1, '2026-07-01', 4, ARRAY['Economy','Science & Tech'], 1),
  ('eeeeeeee-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000004', 2, '2026-07-02', 2.5, ARRAY['History'], 2);

-- 1.7 Seed sample current_affairs
INSERT INTO current_affairs (id, user_id, date, topic, category, source, notes) VALUES
  ('ffffffff-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', '2026-07-01', 'Budget 2026 Key Points', 'Economy', 'The Hindu', 'Focus on infrastructure'),
  ('ffffffff-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000004', '2026-07-01', 'ISRO Moon Mission', 'Science & Tech', 'Indian Express', 'Chandrayaan-4 update');


-- ============================================================
-- Section 2: VERIFICATION — Run each block separately
-- ============================================================
-- Each block simulates a different user's JWT context.
-- Copy-paste each block into the SQL editor and run it.
-- Check the row counts against expected values.

-- ╔══════════════════════════════════════════════════════════╗
-- ║  TEST 1: Instructor Alpha — should see ONLY Alpha data  ║
-- ╚══════════════════════════════════════════════════════════╝
-- Expected: 3 day_tasks, 1 mock_test, 2 daily_summaries, 1 current_affairs

BEGIN;
  SET LOCAL role = 'authenticated';
  SET LOCAL request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000001", "role": "authenticated"}';

  SELECT 'day_tasks' AS table_name, count(*) AS row_count FROM day_tasks;
  -- Expected: 3 (Student Alpha's tasks only)

  SELECT 'mock_tests' AS table_name, count(*) AS row_count FROM mock_tests;
  -- Expected: 1 (Student Alpha's mock only)

  SELECT 'daily_summaries' AS table_name, count(*) AS row_count FROM daily_summaries;
  -- Expected: 2 (Student Alpha's summaries only)

  SELECT 'current_affairs' AS table_name, count(*) AS row_count FROM current_affairs;
  -- Expected: 1 (Student Alpha's CA only)

  SELECT 'profiles visible' AS table_name, count(*) AS row_count FROM profiles;
  -- Expected: 2 (Instructor Alpha + Student Alpha, both in Alpha Academy)
COMMIT;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  TEST 2: Instructor Beta — should see ONLY Beta data    ║
-- ╚══════════════════════════════════════════════════════════╝
-- Expected: 3 day_tasks, 1 mock_test, 2 daily_summaries, 1 current_affairs

BEGIN;
  SET LOCAL role = 'authenticated';
  SET LOCAL request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000003", "role": "authenticated"}';

  SELECT 'day_tasks' AS table_name, count(*) AS row_count FROM day_tasks;
  -- Expected: 3 (Student Beta's tasks only)

  SELECT 'mock_tests' AS table_name, count(*) AS row_count FROM mock_tests;
  -- Expected: 1

  SELECT 'daily_summaries' AS table_name, count(*) AS row_count FROM daily_summaries;
  -- Expected: 2

  SELECT 'current_affairs' AS table_name, count(*) AS row_count FROM current_affairs;
  -- Expected: 1

  SELECT 'profiles visible' AS table_name, count(*) AS row_count FROM profiles;
  -- Expected: 2 (Instructor Beta + Student Beta)
COMMIT;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  TEST 3: Student Alpha — should see ONLY own data       ║
-- ╚══════════════════════════════════════════════════════════╝

BEGIN;
  SET LOCAL role = 'authenticated';
  SET LOCAL request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000002", "role": "authenticated"}';

  SELECT 'day_tasks' AS table_name, count(*) AS row_count FROM day_tasks;
  -- Expected: 3 (own tasks only)

  SELECT 'mock_tests' AS table_name, count(*) AS row_count FROM mock_tests;
  -- Expected: 1

  SELECT 'daily_summaries' AS table_name, count(*) AS row_count FROM daily_summaries;
  -- Expected: 2

  SELECT 'current_affairs' AS table_name, count(*) AS row_count FROM current_affairs;
  -- Expected: 1

  SELECT 'profiles visible' AS table_name, count(*) AS row_count FROM profiles;
  -- Expected: 1 (only own profile — not public, not instructor)
COMMIT;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  TEST 4: Student Beta — should see ONLY own data        ║
-- ╚══════════════════════════════════════════════════════════╝

BEGIN;
  SET LOCAL role = 'authenticated';
  SET LOCAL request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000004", "role": "authenticated"}';

  SELECT 'day_tasks' AS table_name, count(*) AS row_count FROM day_tasks;
  -- Expected: 3

  SELECT 'mock_tests' AS table_name, count(*) AS row_count FROM mock_tests;
  -- Expected: 1

  SELECT 'daily_summaries' AS table_name, count(*) AS row_count FROM daily_summaries;
  -- Expected: 2

  SELECT 'current_affairs' AS table_name, count(*) AS row_count FROM current_affairs;
  -- Expected: 1

  SELECT 'profiles visible' AS table_name, count(*) AS row_count FROM profiles;
  -- Expected: 1
COMMIT;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  TEST 5: Cross-institute isolation — Instructor Alpha CANNOT see   ║
-- ║  Beta data, and vice versa                                         ║
-- ╚══════════════════════════════════════════════════════════════════════╝

BEGIN;
  SET LOCAL role = 'authenticated';
  SET LOCAL request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000001", "role": "authenticated"}';

  -- Instructor Alpha tries to read Student Beta's tasks
  SELECT 'cross_institute_day_tasks' AS test,
    count(*) AS row_count
  FROM day_tasks
  WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000004';
  -- Expected: 0 (Student Beta is in Beta Institute)

  -- Instructor Alpha tries to read Student Beta's mocks
  SELECT 'cross_institute_mock_tests' AS test,
    count(*) AS row_count
  FROM mock_tests
  WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000004';
  -- Expected: 0
COMMIT;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  TEST 6: Super admin (YOUR user) — should see ALL data             ║
-- ║  Replace YOUR_USER_ID below with your actual auth.users id.        ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- NOTE: Before running this test, you must have set your own
-- profile role to 'super_admin' via:
--   UPDATE profiles SET role = 'super_admin' WHERE id = 'YOUR_USER_ID';

-- BEGIN;
--   SET LOCAL role = 'authenticated';
--   SET LOCAL request.jwt.claims = '{"sub": "YOUR_USER_ID", "role": "authenticated"}';
--
--   SELECT 'day_tasks' AS table_name, count(*) AS row_count FROM day_tasks;
--   -- Expected: 6 (all test tasks + any of your own tasks)
--
--   SELECT 'mock_tests' AS table_name, count(*) AS row_count FROM mock_tests;
--   -- Expected: 2+ (both test mocks + any of your own)
--
--   SELECT 'profiles visible' AS table_name, count(*) AS row_count FROM profiles;
--   -- Expected: 5+ (4 test + you + any real users)
-- COMMIT;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  TEST 7: Write isolation — Instructor cannot INSERT/UPDATE/DELETE   ║
-- ║  data for students (writes are owner-only)                         ║
-- ╚══════════════════════════════════════════════════════════════════════╝

BEGIN;
  SET LOCAL role = 'authenticated';
  SET LOCAL request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000001", "role": "authenticated"}';

  -- Instructor Alpha tries to insert a task for Student Alpha
  -- This should fail (RLS INSERT requires auth.uid() = user_id)
  DO $$
  BEGIN
    INSERT INTO day_tasks (user_id, day_number, sort_order, subject)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000002', 3, 0, 'Test Subject');
    RAISE NOTICE 'FAIL: Instructor was able to insert task for student!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: Instructor correctly blocked from inserting student data.';
  END $$;

  -- Instructor Alpha tries to delete Student Alpha's task
  DO $$
  DECLARE
    deleted_count INTEGER;
  BEGIN
    DELETE FROM day_tasks
    WHERE id = 'cccccccc-0000-0000-0000-000000000001'
      AND user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    IF deleted_count = 0 THEN
      RAISE NOTICE 'PASS: Instructor correctly blocked from deleting student data (0 rows deleted).';
    ELSE
      RAISE NOTICE 'FAIL: Instructor deleted % student task rows!', deleted_count;
    END IF;
  END $$;
COMMIT;


-- ============================================================
-- Section 3: CLEANUP — Remove all test data
-- ============================================================
-- Run this after you've verified isolation.

-- Delete in dependency order
DELETE FROM current_affairs WHERE user_id IN (
  'bbbbbbbb-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000004'
);

DELETE FROM daily_summaries WHERE user_id IN (
  'bbbbbbbb-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000004'
);

DELETE FROM mock_subject_scores WHERE user_id IN (
  'bbbbbbbb-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000004'
);

DELETE FROM mock_tests WHERE user_id IN (
  'bbbbbbbb-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000004'
);

DELETE FROM day_tasks WHERE user_id IN (
  'bbbbbbbb-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000004'
);

DELETE FROM profiles WHERE id IN (
  'bbbbbbbb-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000003',
  'bbbbbbbb-0000-0000-0000-000000000004'
);

DELETE FROM auth.users WHERE id IN (
  'bbbbbbbb-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000003',
  'bbbbbbbb-0000-0000-0000-000000000004'
);

DELETE FROM institutes WHERE id IN (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002'
);

-- ============================================================
-- All test data cleaned up. Your real data is untouched.
-- ============================================================
