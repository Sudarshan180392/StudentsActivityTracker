-- ============================================================
-- UPSC Prep Tracker — Supabase Migration
-- Generated: 2026-06-29
-- Paste this entire script into the Supabase SQL Editor and run.
-- ============================================================

-- ============================================================
-- Section 1: Reusable trigger function for updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- Section 2: Tables
-- ============================================================

-- 2.1  user_settings
-- One row per user; stores exam date, subjects list, UI prefs.
CREATE TABLE user_settings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_date   TEXT        DEFAULT '2027-05-23',
  period_name TEXT        DEFAULT '30-Day Sprint',
  subjects    TEXT[]      DEFAULT ARRAY[
                            'History','Geography','Polity','Economy',
                            'Science & Tech','Environment','CSAT',
                            'Ethics','Essay'
                          ],
  show_wellbeing BOOLEAN  DEFAULT true,
  dark_mode      BOOLEAN  DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 2.2  day_tasks
-- Per-day study tasks within a 30-day sprint.
CREATE TABLE day_tasks (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_number    INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 30),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  subject       TEXT    NOT NULL DEFAULT '',
  topic         TEXT    DEFAULT '',
  target_hours  REAL    DEFAULT 0,
  actual_hours  REAL    DEFAULT 0,
  notes         TEXT    DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 2.3  day_wellbeing
-- One wellbeing entry per user per day.
CREATE TABLE day_wellbeing (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_number    INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 30),
  sleep_hours   REAL    DEFAULT 7,
  water_litres  REAL    DEFAULT 2,
  exercise      BOOLEAN DEFAULT false,
  mood          INTEGER DEFAULT 2,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, day_number)
);

-- 2.4  mock_tests
-- Header record for each mock test attempt.
CREATE TABLE mock_tests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  date        TEXT DEFAULT '',
  total_score REAL DEFAULT 0,
  max_score   REAL DEFAULT 200,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 2.5  mock_subject_scores
-- Per-subject breakdown within a mock test.
CREATE TABLE mock_subject_scores (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_id    UUID    NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject    TEXT    NOT NULL DEFAULT '',
  correct    INTEGER DEFAULT 0,
  wrong      INTEGER DEFAULT 0,
  skipped    INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.6  current_affairs
-- Daily current-affairs clippings for revision.
CREATE TABLE current_affairs (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       TEXT    DEFAULT '',
  topic      TEXT    NOT NULL DEFAULT '',
  category   TEXT    DEFAULT 'Polity',
  source     TEXT    DEFAULT '',
  notes      TEXT    DEFAULT '',
  revised    BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- Section 3: Indexes
-- ============================================================
CREATE INDEX idx_day_tasks_user_day        ON day_tasks(user_id, day_number);
-- day_wellbeing already has a UNIQUE(user_id, day_number) which acts as an index.
CREATE INDEX idx_mock_tests_user           ON mock_tests(user_id);
CREATE INDEX idx_mock_subject_scores_mock  ON mock_subject_scores(mock_id);
CREATE INDEX idx_current_affairs_user      ON current_affairs(user_id);


-- ============================================================
-- Section 4: updated_at triggers
-- ============================================================
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_day_tasks_updated_at
  BEFORE UPDATE ON day_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_day_wellbeing_updated_at
  BEFORE UPDATE ON day_wellbeing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_mock_tests_updated_at
  BEFORE UPDATE ON mock_tests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- mock_subject_scores has no updated_at column, so no trigger needed.

CREATE TRIGGER trg_current_affairs_updated_at
  BEFORE UPDATE ON current_affairs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- Section 5: Row Level Security (RLS)
-- ============================================================

-- ---- user_settings ----
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_select" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_settings_insert" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_delete" ON user_settings
  FOR DELETE USING (auth.uid() = user_id);

-- ---- day_tasks ----
ALTER TABLE day_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "day_tasks_select" ON day_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "day_tasks_insert" ON day_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "day_tasks_update" ON day_tasks
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "day_tasks_delete" ON day_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- ---- day_wellbeing ----
ALTER TABLE day_wellbeing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "day_wellbeing_select" ON day_wellbeing
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "day_wellbeing_insert" ON day_wellbeing
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "day_wellbeing_update" ON day_wellbeing
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "day_wellbeing_delete" ON day_wellbeing
  FOR DELETE USING (auth.uid() = user_id);

-- ---- mock_tests ----
ALTER TABLE mock_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mock_tests_select" ON mock_tests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "mock_tests_insert" ON mock_tests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mock_tests_update" ON mock_tests
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mock_tests_delete" ON mock_tests
  FOR DELETE USING (auth.uid() = user_id);

-- ---- mock_subject_scores ----
ALTER TABLE mock_subject_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mock_subject_scores_select" ON mock_subject_scores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "mock_subject_scores_insert" ON mock_subject_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mock_subject_scores_update" ON mock_subject_scores
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mock_subject_scores_delete" ON mock_subject_scores
  FOR DELETE USING (auth.uid() = user_id);

-- ---- current_affairs ----
ALTER TABLE current_affairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "current_affairs_select" ON current_affairs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "current_affairs_insert" ON current_affairs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "current_affairs_update" ON current_affairs
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "current_affairs_delete" ON current_affairs
  FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- Done! All 6 tables, indexes, triggers, and RLS policies
-- have been created. You can now use these tables from the
-- Supabase client SDK with auth.uid() automatically enforced.
-- ============================================================
