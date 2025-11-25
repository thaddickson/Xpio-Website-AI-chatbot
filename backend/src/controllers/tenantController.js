import Tenant, { TenantApiKey, TenantUser, TenantIntegrations, PLANS } from '../models/Tenant.js';
import { hashPassword, generateTokens, loginUser, refreshTokens } from '../middleware/tenantAuth.js';

/**
 * Tenant Controller - Handles tenant management API endpoints
 */

// ==================== Authentication ====================

/**
 * Register a new tenant and owner
 * POST /api/tenants/register
 */
export async function registerTenant(req, res) {
  try {
    const { tenantName, tenantSlug, email, password, name, planType = 'free' } = req.body;

    // Validate required fields
    if (!tenantName || !tenantSlug || !email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['tenantName', 'tenantSlug', 'email', 'password']
      });
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(tenantSlug)) {
      return res.status(400).json({
        error: 'Invalid slug format',
        message: 'Slug must contain only lowercase letters, numbers, and hyphens'
      });
    }

    // Check if slug is available
    const slugAvailable = await Tenant.isSlugAvailable(tenantSlug);
    if (!slugAvailable) {
      return res.status(409).json({
        error: 'Slug already taken',
        message: 'This subdomain is already in use. Please choose another.'
      });
    }

    // Create tenant
    const tenant = await Tenant.create({
      name: tenantName,
      slug: tenantSlug,
      planType
    });

    // Create owner user
    const passwordHash = await hashPassword(password);
    const user = await TenantUser.create({
      tenantId: tenant.id,
      email,
      passwordHash,
      name: name || email.split('@')[0],
      role: 'owner'
    });

    // Generate initial API key
    const { key, keyData } = await TenantApiKey.create(tenant.id, {
      name: 'Default API Key',
      keyType: 'publishable'
    });

    // Generate auth tokens
    const userWithTenant = { ...user, tenant };
    const tokens = generateTokens(userWithTenant);

    res.status(201).json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        planType: tenant.plan_type
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      apiKey: key, // Only returned once!
      tokens
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message
    });
  }
}

/**
 * Login to tenant
 * POST /api/tenants/login
 */
export async function login(req, res) {
  try {
    const { email, password, tenantSlug } = req.body;

    if (!email || !password || !tenantSlug) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['email', 'password', 'tenantSlug']
      });
    }

    const result = await loginUser(email, password, tenantSlug);

    if (!result.success) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: result.error
      });
    }

    res.json({
      success: true,
      user: result.user,
      tokens: result.tokens
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error.message
    });
  }
}

/**
 * Refresh access token
 * POST /api/tenants/refresh
 */
export async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required'
      });
    }

    const result = await refreshTokens(refreshToken);

    if (!result.success) {
      return res.status(401).json({
        error: 'Token refresh failed',
        message: result.error
      });
    }

    res.json({
      success: true,
      tokens: result.tokens
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      message: error.message
    });
  }
}

// ==================== Tenant Management ====================

/**
 * Get current tenant info
 * GET /api/tenant
 */
export async function getCurrentTenant(req, res) {
  try {
    if (!req.tenant) {
      return res.status(404).json({
        error: 'No tenant context'
      });
    }

    res.json({
      tenant: {
        id: req.tenant.id,
        name: req.tenant.name,
        slug: req.tenant.slug,
        planType: req.tenant.plan_type,
        status: req.tenant.status,
        settings: req.tenant.settings,
        usage: {
          currentMonthConversations: req.tenant.current_month_conversations,
          limits: req.tenant.settings?.limits || PLANS[req.tenant.plan_type]?.limits
        },
        createdAt: req.tenant.created_at
      }
    });
  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).json({
      error: 'Failed to get tenant',
      message: error.message
    });
  }
}

/**
 * Update tenant settings
 * PUT /api/tenant/settings
 */
export async function updateTenantSettings(req, res) {
  try {
    if (!req.tenant) {
      return res.status(404).json({ error: 'No tenant context' });
    }

    const { branding, name } = req.body;

    const updates = {};
    if (name) updates.name = name;

    // Update settings if branding provided
    if (branding) {
      await Tenant.updateSettings(req.tenantId, { branding });
    }

    if (Object.keys(updates).length > 0) {
      await Tenant.update(req.tenantId, updates);
    }

    // Fetch updated tenant
    const tenant = await Tenant.getById(req.tenantId);

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        settings: tenant.settings
      }
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      error: 'Failed to update settings',
      message: error.message
    });
  }
}

// ==================== API Key Management ====================

/**
 * List API keys for tenant
 * GET /api/tenant/api-keys
 */
