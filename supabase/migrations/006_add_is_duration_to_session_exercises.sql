-- Add is_duration to workout_session_exercises so it is snapshotted at session creation time,
-- matching the same pattern as is_one_arm. Previously this was read at runtime from the
-- exercises master table, causing getSessionExercises() to always return isDuration=false.

ALTER TABLE workout_session_exercises
  ADD COLUMN is_duration boolean NOT NULL DEFAULT false;

-- Primary backfill: use exercise_id FK where available
UPDATE workout_session_exercises wse
SET is_duration = e.is_duration
FROM exercises e
WHERE wse.exercise_id = e.id AND e.is_duration = true;

-- Secondary backfill: exercise_id is NULL (master was hard-deleted), fall back to name match
UPDATE workout_session_exercises wse
SET is_duration = true
FROM exercises e
WHERE wse.exercise_id IS NULL
  AND wse.is_duration = false
  AND e.user_id = wse.user_id
  AND lower(e.name) = lower(wse.exercise_name)
  AND e.is_duration = true;
