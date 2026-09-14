-- Add is_duration flag to exercises master
-- When true, sets are recorded as duration (minutes) instead of weight × reps
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS is_duration BOOLEAN NOT NULL DEFAULT FALSE;
