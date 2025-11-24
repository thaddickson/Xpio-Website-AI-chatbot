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
 * PromptVariation Model - Handles A/B testing of prompt variations
 */
class PromptVariation {
  /**
   * Create a new variation for a prompt section
   * @param {Object} data - Variation data
   * @returns {Object} Created variation
   */
  static async create(data) {
    try {
      const { data: variation, error } = await getSupabase()
        .from('prompt_variations')
        .insert([{
          prompt_section_id: data.prompt_section_id,
          variation_name: data.variation_name,
          content: data.content,
          is_active: data.is_active || false,
          traffic_percentage: data.traffic_percentage || 0,
          created_by: data.created_by || 'admin',
          notes: data.notes || null
        }])
        .select()
        .single();

      if (error) throw error;
      console.log(`✅ Created variation: ${data.variation_name}`);
      return variation;
    } catch (error) {
      console.error('Error creating variation:', error);
      throw error;
    }
  }

  /**
   * Get all variations for a prompt section
   * @param {string} promptSectionId - UUID of the prompt section
   * @returns {Array} Array of variations
   */
  static async getByPromptSection(promptSectionId) {
    try {
      const { data, error } = await getSupabase()
        .from('prompt_variations')
        .select(`
          *,
          variation_performance_metrics (
            conversations_count,
            leads_captured,
            lead_conversion_rate,
            handoff_rate,
            calendar_booking_rate
          )
        `)
        .eq('prompt_section_id', promptSectionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching variations:', error);
      return [];
    }
  }

  /**
   * Get active variations for A/B testing
   * @returns {Array} Array of active variations
   */
  static async getActive() {
    try {
      const { data, error } = await getSupabase()
        .from('prompt_variations')
        .select('*')
        .eq('is_active', true)
        .gt('traffic_percentage', 0);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching active variations:', error);
      return [];
    }
  }

  /**
   * Select a variation for a conversation based on traffic percentage
   * Uses weighted random selection
   * @param {string} promptSectionId - UUID of the prompt section
   * @returns {Object|null} Selected variation or null if using base prompt
   */
  static async selectVariationForConversation(promptSectionId) {
    try {
      const variations = await this.getByPromptSection(promptSectionId);
      const activeVariations = variations.filter(v => v.is_active && v.traffic_percentage > 0);

      if (activeVariations.length === 0) {
        return null; // Use base prompt
      }

      // Calculate total traffic allocated to variations
      const totalTraffic = activeVariations.reduce((sum, v) => sum + v.traffic_percentage, 0);

      // If less than 100%, there's a chance to use base prompt
      const random = Math.random() * 100;

      if (random > totalTraffic) {
        return null; // Use base prompt (control group)
      }

      // Weighted random selection among active variations
      let cumulativeWeight = 0;
      for (const variation of activeVariations) {
        cumulativeWeight += variation.traffic_percentage;
        if (random <= cumulativeWeight) {
          return variation;
        }
      }

      return activeVariations[0]; // Fallback to first variation
    } catch (error) {
      console.error('Error selecting variation:', error);
      return null; // Fall back to base prompt on error
    }
  }

  /**
   * Record which variation was used for a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} promptSectionId - Prompt section ID
   * @param {string} variationId - Variation ID
   * @returns {boolean} Success
   */
  static async recordAssignment(conversationId, promptSectionId, variationId) {
    try {
      const { error } = await getSupabase()
        .from('conversation_test_assignments')
        .insert([{
          conversation_id: conversationId,
          prompt_section_id: promptSectionId,
          variation_id: variationId
        }]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error recording variation assignment:', error);
      return false;
    }
  }

  /**
   * Update a variation
   * @param {string} id - Variation ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated variation
   */
  static async update(id, updates) {
    try {
      const { data, error } = await getSupabase()
        .from('prompt_variations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      console.log(`✅ Updated variation: ${id}`);
      return data;
    } catch (error) {
      console.error('Error updating variation:', error);
      throw error;
    }
  }

  /**
   * Delete a variation
   * @param {string} id - Variation ID
   * @returns {boolean} Success
   */
  static async delete(id) {
    try {
      const { error } = await getSupabase()
        .from('prompt_variations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      console.log(`✅ Deleted variation: ${id}`);
      return true;
    } catch (error) {
      console.error('Error deleting variation:', error);
      throw error;
    }
  }

  /**
   * Get performance comparison across all variations of a prompt section
   * @param {string} promptSectionId - Prompt section ID
   * @param {number} days - Number of days to look back
   * @returns {Object} Performance comparison data
   */
  static async getPerformanceComparison(promptSectionId, days = 30) {
    try {
      const variations = await this.getByPromptSection(promptSectionId);

      // Get metrics for each variation from the last N days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const performanceData = await Promise.all(
        variations.map(async (variation) => {
          const { data: metrics, error } = await getSupabase()
            .from('variation_performance_metrics')
            .select('*')
            .eq('variation_id', variation.id)
            .gte('metric_date', cutoffDate.toISOString().split('T')[0])
            .order('metric_date', { ascending: true });

          if (error) throw error;

          // Calculate aggregates
          const totalConversations = metrics.reduce((sum, m) => sum + m.conversations_count, 0);
          const totalLeads = metrics.reduce((sum, m) => sum + m.leads_captured, 0);
          const avgConversionRate = totalConversations > 0
            ? (totalLeads / totalConversations * 100).toFixed(2)
            : 0;

          return {
            variation_id: variation.id,
            variation_name: variation.variation_name,
            is_active: variation.is_active,
            traffic_percentage: variation.traffic_percentage,
            total_conversations: totalConversations,
            total_leads: totalLeads,
            conversion_rate: parseFloat(avgConversionRate),
            metrics_by_date: metrics,
            created_at: variation.created_at
          };
        })
      );

      // Also get base prompt (control) performance
      // This would be conversations that didn't use any variation

      return {
        prompt_section_id: promptSectionId,
        date_range_days: days,
        variations: performanceData,
        generated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting performance comparison:', error);
      throw error;
    }
  }

  /**
   * Promote a variation to be the new base prompt
   * This "graduates" a winning variation
   * @param {string} variationId - Variation ID to promote
   * @param {string} promptSectionId - Prompt section ID
   * @returns {boolean} Success
   */
  static async promoteToBase(variationId, promptSectionId) {
    try {
      // Get the variation content
      const { data: variation, error: varError } = await getSupabase()
        .from('prompt_variations')
        .select('content, variation_name')
        .eq('id', variationId)
        .single();

      if (varError) throw varError;

      // Update the base prompt section with this content
      const { error: updateError } = await getSupabase()
        .from('prompts')
        .update({
          content: variation.content,
          description: `Promoted from variation: ${variation.variation_name}`,
          version: getSupabase().raw('version + 1')
        })
        .eq('id', promptSectionId);

      if (updateError) throw updateError;

      // Deactivate all variations for this section
      const { error: deactivateError } = await getSupabase()
        .from('prompt_variations')
        .update({ is_active: false, traffic_percentage: 0 })
        .eq('prompt_section_id', promptSectionId);

      if (deactivateError) throw deactivateError;

      console.log(`✅ Promoted variation ${variationId} to base prompt`);
      return true;
    } catch (error) {
      console.error('Error promoting variation:', error);
      throw error;
    }
  }
}

export default PromptVariation;
