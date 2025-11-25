import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Lazy initialize Supabase client
let supabase = null;
function getSupabase() {
  if (!supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in environment variables');
    }
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }
  return supabase;
}

/**
 * Default tenant ID for backwards compatibility
 */
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Plan configurations with feature flags and limits
 */
export const PLANS = {
  free: {
    name: 'Free',
    features: {
      abTesting: false,
      slackIntegration: false,
      customDomain: false,
      removeWatermark: false,
      apiAccess: false
    },
    limits: {
      monthlyConversations: 100,
      promptSections: 3,
      teamMembers: 1,
      historyRetentionDays: 7
    }
  },
  starter: {
    name: 'Starter',
    features: {
      abTesting: false,
      slackIntegration: true,
      customDomain: false,
      removeWatermark: false,
      apiAccess: false
    },
    limits: {
      monthlyConversations: 1000,
      promptSections: 10,
      teamMembers: 3,
      historyRetentionDays: 30
    }
  },
  pro: {
    name: 'Pro',
    features: {
      abTesting: true,
      slackIntegration: true,
      customDomain: true,
      removeWatermark: true,
      apiAccess: true
    },
    limits: {
      monthlyConversations: 10000,
      promptSections: 50,
      teamMembers: 10,
      historyRetentionDays: 90
    }
  },
  enterprise: {
    name: 'Enterprise',
    features: {
      abTesting: true,
      slackIntegration: true,
      customDomain: true,
      removeWatermark: true,
      apiAccess: true
    },
    limits: {
      monthlyConversations: -1, // unlimited
      promptSections: -1,
      teamMembers: -1,
      historyRetentionDays: -1
    }
  }
};

/**
 * Tenant Model - Handles multi-tenant database operations
 */