export async function listApiKeys(req, res) {
  try {
    if (!req.tenantId) {
      return res.status(404).json({ error: 'No tenant context' });
    }

    const keys = await TenantApiKey.listForTenant(req.tenantId);

    res.json({
      keys: keys.map(k => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.key_prefix,
        keyType: k.key_type,
        isActive: k.is_active,
        lastUsedAt: k.last_used_at,
        expiresAt: k.expires_at,
        createdAt: k.created_at
      }))
    });
  } catch (error) {
    console.error('List API keys error:', error);
    res.status(500).json({
      error: 'Failed to list API keys',
      message: error.message
    });
  }
}

/**
 * Create new API key
 * POST /api/tenant/api-keys
 */
export async function createApiKey(req, res) {
  try {
    if (!req.tenantId) {
      return res.status(404).json({ error: 'No tenant context' });
    }

    const { name, keyType = 'publishable', expiresAt } = req.body;

    const { key, keyData } = await TenantApiKey.create(req.tenantId, {
      name,
      keyType,
      expiresAt
    });

    res.status(201).json({
      success: true,
      key, // Full key - only shown once!
      keyData,
      warning: 'Save this API key now. It will not be shown again.'
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({
      error: 'Failed to create API key',
      message: error.message
    });
  }
}

/**
 * Revoke API key
 * DELETE /api/tenant/api-keys/:keyId
 */
export async function revokeApiKey(req, res) {
  try {
    if (!req.tenantId) {
      return res.status(404).json({ error: 'No tenant context' });
    }

    const { keyId } = req.params;
    const success = await TenantApiKey.revoke(keyId, req.tenantId);

    if (!success) {
      return res.status(404).json({
        error: 'API key not found or already revoked'
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Revoke API key error:', error);
    res.status(500).json({
      error: 'Failed to revoke API key',
      message: error.message
    });
  }
}

// ==================== Team Management ====================

/**
 * List team members
 * GET /api/tenant/team
 */
export async function listTeamMembers(req, res) {
  try {
    if (!req.tenantId) {
      return res.status(404).json({ error: 'No tenant context' });
    }

    const users = await TenantUser.listForTenant(req.tenantId);

    res.json({
      members: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        lastLoginAt: u.last_login_at,
        createdAt: u.created_at
      }))
    });
  } catch (error) {
    console.error('List team error:', error);
    res.status(500).json({
      error: 'Failed to list team members',
      message: error.message
    });
  }
}

/**
 * Invite team member
 * POST /api/tenant/team/invite
 */
export async function inviteTeamMember(req, res) {
  try {
    if (!req.tenantId) {
      return res.status(404).json({ error: 'No tenant context' });
    }

    const { email, name, role = 'admin' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Check team member limit
    const currentMembers = await TenantUser.listForTenant(req.tenantId);
    const maxMembers = req.tenant?.settings?.limits?.teamMembers || 1;

    if (maxMembers !== -1 && currentMembers.length >= maxMembers) {
      return res.status(403).json({
        error: 'Team member limit reached',
        message: `Your plan allows ${maxMembers} team member(s). Please upgrade to add more.`,
        currentPlan: req.tenant?.plan_type
      });
    }

    // Check if email already exists
    const existing = await TenantUser.getByEmail(email, req.tenantId);
    if (existing) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email is already on your team'
      });
    }

    // Create invited user (no password yet)
    const user = await TenantUser.create({
      tenantId: req.tenantId,
      email,
      name,
      role,
      invitedBy: req.userId
    });

    // TODO: Send invitation email

    res.status(201).json({
      success: true,
      member: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: 'invited'
      }
    });
  } catch (error) {
    console.error('Invite member error:', error);
    res.status(500).json({
      error: 'Failed to invite team member',
      message: error.message
    });
  }
}

// ==================== Integrations ====================

/**
 * Get integrations
 * GET /api/tenant/integrations
 */
export async function getIntegrations(req, res) {
  try {
    if (!req.tenantId) {
      return res.status(404).json({ error: 'No tenant context' });
    }

    const integrations = await TenantIntegrations.getForTenant(req.tenantId);

    // Don't expose encrypted keys
    res.json({
      integrations: integrations ? {
        hasAnthropicKey: !!integrations.anthropic_api_key_encrypted,
        usePlatformAiKey: integrations.use_platform_ai_key,
        hasSendgridKey: !!integrations.sendgrid_api_key_encrypted,
        sendgridFromEmail: integrations.sendgrid_from_email,
        notificationEmails: integrations.notification_emails,
        hasSlackToken: !!integrations.slack_token_encrypted,
        slackChannelId: integrations.slack_channel_id,
        slackWorkspaceName: integrations.slack_workspace_name,
        calendlyUrl: integrations.calendly_url,
        webhookUrl: integrations.webhook_url,
        webhookEvents: integrations.webhook_events
      } : null
    });
  } catch (error) {
    console.error('Get integrations error:', error);
    res.status(500).json({
      error: 'Failed to get integrations',
      message: error.message
    });
  }
}

