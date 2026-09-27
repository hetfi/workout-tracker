-- Idempotent migration: ensure one-arm exercise schema is fully applied.
-- Safe to run even if partial fixes were already applied.

-- 1. Ensure side column exists on workout_sets
ALTER TABLE workout_sets
  ADD COLUMN IF NOT EXISTS side text;

-- 2. Ensure is_one_arm column exists on workout_session_exercises
ALTER TABLE workout_session_exercises
  ADD COLUMN IF NOT EXISTS is_one_arm boolean NOT NULL DEFAULT false;

-- 3. Drop old unique index (session_exercise_id, set_number) if still present,
--    then create the correct one that includes side.
--    This allows L and R of the same set_number to coexist.
DROP INDEX IF EXISTS ws_session_exercise_set_number_idx;

CREATE UNIQUE INDEX ws_session_exercise_set_number_idx
  ON workout_sets(session_exercise_id, set_number, COALESCE(side, ''));
