-- =========================================================
-- Database Optimization Migration
-- Run this in Supabase SQL Editor (one time)
-- =========================================================

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_notes_color ON notes (color);
CREATE INDEX IF NOT EXISTS idx_notes_color_created ON notes (color, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_sr_code ON students (sr_code);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages (receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages (sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_files_subject ON shared_files (subject);
CREATE INDEX IF NOT EXISTS idx_shared_files_created ON shared_files (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_day ON schedule (day_of_week);
CREATE INDEX IF NOT EXISTS idx_students_last_login ON students (last_login DESC);
CREATE INDEX IF NOT EXISTS idx_students_role ON students (role);
CREATE INDEX IF NOT EXISTS idx_todo_completions_todo ON todo_completions (todo_id);

-- ============ RPC: Atomic like adjustment ============
CREATE OR REPLACE FUNCTION adjust_likes(note_id uuid, delta int)
RETURNS int AS $$
DECLARE new_count int;
BEGIN
  UPDATE notes SET likes = GREATEST(0, COALESCE(likes, 0) + delta)
  WHERE id = note_id
  RETURNING likes INTO new_count;
  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- ============ RPC: Atomic battle stat increment ============
CREATE OR REPLACE FUNCTION increment_battle_stat(user_id uuid, stat text)
RETURNS void AS $$
BEGIN
  IF stat = 'wins' THEN
    UPDATE students SET battle_wins = COALESCE(battle_wins, 0) + 1 WHERE id = user_id;
  ELSIF stat = 'losses' THEN
    UPDATE students SET battle_losses = COALESCE(battle_losses, 0) + 1 WHERE id = user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============ RPC: Batch reposition notes ============
CREATE OR REPLACE FUNCTION batch_reposition_notes(updates jsonb)
RETURNS void AS $$
BEGIN
  UPDATE notes n
  SET x_pos = (u->>'x')::int,
      y_pos = (u->>'y')::int,
      rotation = COALESCE((u->>'rot')::int, 0)
  FROM jsonb_array_elements(updates) AS u
  WHERE n.id = (u->>'id')::uuid;
END;
$$ LANGUAGE plpgsql;

-- ============ RPC: Cleanup old FILE_VIEW logs ============
CREATE OR REPLACE FUNCTION cleanup_file_views()
RETURNS int AS $$
DECLARE deleted int;
BEGIN
  DELETE FROM notes WHERE color = 'FILE_VIEW' AND created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql;

-- ============ SECTIONS & MULTI-BLOCK SUPPORT ============
ALTER TABLE students ADD COLUMN IF NOT EXISTS section text DEFAULT 'BSIT-3106';
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS section text DEFAULT 'BSIT-3106';

-- Update existing default values if previously set to BSIT-2101 or null
UPDATE students SET section = 'BSIT-3106' WHERE section = 'BSIT-2101' OR section IS NULL;
UPDATE schedule SET section = 'BSIT-3106' WHERE section = 'BSIT-2101' OR section IS NULL;

CREATE INDEX IF NOT EXISTS idx_students_section ON students (section);
CREATE INDEX IF NOT EXISTS idx_schedule_section ON schedule (section);

-- ============ PRELIMS / MIDTERMS / FINALS TERM SUPPORT ============
-- Run once in Supabase SQL Editor. All currently uploaded files become Prelims.
ALTER TABLE shared_files ADD COLUMN IF NOT EXISTS term text DEFAULT 'Prelims';
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'shared_files_term_check'
    ) THEN
        ALTER TABLE shared_files ADD CONSTRAINT shared_files_term_check
        CHECK (term IN ('Prelims', 'Midterms', 'Finals'));
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_shared_files_term ON shared_files (term);
CREATE INDEX IF NOT EXISTS idx_shared_files_subject_term ON shared_files (subject, term);
UPDATE shared_files SET term = 'Prelims' WHERE term IS NULL;

-- ============ ADMIN SECTION VISIBILITY (hide/show binder tabs) ============
CREATE TABLE IF NOT EXISTS admin_settings (
    section text PRIMARY KEY,
    hidden boolean NOT NULL DEFAULT false,
    updated_at timestamptz DEFAULT now()
);
INSERT INTO admin_settings (section, hidden) VALUES
  ('schedule', false), ('assignments', false), ('calendar', false),
  ('links', false), ('flashcards', false), ('help', false),
  ('games', false), ('midterms', false)
ON CONFLICT (section) DO NOTHING;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
-- Everyone can read settings; write open (app has no real auth RLS for students yet, matching existing tables)
DROP POLICY IF EXISTS "admin_settings_select_public" ON admin_settings;
CREATE POLICY "admin_settings_select_public" ON admin_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin_settings_update_public" ON admin_settings;
CREATE POLICY "admin_settings_update_public" ON admin_settings FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_settings_insert_public" ON admin_settings;
CREATE POLICY "admin_settings_insert_public" ON admin_settings FOR INSERT WITH CHECK (true);
-- Realtime so tabs hide live without refresh
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'admin_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE admin_settings;
  END IF;
END $$;

