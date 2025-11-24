-- Migration: Add A/B Testing and Prompt Variations
-- Purpose: Enable testing multiple prompt variations and tracking performance
-- Date: 2024-11-24

-- Table: prompt_variations
-- Stores different versions of prompt sections for A/B testing
CREATE TABLE IF NOT EXISTS prompt_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_section_id UUID NOT NULL, -- Links to prompt_sections.id
  variation_name VARCHAR(100) NOT NULL, -- e.g., "Control", "Version A", "Shorter Greeting"
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false, -- Whether this variation is being tested
  traffic_percentage INTEGER DEFAULT 0, -- % of traffic to route to this variation (0-100)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(100),
  notes TEXT, -- Notes about what this variation is testing
  CONSTRAINT fk_prompt_section FOREIGN KEY (prompt_section_id)
    REFERENCES prompt_sections(id) ON DELETE CASCADE
);

-- Table: conversation_test_assignments
-- Tracks which prompt variation was used for each conversation
CREATE TABLE IF NOT EXISTS conversation_test_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(255) NOT NULL,
  prompt_section_id UUID NOT NULL,
  variation_id UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_variation FOREIGN KEY (variation_id)
    REFERENCES prompt_variations(id) ON DELETE CASCADE,
  CONSTRAINT fk_prompt FOREIGN KEY (prompt_section_id)
    REFERENCES prompt_sections(id) ON DELETE CASCADE
);

-- Table: variation_performance_metrics
-- Aggregated performance metrics for each variation
CREATE TABLE IF NOT EXISTS variation_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variation_id UUID NOT NULL,
  metric_date DATE DEFAULT CURRENT_DATE,

  -- Conversation metrics
  conversations_count INTEGER DEFAULT 0,
  avg_message_count DECIMAL(5,2) DEFAULT 0,
  avg_conversation_duration_seconds INTEGER DEFAULT 0,

  -- Lead capture metrics
  leads_captured INTEGER DEFAULT 0,
  lead_conversion_rate DECIMAL(5,2) DEFAULT 0, -- Percentage
  qualified_leads INTEGER DEFAULT 0, -- Hot + Warm leads

  -- Engagement metrics
  handoffs_requested INTEGER DEFAULT 0,
  handoff_rate DECIMAL(5,2) DEFAULT 0,
  calendar_checks INTEGER DEFAULT 0,
  calendar_booking_rate DECIMAL(5,2) DEFAULT 0,

  -- Quality metrics
  abandoned_conversations INTEGER DEFAULT 0,
  abandonment_rate DECIMAL(5,2) DEFAULT 0,

  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_variation_metrics FOREIGN KEY (variation_id)
    REFERENCES prompt_variations(id) ON DELETE CASCADE,
  CONSTRAINT unique_variation_date UNIQUE (variation_id, metric_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_variations_prompt_section
  ON prompt_variations(prompt_section_id);
CREATE INDEX IF NOT EXISTS idx_variations_active
  ON prompt_variations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_assignments_conversation
  ON conversation_test_assignments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_assignments_variation
  ON conversation_test_assignments(variation_id);
CREATE INDEX IF NOT EXISTS idx_metrics_variation
  ON variation_performance_metrics(variation_id);
CREATE INDEX IF NOT EXISTS idx_metrics_date
  ON variation_performance_metrics(metric_date);

-- Add test tracking columns to conversations table
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS uses_test_variations BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_group VARCHAR(50); -- e.g., "control", "variant_a", "variant_b"

COMMENT ON TABLE prompt_variations IS 'Stores different versions of prompts for A/B testing';
COMMENT ON TABLE conversation_test_assignments IS 'Maps conversations to specific prompt variations for tracking';
COMMENT ON TABLE variation_performance_metrics IS 'Aggregated daily performance metrics for each prompt variation';
