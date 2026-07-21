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
