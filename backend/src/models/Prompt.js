import { createClient } from '@supabase/supabase-js';
import { DEFAULT_TENANT_ID } from './Tenant.js';

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
 * Prompt Model - Manages chatbot knowledge base sections
 * All methods now support multi-tenancy with optional tenantId parameter
 */
class Prompt {
  /**
   * Get all active prompt sections in order for a tenant
   * @param {string} tenantId - Tenant ID (optional, defaults to DEFAULT_TENANT_ID)
   * @returns {Array} Array of prompt sections
   */
  static async getAllActive(tenantId = null) {
    try {
      let query = getSupabase()
        .from('prompt_sections')
        .select('*')
        .eq('is_active', true);

      // Scope to tenant
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query.order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Database error fetching active prompts:', error);
      throw new Error('Failed to fetch prompts');
    }
  }

  /**
   * Get all prompt sections (including inactive) for a tenant
   * @param {string} tenantId - Tenant ID (optional)
   * @returns {Array} Array of all prompt sections
   */
  static async getAll(tenantId = null) {
    try {
      let query = getSupabase()
        .from('prompt_sections')
        .select('*');

      // Scope to tenant
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query.order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Database error fetching all prompts:', error);
      throw new Error('Failed to fetch prompts');
    }
  }

  /**
   * Get a single prompt section by slug for a tenant
   * @param {string} slug - Section slug
   * @param {string} tenantId - Tenant ID (optional)
   * @returns {Object} Prompt section
   */
  static async getBySlug(slug, tenantId = null) {
    try {
      let query = getSupabase()
        .from('prompt_sections')
        .select('*')
        .eq('slug', slug);

      // Scope to tenant
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Database error fetching prompt by slug:', error);
      throw new Error('Failed to fetch prompt');
    }
  }

  /**
   * Create a new prompt section
   * @param {Object} sectionData - Section data
   * @param {string} tenantId - Tenant ID (optional, defaults to DEFAULT_TENANT_ID)
   * @returns {Object} Created section
   */
  static async create(sectionData, tenantId = null) {
    try {
      const { data, error } = await getSupabase()
        .from('prompt_sections')
        .insert([{
          ...sectionData,
          tenant_id: tenantId || DEFAULT_TENANT_ID
        }])
        .select()
        .single();

      if (error) throw error;
      console.log(`✓ Created new prompt section: ${sectionData.slug}`);
      return data;
    } catch (error) {
      console.error('Database error creating prompt:', error);
      throw new Error('Failed to create prompt');
    }
  }

  /**
   * Update a prompt section
   * @param {string} id - Section ID
   * @param {Object} updates - Fields to update
   * @param {string} tenantId - Tenant ID (optional, for authorization)
   * @returns {Object} Updated section
   */
  static async update(id, updates, tenantId = null) {
    try {
      let query = getSupabase()
        .from('prompt_sections')
        .update(updates)
        .eq('id', id);

      // Scope to tenant for authorization
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query.select().single();

      if (error) throw error;
      console.log(`✓ Updated prompt section: ${id}`);
      return data;
    } catch (error) {
      console.error('Database error updating prompt:', error);
      throw new Error('Failed to update prompt');
    }
  }

  /**
   * Delete a prompt section
   * @param {string} id - Section ID
   * @param {string} tenantId - Tenant ID (optional, for authorization)
   * @returns {boolean} Success status
   */
  static async delete(id, tenantId = null) {
    try {
      let query = getSupabase()
        .from('prompt_sections')
        .delete()
        .eq('id', id);

      // Scope to tenant for authorization
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { error } = await query;

      if (error) throw error;
      console.log(`✓ Deleted prompt section: ${id}`);
      return true;
    } catch (error) {
      console.error('Database error deleting prompt:', error);
      throw new Error('Failed to delete prompt');
    }
  }

  /**
   * Get version history for a section
   * @param {string} sectionId - Section ID
   * @returns {Array} Version history
   */
  static async getVersionHistory(sectionId) {
    try {
      const { data, error } = await getSupabase()
        .from('prompt_versions')
        .select('*')
        .eq('section_id', sectionId)
        .order('version', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Database error fetching version history:', error);
      return [];
    }
  }

  /**
   * Build complete system prompt from active sections for a tenant
   * @param {string} tenantId - Tenant ID (optional)
   * @returns {string} Complete system prompt
   */
  static async buildSystemPrompt(tenantId = null) {
    try {
      const sections = await this.getAllActive(tenantId);

      if (sections.length === 0) {
        console.warn('⚠️  No active prompt sections found, using fallback');
        return 'You are a helpful assistant.';
      }

      // Combine all active sections in order
      const prompt = sections
        .map(section => section.content)
        .join('\n\n---\n\n');

      console.log(`✓ Built system prompt from ${sections.length} sections`);
      return prompt;
    } catch (error) {
      console.error('Error building system prompt:', error);
      throw error;
    }
  }

  /**
   * Build system prompt with A/B test variations for a tenant
   * @param {string} conversationId - Conversation ID for tracking
   * @param {string} tenantId - Tenant ID (optional)
   * @returns {Object} { prompt: string, variationAssignments: Object }
   */
  static async buildSystemPromptWithVariations(conversationId, tenantId = null) {
    try {
      const sections = await this.getAllActive(tenantId);

      if (sections.length === 0) {
        console.warn('⚠️  No active prompt sections found, using fallback');
        return {
          prompt: 'You are a helpful assistant.',
          variationAssignments: {}
        };
      }

      // Import PromptVariation model
      const PromptVariation = (await import('./PromptVariation.js')).default;

      const variationAssignments = {};
      const promptParts = [];

      // For each section, check if there are active variations
      for (const section of sections) {
        const selectedVariation = await PromptVariation.selectVariationForConversation(section.id, tenantId);

        if (selectedVariation) {
          // Use variation content
          promptParts.push(selectedVariation.content);
          variationAssignments[section.id] = selectedVariation.id;

          // Record the assignment
          await PromptVariation.recordAssignment(conversationId, section.id, selectedVariation.id, tenantId);

          console.log(`🧪 Using variation "${selectedVariation.variation_name}" for section "${section.name}"`);
        } else {
          // Use base prompt content (control group)
          promptParts.push(section.content);
        }
      }

      const prompt = promptParts.join('\n\n---\n\n');

      return {
        prompt,
        variationAssignments,
        usedVariations: Object.keys(variationAssignments).length > 0
      };
    } catch (error) {
      console.error('Error building system prompt with variations:', error);
      // Fallback to regular prompt on error
      return {
        prompt: await this.buildSystemPrompt(tenantId),
        variationAssignments: {},
        usedVariations: false
      };
    }
  }
}

export default Prompt;
