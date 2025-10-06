-- Make user_id nullable and add folder/name support
ALTER TABLE meeting_sessions 
  ALTER COLUMN user_id DROP NOT NULL;

-- Add name and folder columns
ALTER TABLE meeting_sessions 
  ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Namnlöst möte',
  ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT 'Allmänt';

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can create their own sessions" ON meeting_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON meeting_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON meeting_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON meeting_sessions;

-- Disable RLS to allow public access
ALTER TABLE meeting_sessions DISABLE ROW LEVEL SECURITY;

-- Create folders table for managing folder list
CREATE TABLE IF NOT EXISTS meeting_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default folder
INSERT INTO meeting_folders (name) 
VALUES ('Allmänt')
ON CONFLICT (name) DO NOTHING;

-- Disable RLS on folders table
ALTER TABLE meeting_folders DISABLE ROW LEVEL SECURITY;