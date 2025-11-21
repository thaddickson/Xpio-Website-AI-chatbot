-- Conversations table to log ALL chat interactions
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Conversation metadata
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'abandoned')),
  message_count INTEGER DEFAULT 0,
  lead_captured BOOLEAN DEFAULT FALSE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- Full conversation data
  messages JSONB DEFAULT '[]'::jsonb,

  -- Session info
  user_agent TEXT,
  ip_address TEXT,
  referrer TEXT,

  -- Indexes for querying
  CONSTRAINT conversations_conversation_id_key UNIQUE (conversation_id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_captured ON conversations(lead_captured);
CREATE INDEX IF NOT EXISTS idx_conversations_conversation_id ON conversations(conversation_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversations_updated_at_trigger
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_conversations_updated_at();

-- Comments for documentation
COMMENT ON TABLE conversations IS 'Stores all chatbot conversations for analytics and auditing';
COMMENT ON COLUMN conversations.conversation_id IS 'Unique conversation identifier from the application';
COMMENT ON COLUMN conversations.messages IS 'Full conversation history as JSON array';
COMMENT ON COLUMN conversations.status IS 'active = ongoing, ended = gracefully closed, abandoned = timed out or user left';
