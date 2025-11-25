-- Migration 005: Add manual_api_cost column to tenants
-- Purpose: Allow entering historical API costs not captured by tracking
-- Date: 2024-11-25

-- Add column for manual API cost override
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS manual_api_cost DECIMAL(10, 2) DEFAULT 0;

-- Comment
COMMENT ON COLUMN tenants.manual_api_cost IS 'Manual API cost override for historical usage not captured by tracking';
