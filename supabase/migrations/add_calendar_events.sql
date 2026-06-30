CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_type text NOT NULL DEFAULT 'general',
  start_time text,
  end_time text,
  is_all_day boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own calendar events"
  ON calendar_events USING (profile_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_calendar_events_profile_date 
  ON calendar_events(profile_id, event_date);