/**
 * Update integrations
 * PUT /api/tenant/integrations
 */
export async function updateIntegrations(req, res) {
  try {
    if (!req.tenantId) {
      return res.status(404).json({ error: 'No tenant context' });
    }

    const {
      anthropicApiKey,
      usePlatformAiKey,
      sendgridApiKey,
      sendgridFromEmail,
      notificationEmails,
      slackToken,
      slackChannelId,
      calendlyUrl,
      webhookUrl,
      webhookEvents
    } = req.body;

    const updates = {};

    // Only update provided fields
    if (anthropicApiKey !== undefined) {
      // TODO: Encrypt before storing
      updates.anthropic_api_key_encrypted = anthropicApiKey;
    }
    if (usePlatformAiKey !== undefined) updates.use_platform_ai_key = usePlatformAiKey;
    if (sendgridApiKey !== undefined) updates.sendgrid_api_key_encrypted = sendgridApiKey;
    if (sendgridFromEmail !== undefined) updates.sendgrid_from_email = sendgridFromEmail;
    if (notificationEmails !== undefined) updates.notification_emails = notificationEmails;
    if (slackToken !== undefined) updates.slack_token_encrypted = slackToken;
    if (slackChannelId !== undefined) updates.slack_channel_id = slackChannelId;
    if (calendlyUrl !== undefined) updates.calendly_url = calendlyUrl;
    if (webhookUrl !== undefined) updates.webhook_url = webhookUrl;
    if (webhookEvents !== undefined) updates.webhook_events = webhookEvents;

    await TenantIntegrations.upsert(req.tenantId, updates);

    res.json({ success: true });
  } catch (error) {
    console.error('Update integrations error:', error);
    res.status(500).json({
      error: 'Failed to update integrations',
      message: error.message
    });
  }
}

// ==================== Platform Admin (Super Admin) ====================

/**
 * List all tenants (platform admin only)
 * GET /api/platform/tenants
 */
export async function listAllTenants(req, res) {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const tenants = await Tenant.listAll(parseInt(limit), parseInt(offset));

    res.json({
      tenants,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: tenants.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('List tenants error:', error);
    res.status(500).json({
      error: 'Failed to list tenants',
      message: error.message
    });
  }
}

/**
 * Update tenant (platform admin only)
 * PUT /api/platform/tenants/:id
 */
export async function updateTenant(req, res) {
  try {
    const { id } = req.params;
    const { name, slug, plan_type, status, custom_domain, manual_api_cost } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    if (plan_type !== undefined) updates.plan_type = plan_type;
    if (status !== undefined) updates.status = status;
    if (custom_domain !== undefined) updates.custom_domain = custom_domain;
    if (manual_api_cost !== undefined) updates.manual_api_cost = manual_api_cost;

    const tenant = await Tenant.update(id, updates);

    if (!tenant) {
      return res.status(404).json({
        error: 'Tenant not found'
      });
    }

    res.json({
      tenant,
      message: 'Tenant updated successfully'
    });
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({
      error: 'Failed to update tenant',
      message: error.message
    });
  }
}

/**
 * Get available plans
 * GET /api/plans
 */
export function getPlans(req, res) {
  res.json({
    plans: Object.entries(PLANS).map(([key, plan]) => ({
      id: key,
      name: plan.name,
      features: plan.features,
      limits: plan.limits
    }))
  });
}

/**
 * Check slug availability
 * GET /api/tenants/check-slug/:slug
 */
export async function checkSlugAvailability(req, res) {
  try {
    const { slug } = req.params;

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.json({
        available: false,
        reason: 'Invalid format. Use only lowercase letters, numbers, and hyphens.'
      });
    }

    const available = await Tenant.isSlugAvailable(slug);

    res.json({
      slug,
      available,
      reason: available ? null : 'This subdomain is already taken.'
    });
  } catch (error) {
    console.error('Check slug error:', error);
    res.status(500).json({
      error: 'Failed to check slug',
      message: error.message
    });
  }
}

export default {
  registerTenant,
  login,
  refreshToken,
  getCurrentTenant,
  updateTenantSettings,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  listTeamMembers,
  inviteTeamMember,
  getIntegrations,
  updateIntegrations,
  listAllTenants,
  updateTenant,
  getPlans,
  checkSlugAvailability
};
