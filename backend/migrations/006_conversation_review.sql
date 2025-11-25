-- Migration 006: Add conversation review/flagging columns
-- Purpose: Allow reviewing conversations and flagging for prompt improvement
-- Date: 2024-11-25

-- Add review columns to conversations table
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT,
  ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Index for flagged conversations
CREATE INDEX IF NOT EXISTS idx_conversations_flagged ON conversations(flagged) WHERE flagged = true;

-- Comments
COMMENT ON COLUMN conversations.flagged IS 'Whether conversation is flagged for review';
COMMENT ON COLUMN conversations.flag_reason IS 'Reason for flagging (too long, wrong tone, missing info, etc)';
COMMENT ON COLUMN conversations.review_notes IS 'Notes from reviewing the conversation for prompt improvement';
