-- Migration 004: API Usage Tracking
-- Purpose: Track Claude API usage and costs per tenant
-- Date: 2024-11-24

-- =====================================================
-- API Usage Table
-- =====================================================

CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Tenant association
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id VARCHAR(255),

  -- Model info
  model VARCHAR(100) NOT NULL,

  -- Token counts
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_creation_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,

  -- Calculated cost
  cost_usd DECIMAL(10, 6) DEFAULT 0
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_api_usage_tenant ON api_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_tenant_created ON api_usage(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_conversation ON api_usage(conversation_id);

-- =====================================================
-- RLS Policy
-- =====================================================

ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_api_usage ON api_usage;
CREATE POLICY tenant_isolation_api_usage ON api_usage
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

-- =====================================================
-- Aggregation view for quick lookups
-- =====================================================

CREATE OR REPLACE VIEW tenant_usage_summary AS
SELECT
  tenant_id,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS total_requests,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(cache_creation_tokens) AS total_cache_creation_tokens,
  SUM(cache_read_tokens) AS total_cache_read_tokens,
  SUM(cost_usd) AS total_cost_usd
FROM api_usage
GROUP BY tenant_id, DATE_TRUNC('month', created_at);

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE api_usage IS 'Tracks Claude API token usage and costs per tenant per request';
COMMENT ON COLUMN api_usage.cost_usd IS 'Calculated cost based on model pricing at time of request';
