-- Fix: Allow L and R slots of one-arm exercises to share the same set_number.
-- The previous unique index on (session_exercise_id, set_number) caused a
-- conflict when saving both sides of a one-arm set.
-- New constraint: (session_exercise_id, set_number, COALESCE(side, ''))
-- This allows: (ex_id, 1, 'L'), (ex_id, 1, 'R'), (ex_id, 1, '') [normal sets]

DROP INDEX IF EXISTS ws_session_exercise_set_number_idx;

CREATE UNIQUE INDEX ws_session_exercise_set_number_idx
  ON workout_sets(session_exercise_id, set_number, COALESCE(side, ''));
