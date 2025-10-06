-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create meeting_sessions table
CREATE TABLE public.meeting_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transcript text DEFAULT '',
  interim_transcript text DEFAULT '',
  is_paused boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
ON public.meeting_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can create their own sessions"
ON public.meeting_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update their own sessions"
ON public.meeting_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete their own sessions"
ON public.meeting_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_meeting_sessions_updated_at
BEFORE UPDATE ON public.meeting_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();