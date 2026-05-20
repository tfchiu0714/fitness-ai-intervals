-- Migration: Intervals.icu settings table (replaces strava_activities)
CREATE TABLE IF NOT EXISTS intervals_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  athlete_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE intervals_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own intervals settings" ON intervals_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own intervals settings" ON intervals_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own intervals settings" ON intervals_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Activities table for cached intervals.icu data
CREATE TABLE IF NOT EXISTS intervals_activities (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intervals_act_user_date ON intervals_activities(user_id, start_date DESC);

ALTER TABLE intervals_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own intervals activities" ON intervals_activities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own intervals activities" ON intervals_activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);
