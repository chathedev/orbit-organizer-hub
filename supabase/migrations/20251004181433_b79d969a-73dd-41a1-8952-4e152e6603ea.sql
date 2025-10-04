-- Create a simple settings table to trigger types generation
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow reading settings (public read-only)
CREATE POLICY "Settings are viewable by everyone"
  ON public.app_settings
  FOR SELECT
  USING (true);