class Tenant {
  /**
   * Create a new tenant
   * @param {Object} tenantData - Tenant information
   * @returns {Object} Created tenant with ID
   */
  static async create(tenantData) {
    const {
      name,
      slug,
      planType = 'free',
      customDomain = null,
      settings = null
    } = tenantData;

    // Get default settings for the plan
    const plan = PLANS[planType] || PLANS.free;
    const defaultSettings = {
      branding: {
        primaryColor: '#007bff',
        logoUrl: null,
        chatTitle: name,
        greeting: 'Hi! How can I help you today?'
      },
      features: plan.features,
      limits: plan.limits
    };

    try {
      const { data, error } = await getSupabase()
        .from('tenants')
        .insert([
          {
            name,
            slug: slug.toLowerCase(),
            plan_type: planType,
            custom_domain: customDomain,
            settings: settings || defaultSettings,
            status: planType === 'free' ? 'active' : 'trial',
            trial_ends_at: planType !== 'free' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null
          }
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Database error creating tenant:', error);
      throw new Error(`Failed to create tenant: ${error.message}`);
    }
  }

  /**
   * Get tenant by ID
   * @param {string} id - Tenant ID (UUID)
   * @returns {Object} Tenant data
   */
  static async getById(id) {
    try {
      const { data, error } = await getSupabase()
        .from('tenants')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Database error fetching tenant:', error);
      return null;
    }
  }

  /**
   * Get tenant by slug
   * @param {string} slug - Tenant slug (subdomain)
   * @returns {Object} Tenant data
   */
  static async getBySlug(slug) {
    try {
      const { data, error } = await getSupabase()
        .from('tenants')
        .select('*')
        .eq('slug', slug.toLowerCase())
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Database error fetching tenant by slug:', error);
      return null;
    }
  }

  /**
   * Get tenant by custom domain
   * @param {string} domain - Custom domain
   * @returns {Object} Tenant data
   */
  static async getByDomain(domain) {
    try {
      const { data, error } = await getSupabase()
        .from('tenants')
        .select('*')
        .eq('custom_domain', domain.toLowerCase())
        .eq('domain_verified', true)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Database error fetching tenant by domain:', error);
      return null;
    }
  }

  /**
   * Update tenant
   * @param {string} id - Tenant ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated tenant
   */
  static async update(id, updates) {
    try {
      const { data, error } = await getSupabase()
        .from('tenants')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Database error updating tenant:', error);
      throw new Error(`Failed to update tenant: ${error.message}`);
    }
  }

  /**
   * Update tenant settings (merge with existing)
   * @param {string} id - Tenant ID
   * @param {Object} settingsUpdate - Settings to merge
   * @returns {Object} Updated tenant
   */
  static async updateSettings(id, settingsUpdate) {
    try {
      // First get current settings
      const tenant = await this.getById(id);
      if (!tenant) throw new Error('Tenant not found');

      const currentSettings = tenant.settings || {};
      const mergedSettings = {
        ...currentSettings,
        ...settingsUpdate,
        branding: { ...currentSettings.branding, ...settingsUpdate.branding },
        features: { ...currentSettings.features, ...settingsUpdate.features },
        limits: { ...currentSettings.limits, ...settingsUpdate.limits }
      };

      return await this.update(id, { settings: mergedSettings });
    } catch (error) {
      console.error('Error updating tenant settings:', error);
      throw error;
    }
  }

  /**
   * Check if tenant is within usage limits
   * @param {string} id - Tenant ID
   * @returns {Object} { withinLimits: boolean, limitType: string, current: number, max: number }
   */
  static async checkLimits(id) {
    try {
      const tenant = await this.getById(id);
      if (!tenant) throw new Error('Tenant not found');

      const limits = tenant.settings?.limits || PLANS.free.limits;
      const maxConversations = limits.monthlyConversations;

      // -1 means unlimited
      if (maxConversations === -1) {
        return { withinLimits: true, limitType: null, current: tenant.current_month_conversations, max: -1 };
      }

      if (tenant.current_month_conversations >= maxConversations) {
        return {
          withinLimits: false,
          limitType: 'monthlyConversations',
          current: tenant.current_month_conversations,
          max: maxConversations
        };
      }

      return { withinLimits: true, limitType: null, current: tenant.current_month_conversations, max: maxConversations };
    } catch (error) {
      console.error('Error checking tenant limits:', error);
      // Default to allowing for better UX
      return { withinLimits: true, limitType: null, current: 0, max: -1 };
    }
  }

  /**
   * Increment conversation count for tenant
   * @param {string} id - Tenant ID
   */
  static async incrementConversationCount(id) {
    try {
      const { error } = await getSupabase().rpc('increment_tenant_conversation_count', {
        p_tenant_id: id
      });

      if (error) {
        // Fallback to direct update if RPC doesn't exist
        await getSupabase()
          .from('tenants')
          .update({ current_month_conversations: getSupabase().sql`current_month_conversations + 1` })
          .eq('id', id);
      }
    } catch (error) {
      console.error('Error incrementing conversation count:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Check if slug is available
   * @param {string} slug - Desired slug
   * @returns {boolean} True if available
   */
  static async isSlugAvailable(slug) {
    try {
      const { data, error } = await getSupabase()
        .from('tenants')
        .select('id')
        .eq('slug', slug.toLowerCase())
        .limit(1);

      if (error) throw error;
      return !data || data.length === 0;
    } catch (error) {
      console.error('Error checking slug availability:', error);
      return false;
    }
  }

  /**
   * List all tenants (admin only)
   * @param {number} limit - Number of tenants to return
   * @param {number} offset - Offset for pagination
   * @returns {Array} Array of tenants
   */
  static async listAll(limit = 50, offset = 0) {
    try {
      const { data, error } = await getSupabase()
        .from('tenants')
        .select('id, name, slug, plan_type, status, created_at, current_month_conversations')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Database error listing tenants:', error);
      throw new Error('Failed to list tenants');
    }
  }
}

/**
 * TenantApiKey Model - Handles API key operations
 */
export class TenantApiKey {
  /**
   * Generate a new API key for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {Object} options - Key options
   * @returns {Object} { key: string (full key, only returned once), keyData: Object }
   */
  static async create(tenantId, options = {}) {
    const {
      name = 'Default',
      keyType = 'publishable',
      rateLimitPerMinute = 60,
      expiresAt = null
    } = options;

    // Generate key: pk_live_tenantslug_randomstring
    const tenant = await Tenant.getById(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    const prefix = keyType === 'publishable' ? 'pk' : 'sk';
    const randomPart = crypto.randomBytes(16).toString('hex');
    const fullKey = `${prefix}_live_${tenant.slug}_${randomPart}`;
    const keyPrefix = fullKey.substring(0, 20); // pk_live_tenantslug
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

    try {
      const { data, error } = await getSupabase()
        .from('tenant_api_keys')
        .insert([
          {
            tenant_id: tenantId,
            key_prefix: keyPrefix,
            key_hash: keyHash,
            name,
            key_type: keyType,
            rate_limit_per_minute: rateLimitPerMinute,
            expires_at: expiresAt
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Return full key only on creation (cannot be retrieved later)
      return {
        key: fullKey,
        keyData: {
          id: data.id,
          keyPrefix,
          name,
          keyType,
          rateLimitPerMinute,
          createdAt: data.created_at
        }
      };
    } catch (error) {
      console.error('Database error creating API key:', error);
      throw new Error(`Failed to create API key: ${error.message}`);
    }
  }

  /**
   * Validate an API key and return tenant info
   * @param {string} fullKey - The full API key
   * @returns {Object|null} { tenant, keyData } or null if invalid
   */
  static async validate(fullKey) {
    if (!fullKey || typeof fullKey !== 'string') return null;

    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

    try {
      const { data, error } = await getSupabase()
        .from('tenant_api_keys')
        .select(`
          *,
          tenant:tenants(*)
        `)
        .eq('key_hash', keyHash)
        .eq('is_active', true)
        .single();

      if (error || !data) return null;

      // Check expiration
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return null;
      }

      // Check tenant status
      if (data.tenant.status !== 'active' && data.tenant.status !== 'trial') {
        return null;
      }

      // Update last used
      await getSupabase()
        .from('tenant_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id);

      return {
        tenant: data.tenant,
        keyData: {
          id: data.id,
          keyType: data.key_type,
          rateLimitPerMinute: data.rate_limit_per_minute
        }
      };
    } catch (error) {
      console.error('Error validating API key:', error);
      return null;
    }
  }

  /**
   * Get tenant by API key prefix (for quick lookups)
   * @param {string} keyPrefix - First ~20 chars of the key
   * @returns {Object|null} Tenant data
   */
  static async getTenantByPrefix(keyPrefix) {
    try {
      const { data, error } = await getSupabase()
        .from('tenant_api_keys')
        .select(`
          tenant_id,
          tenant:tenants(*)
        `)
        .eq('key_prefix', keyPrefix)
        .eq('is_active', true)
        .single();

      if (error || !data) return null;
      return data.tenant;
    } catch (error) {
      console.error('Error getting tenant by key prefix:', error);
      return null;
    }
  }

  /**
   * List all API keys for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Array} Array of key metadata (not the actual keys)
   */
  static async listForTenant(tenantId) {
    try {
      const { data, error } = await getSupabase()
        .from('tenant_api_keys')
        .select('id, key_prefix, name, key_type, is_active, created_at, last_used_at, expires_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Database error listing API keys:', error);
      throw new Error('Failed to list API keys');
    }
  }

  /**
   * Revoke an API key
   * @param {string} keyId - Key ID
   * @param {string} tenantId - Tenant ID (for authorization)
   * @returns {boolean} Success
   */
  static async revoke(keyId, tenantId) {
    try {
      const { error } = await getSupabase()
        .from('tenant_api_keys')
        .update({ is_active: false })
        .eq('id', keyId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Database error revoking API key:', error);
      return false;
    }
  }
}

/**
 * TenantUser Model - Handles tenant user operations
 */
export class TenantUser {
  /**
   * Create a new tenant user
   * @param {Object} userData - User data
   * @returns {Object} Created user
   */
  static async create(userData) {
    const {
      tenantId,
      email,
      passwordHash,
      name,
      role = 'admin',
      invitedBy = null
    } = userData;

    try {
      const { data, error } = await getSupabase()
        .from('tenant_users')
        .insert([
          {
            tenant_id: tenantId,
            email: email.toLowerCase(),
            password_hash: passwordHash,
            name,
            role,
            invited_by: invitedBy,
            status: invitedBy ? 'invited' : 'active'
          }
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Database error creating tenant user:', error);
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * Get user by email and tenant
   * @param {string} email - User email
   * @param {string} tenantId - Tenant ID
   * @returns {Object} User data
   */
  static async getByEmail(email, tenantId) {
    try {
      const { data, error } = await getSupabase()
        .from('tenant_users')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('tenant_id', tenantId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Database error fetching user:', error);
      return null;
    }
  }

  /**
   * Get user by ID
   * @param {string} id - User ID
   * @returns {Object} User data with tenant
   */
  static async getById(id) {
    try {
      const { data, error } = await getSupabase()
        .from('tenant_users')
        .select(`
          *,
          tenant:tenants(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Database error fetching user by ID:', error);
      return null;
    }
  }

  /**
   * Update login tracking
   * @param {string} userId - User ID
   */
  static async trackLogin(userId) {
    try {
      await getSupabase()
        .from('tenant_users')
        .update({
          last_login_at: new Date().toISOString(),
          login_count: getSupabase().sql`login_count + 1`
        })
        .eq('id', userId);
    } catch (error) {
      console.error('Error tracking login:', error);
    }
  }

  /**
   * List users for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Array} Array of users
   */
  static async listForTenant(tenantId) {
    try {
      const { data, error } = await getSupabase()
        .from('tenant_users')
        .select('id, email, name, role, status, last_login_at, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Database error listing users:', error);
      throw new Error('Failed to list users');
    }
  }
}

/**
 * TenantIntegrations Model - Handles tenant integrations
 */
export class TenantIntegrations {
  /**
   * Get integrations for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Integration settings
   */
  static async getForTenant(tenantId) {
    try {
      const { data, error } = await getSupabase()
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
      return data;
    } catch (error) {
      console.error('Database error fetching integrations:', error);
      return null;
    }
  }

  /**
   * Create or update integrations for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {Object} integrations - Integration settings
   * @returns {Object} Updated integrations
   */
  static async upsert(tenantId, integrations) {
    try {
      const { data, error } = await getSupabase()
        .from('tenant_integrations')
        .upsert(
          {
            tenant_id: tenantId,
            ...integrations
          },
          {
            onConflict: 'tenant_id'
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Database error upserting integrations:', error);
      throw new Error(`Failed to update integrations: ${error.message}`);
    }
  }
}

export default Tenant;
