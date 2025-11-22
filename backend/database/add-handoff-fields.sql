-- Add handoff tracking fields to conversations table
-- Run this in your Supabase SQL Editor

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS is_handed_off BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS slack_thread_ts TEXT,
ADD COLUMN IF NOT EXISTS handed_off_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS handed_off_to TEXT;

-- Index for faster handoff queries
CREATE INDEX IF NOT EXISTS idx_conversations_handed_off ON conversations(is_handed_off);

-- Comments for documentation
COMMENT ON COLUMN conversations.is_handed_off IS 'True when conversation has been handed off to a human';
COMMENT ON COLUMN conversations.slack_thread_ts IS 'Slack thread timestamp for bidirectional messaging';
COMMENT ON COLUMN conversations.handed_off_at IS 'When the handoff occurred';
COMMENT ON COLUMN conversations.handed_off_to IS 'Name of person who took over (e.g., "Thad")';
