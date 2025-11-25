import { createClient } from '@supabase/supabase-js';
import { DEFAULT_TENANT_ID } from './Tenant.js';

// Lazy initialize Supabase client
let supabase = null;
export function getSupabase() {
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
 * Lead Model - Handles database operations for leads
 */
class Lead {
  /**
   * Create a new lead in the database
   * @param {Object} leadData - Lead information
   * @param {string} tenantId - Tenant ID (optional, defaults to DEFAULT_TENANT_ID)
   * @returns {Object} Created lead with ID
   */
  static async create(leadData, tenantId = null) {
    const {
      conversationId,
      name,
      email,
      phone,
      organization,
      role,
      organization_size,
      primary_interest,
      current_systems,
      timeline,
      budget_range,
      pain_points,
      conversation_summary,
      qualification_score,
      next_steps,
      conversationHistory,
      source = 'website_chatbot'
    } = leadData;

    try {
      const { data, error } = await getSupabase()
        .from('leads')
        .insert([
          {
            tenant_id: tenantId || DEFAULT_TENANT_ID,
            conversation_id: conversationId,
            name,
            email,
            phone: phone || null,
            organization: organization || null,
            role: role || null,
            organization_size: organization_size || null,
            primary_interest,
            current_systems: current_systems || null,
            timeline: timeline || null,
            budget_range: budget_range || null,
            pain_points: pain_points || null,
            conversation_summary,
            qualification_score,
            next_steps: next_steps || null,
            conversation_history: conversationHistory,
            source
          }
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Database error creating lead:', error);
      throw new Error('Failed to save lead to database');
    }
  }

  /**
   * Get lead by ID
   * @param {string} id - Lead ID
   * @returns {Object} Lead data
   */
  static async getById(id) {
    try {
      const { data, error } = await getSupabase()
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Database error fetching lead:', error);
      throw new Error('Failed to fetch lead');
    }
  }

  /**
   * Check if email already exists for a tenant
   * @param {string} email - Email address
   * @param {string} tenantId - Tenant ID (optional)
   * @returns {boolean} True if email exists
   */
  static async emailExists(email, tenantId = null) {
    try {
      let query = getSupabase()
        .from('leads')
        .select('id')
        .eq('email', email.toLowerCase());

      // If tenantId provided, scope to tenant
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query.limit(1);

      if (error) throw error;
      return data && data.length > 0;
    } catch (error) {
      console.error('Database error checking email:', error);
      return false;
    }
  }

  /**
   * Mark lead as followed up
   * @param {string} id - Lead ID
   * @returns {boolean} Success status
   */
  static async markFollowedUp(id) {
    try {
      const { error } = await getSupabase()
        .from('leads')
        .update({
          followed_up: true,
          followed_up_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Database error marking lead as followed up:', error);
      return false;
    }
  }

  /**
   * Get all leads (with pagination), optionally filtered by tenant
   * @param {number} limit - Number of leads to return
   * @param {number} offset - Offset for pagination
   * @param {string} tenantId - Tenant ID (optional, if null returns all)
   * @returns {Array} Array of leads
   */
  static async getAll(limit = 50, offset = 0, tenantId = null) {
    try {
      let query = getSupabase()
        .from('leads')
        .select('*');

      // If tenantId provided, scope to tenant
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Database error fetching leads:', error);
      throw new Error('Failed to fetch leads');
    }
  }

  /**
   * Get leads by qualification score
   * @param {string} score - 'hot', 'warm', or 'cold'
   * @returns {Array} Array of leads
   */
  static async getByQualificationScore(score) {
    try {
      const { data, error } = await getSupabase()
        .from('leads')
        .select('*')
        .eq('qualification_score', score)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Database error fetching leads by score:', error);
      throw new Error('Failed to fetch leads');
    }
  }
}

/**
 * Initialize database - Test connection to Supabase
 */
export async function initializeDatabase() {
  try {
    // Test connection by querying the leads table
    const { error } = await getSupabase()
      .from('leads')
      .select('count')
      .limit(1);

    if (error) throw error;
    console.log('✓ Supabase connection verified successfully');
    return true;
  } catch (error) {
    console.error('Failed to connect to Supabase:', error);
    throw error;
  }
}

export default Lead;
