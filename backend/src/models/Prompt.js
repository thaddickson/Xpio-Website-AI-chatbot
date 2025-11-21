import { createClient } from '@supabase/supabase-js';

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
 */
class Prompt {
  /**
   * Get all active prompt sections in order
   * @returns {Array} Array of prompt sections
   */
  static async getAllActive() {
    try {
      const { data, error } = await getSupabase()
        .from('prompt_sections')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Database error fetching active prompts:', error);
      throw new Error('Failed to fetch prompts');
    }
  }

  /**
   * Get all prompt sections (including inactive)
   * @returns {Array} Array of all prompt sections
   */
  static async getAll() {
    try {
      const { data, error } = await getSupabase()
        .from('prompt_sections')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Database error fetching all prompts:', error);
      throw new Error('Failed to fetch prompts');
    }
  }

  /**
   * Get a single prompt section by slug
   * @param {string} slug - Section slug
   * @returns {Object} Prompt section
   */
  static async getBySlug(slug) {
    try {
      const { data, error } = await getSupabase()
        .from('prompt_sections')
        .select('*')
        .eq('slug', slug)
        .single();

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
   * @returns {Object} Created section
   */
  static async create(sectionData) {
    try {
      const { data, error } = await getSupabase()
        .from('prompt_sections')
        .insert([sectionData])
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
   * @returns {Object} Updated section
   */
  static async update(id, updates) {
    try {
      const { data, error } = await getSupabase()
        .from('prompt_sections')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

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
   * @returns {boolean} Success status
   */
  static async delete(id) {
    try {
      const { error } = await getSupabase()
        .from('prompt_sections')
        .delete()
        .eq('id', id);

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
   * Build complete system prompt from active sections
   * @returns {string} Complete system prompt
   */
  static async buildSystemPrompt() {
    try {
      const sections = await this.getAllActive();

      if (sections.length === 0) {
        console.warn('⚠️  No active prompt sections found, using fallback');
        return 'You are a helpful assistant for Xpio Health.';
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
}

export default Prompt;
