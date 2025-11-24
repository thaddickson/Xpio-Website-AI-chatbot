-- Migration 001: Base Schema for Prompts
-- Creates the foundation tables for prompt management
-- Run this FIRST before the A/B testing migration

-- Knowledge base / prompts management table
CREATE TABLE IF NOT EXISTS prompt_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Section info
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,

  -- Content
  content TEXT NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,

  -- Metadata
  last_edited_by TEXT,
  version INTEGER DEFAULT 1
);

-- Version history table
CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES prompt_sections(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Snapshot of content
  content TEXT NOT NULL,
  version INTEGER NOT NULL,
  edited_by TEXT,
  change_notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompt_sections_slug ON prompt_sections(slug);
CREATE INDEX IF NOT EXISTS idx_prompt_sections_active ON prompt_sections(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_sections_order ON prompt_sections(display_order);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_section ON prompt_versions(section_id, version DESC);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_prompt_sections_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1;

  -- Save version history
  INSERT INTO prompt_versions (section_id, content, version, edited_by, change_notes)
  VALUES (OLD.id, OLD.content, OLD.version, NEW.last_edited_by, 'Updated via admin');

  RETURN NEW;
END;
$$;

CREATE TRIGGER prompt_sections_updated_at_trigger
  BEFORE UPDATE ON prompt_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_prompt_sections_updated_at();

COMMENT ON TABLE prompt_sections IS 'Stores editable prompt sections for the chatbot';
COMMENT ON TABLE prompt_versions IS 'Version history for prompt changes';
