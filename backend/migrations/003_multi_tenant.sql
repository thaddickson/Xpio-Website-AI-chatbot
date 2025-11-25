-- Migration 003: Multi-Tenant Infrastructure
-- Purpose: Transform single-tenant chatbot into multi-tenant SaaS platform
-- Date: 2024-11-24

-- =====================================================
-- PHASE 1: Core Tenant Tables
-- =====================================================

-- Main tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Identification
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL, -- Used in subdomains: {slug}.yourchatbot.com

  -- Custom domain support
  custom_domain VARCHAR(255) UNIQUE,
  domain_verified BOOLEAN DEFAULT false,
  domain_verified_at TIMESTAMP WITH TIME ZONE,

  -- Billing & Plan
  plan_type VARCHAR(50) DEFAULT 'free', -- 'free', 'starter', 'pro', 'enterprise'
  plan_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),

  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'suspended', 'cancelled', 'trial'
  trial_ends_at TIMESTAMP WITH TIME ZONE,

  -- Branding / Settings (JSONB for flexibility)
  settings JSONB DEFAULT '{
    "branding": {
      "primaryColor": "#007bff",
      "logoUrl": null,
      "chatTitle": "Chat with us",
      "greeting": "Hi! How can I help you today?"
    },
    "features": {
      "abTesting": false,
      "slackIntegration": false,
      "customDomain": false,
      "removeWatermark": false,
      "apiAccess": false
    },
    "limits": {
      "monthlyConversations": 100,
      "promptSections": 5,
      "teamMembers": 1,
      "historyRetentionDays": 30
    }
  }'::jsonb,

  -- Usage tracking
  current_month_conversations INTEGER DEFAULT 0,
  last_usage_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tenant API keys for widget authentication
CREATE TABLE IF NOT EXISTS tenant_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Key info
  key_prefix VARCHAR(20) NOT NULL, -- First 8 chars for identification: pk_live_abc123
  key_hash VARCHAR(255) NOT NULL, -- SHA-256 hash of full key
  name VARCHAR(100) DEFAULT 'Default', -- User-friendly name

  -- Type & permissions
  key_type VARCHAR(20) DEFAULT 'publishable', -- 'publishable' (widget), 'secret' (API)

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL = never expires

  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60,

  CONSTRAINT unique_key_prefix_per_tenant UNIQUE (tenant_id, key_prefix)
);

-- Tenant users (admins who manage the chatbot)
CREATE TABLE IF NOT EXISTS tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Auth
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255), -- NULL if using OAuth

  -- Profile
  name VARCHAR(255),
  avatar_url VARCHAR(500),

  -- Role & permissions
  role VARCHAR(50) DEFAULT 'admin', -- 'owner', 'admin', 'editor', 'viewer'
  permissions JSONB DEFAULT '[]'::jsonb, -- Granular permissions if needed

  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'invited', 'suspended'
  invited_by UUID REFERENCES tenant_users(id),
  invite_accepted_at TIMESTAMP WITH TIME ZONE,

  -- Auth tracking
  last_login_at TIMESTAMP WITH TIME ZONE,
  login_count INTEGER DEFAULT 0,

  -- MFA
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_secret VARCHAR(255),

  CONSTRAINT unique_email_per_tenant UNIQUE (tenant_id, email)
);

-- Tenant integrations (API keys for external services)
CREATE TABLE IF NOT EXISTS tenant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- AI Provider (allow tenants to use their own keys)
  anthropic_api_key_encrypted TEXT, -- Encrypted at rest
  use_platform_ai_key BOOLEAN DEFAULT true, -- If true, use platform's Claude key

  -- Email notifications
  sendgrid_api_key_encrypted TEXT,
  sendgrid_from_email VARCHAR(255),
  notification_emails TEXT[], -- Array of emails to notify

  -- Slack
  slack_token_encrypted TEXT,
  slack_channel_id VARCHAR(100),
  slack_workspace_name VARCHAR(255),

  -- Calendar
  calendly_url VARCHAR(500),

  -- Webhooks
  webhook_url VARCHAR(500),
  webhook_secret VARCHAR(255),
  webhook_events TEXT[] DEFAULT ARRAY['lead.created', 'conversation.ended']
);

