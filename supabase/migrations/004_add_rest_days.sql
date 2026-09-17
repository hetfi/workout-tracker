-- 休息日テーブル
CREATE TABLE IF NOT EXISTS rest_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE rest_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own rest days"
  ON rest_days
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