-- =====================================================
-- PHASE 2: Add tenant_id to existing tables
-- =====================================================

-- Create a default tenant for existing data
INSERT INTO tenants (id, name, slug, plan_type, status, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Tenant',
  'default',
  'enterprise',
  'active',
  '{
    "branding": {
      "primaryColor": "#FC922B",
      "chatTitle": "Xpio Health",
      "greeting": "Hi! How can I help you today?"
    },
    "features": {
      "abTesting": true,
      "slackIntegration": true,
      "customDomain": true,
      "removeWatermark": true,
      "apiAccess": true
    },
    "limits": {
      "monthlyConversations": -1,
      "promptSections": -1,
      "teamMembers": -1,
      "historyRetentionDays": -1
    }
  }'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- Add tenant_id to prompt_sections
ALTER TABLE prompt_sections
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

UPDATE prompt_sections
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Make slug unique per tenant, not globally
DROP INDEX IF EXISTS prompt_sections_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_sections_tenant_slug
  ON prompt_sections(tenant_id, slug);

-- Add tenant_id to prompt_versions
ALTER TABLE prompt_versions
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

UPDATE prompt_versions
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Add tenant_id to prompt_variations
ALTER TABLE prompt_variations
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

UPDATE prompt_variations
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Add tenant_id to leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

UPDATE leads
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Add tenant_id to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

UPDATE conversations
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Add tenant_id to conversation_test_assignments
ALTER TABLE conversation_test_assignments
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

UPDATE conversation_test_assignments
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Add tenant_id to variation_performance_metrics
ALTER TABLE variation_performance_metrics
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

UPDATE variation_performance_metrics
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- =====================================================
-- PHASE 3: Indexes for tenant queries
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain ON tenants(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan_type);

CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tenant ON tenant_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_prefix ON tenant_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_active ON tenant_api_keys(tenant_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON tenant_users(email);

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant ON tenant_integrations(tenant_id);

-- Composite indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_prompt_sections_tenant ON prompt_sections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_created ON leads(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_created ON conversations(tenant_id, created_at DESC);

-- =====================================================
-- PHASE 4: Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on tenant-scoped tables
ALTER TABLE prompt_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE variation_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Create a function to get current tenant from session
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
$$;

-- RLS Policies for prompt_sections
DROP POLICY IF EXISTS tenant_isolation_prompt_sections ON prompt_sections;
CREATE POLICY tenant_isolation_prompt_sections ON prompt_sections
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

-- RLS Policies for prompt_versions
DROP POLICY IF EXISTS tenant_isolation_prompt_versions ON prompt_versions;
CREATE POLICY tenant_isolation_prompt_versions ON prompt_versions
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

-- RLS Policies for prompt_variations
DROP POLICY IF EXISTS tenant_isolation_prompt_variations ON prompt_variations;
CREATE POLICY tenant_isolation_prompt_variations ON prompt_variations
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

-- RLS Policies for leads
DROP POLICY IF EXISTS tenant_isolation_leads ON leads;
CREATE POLICY tenant_isolation_leads ON leads
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

-- RLS Policies for conversations
DROP POLICY IF EXISTS tenant_isolation_conversations ON conversations;
CREATE POLICY tenant_isolation_conversations ON conversations
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

-- RLS Policies for conversation_test_assignments
DROP POLICY IF EXISTS tenant_isolation_test_assignments ON conversation_test_assignments;
CREATE POLICY tenant_isolation_test_assignments ON conversation_test_assignments
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

-- RLS Policies for variation_performance_metrics
DROP POLICY IF EXISTS tenant_isolation_metrics ON variation_performance_metrics;
CREATE POLICY tenant_isolation_metrics ON variation_performance_metrics
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

-- =====================================================
-- PHASE 5: Helper Functions
-- =====================================================

-- Function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, false);
END;
$$;

-- Function to clear tenant context
CREATE OR REPLACE FUNCTION clear_tenant_context()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', '', false);
END;
$$;

-- Function to get tenant by API key prefix
CREATE OR REPLACE FUNCTION get_tenant_by_api_key(p_key_prefix VARCHAR(20))
RETURNS TABLE (
  tenant_id UUID,
  tenant_slug VARCHAR(100),
  tenant_settings JSONB,
  key_id UUID,
  rate_limit INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id as tenant_id,
    t.slug as tenant_slug,
    t.settings as tenant_settings,
    k.id as key_id,
    k.rate_limit_per_minute as rate_limit
  FROM tenant_api_keys k
  JOIN tenants t ON t.id = k.tenant_id
  WHERE k.key_prefix = p_key_prefix
    AND k.is_active = true
    AND t.status = 'active'
    AND (k.expires_at IS NULL OR k.expires_at > NOW());
END;
$$;

-- Function to increment monthly conversation count
CREATE OR REPLACE FUNCTION increment_tenant_conversation_count(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE tenants
  SET current_month_conversations = current_month_conversations + 1
  WHERE id = p_tenant_id;
END;
$$;

-- Function to check if tenant is within usage limits
CREATE OR REPLACE FUNCTION check_tenant_limits(p_tenant_id UUID)
RETURNS TABLE (
  within_limits BOOLEAN,
  limit_type VARCHAR(50),
  current_usage INTEGER,
  max_allowed INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_settings JSONB;
  v_current_conversations INTEGER;
  v_max_conversations INTEGER;
BEGIN
  SELECT settings, current_month_conversations
  INTO v_settings, v_current_conversations
  FROM tenants WHERE id = p_tenant_id;

  v_max_conversations := (v_settings->'limits'->>'monthlyConversations')::INTEGER;

  -- -1 means unlimited
  IF v_max_conversations = -1 THEN
    RETURN QUERY SELECT true, 'conversations'::VARCHAR(50), v_current_conversations, -1;
  ELSE
    RETURN QUERY SELECT
      v_current_conversations < v_max_conversations,
      'conversations'::VARCHAR(50),
      v_current_conversations,
      v_max_conversations;
  END IF;
END;
$$;

-- =====================================================
-- PHASE 6: Auto-update triggers for tenants
-- =====================================================

CREATE OR REPLACE FUNCTION update_tenants_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_updated_at_trigger ON tenants;
CREATE TRIGGER tenants_updated_at_trigger
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_tenants_updated_at();

DROP TRIGGER IF EXISTS tenant_users_updated_at_trigger ON tenant_users;
CREATE TRIGGER tenant_users_updated_at_trigger
  BEFORE UPDATE ON tenant_users
  FOR EACH ROW
  EXECUTE FUNCTION update_tenants_updated_at();

DROP TRIGGER IF EXISTS tenant_integrations_updated_at_trigger ON tenant_integrations;
CREATE TRIGGER tenant_integrations_updated_at_trigger
  BEFORE UPDATE ON tenant_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_tenants_updated_at();

-- =====================================================
-- PHASE 7: Monthly usage reset job (run via cron)
-- =====================================================

CREATE OR REPLACE FUNCTION reset_monthly_tenant_usage()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE tenants
  SET
    current_month_conversations = 0,
    last_usage_reset_at = NOW()
  WHERE last_usage_reset_at < DATE_TRUNC('month', NOW());
END;
$$;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE tenants IS 'Multi-tenant: Organizations/customers using the chatbot platform';
COMMENT ON TABLE tenant_api_keys IS 'API keys for authenticating widget and API requests per tenant';
COMMENT ON TABLE tenant_users IS 'Users who can manage a tenant (admins, editors, viewers)';
COMMENT ON TABLE tenant_integrations IS 'External service integrations per tenant (Slack, email, etc.)';
COMMENT ON FUNCTION current_tenant_id() IS 'Returns the current tenant ID from session context for RLS';
COMMENT ON FUNCTION set_tenant_context(UUID) IS 'Sets the tenant context for RLS policies';
