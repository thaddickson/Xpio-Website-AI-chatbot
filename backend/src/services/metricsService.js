import { createClient } from '@supabase/supabase-js';

// Lazy initialize Supabase client
let supabase = null;
function getSupabase() {
  if (!supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
    }
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }
  return supabase;
}

/**
 * Metrics Service - Tracks performance metrics for A/B testing
 */
class MetricsService {
  /**
   * Update metrics for a variation based on conversation outcome
   * Called when a conversation ends or a significant event happens
   * @param {string} variationId - Variation UUID
   * @param {Object} metrics - Metrics to increment/update
   */
  static async updateVariationMetrics(variationId, metrics) {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Get or create today's metrics record
      const { data: existing, error: fetchError } = await getSupabase()
        .from('variation_performance_metrics')
        .select('*')
        .eq('variation_id', variationId)
        .eq('metric_date', today)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw fetchError;
      }

      if (existing) {
        // Update existing record
        const updates = {
          conversations_count: existing.conversations_count + (metrics.conversations_count || 0),
          leads_captured: existing.leads_captured + (metrics.leads_captured || 0),
          handoffs_requested: existing.handoffs_requested + (metrics.handoffs_requested || 0),
          calendar_checks: existing.calendar_checks + (metrics.calendar_checks || 0),
          abandoned_conversations: existing.abandoned_conversations + (metrics.abandoned_conversations || 0),
          last_updated: new Date().toISOString()
        };

        // Recalculate rates
        const totalConvs = updates.conversations_count;
        updates.lead_conversion_rate = totalConvs > 0
          ? (updates.leads_captured / totalConvs * 100).toFixed(2)
          : 0;
        updates.handoff_rate = totalConvs > 0
          ? (updates.handoffs_requested / totalConvs * 100).toFixed(2)
          : 0;
        updates.calendar_booking_rate = updates.calendar_checks > 0
          ? ((metrics.calendar_bookings || 0) / updates.calendar_checks * 100).toFixed(2)
          : 0;
        updates.abandonment_rate = totalConvs > 0
          ? (updates.abandoned_conversations / totalConvs * 100).toFixed(2)
          : 0;

        const { error: updateError } = await getSupabase()
          .from('variation_performance_metrics')
          .update(updates)
          .eq('variation_id', variationId)
          .eq('metric_date', today);

        if (updateError) throw updateError;
      } else {
        // Create new record
        const newRecord = {
          variation_id: variationId,
          metric_date: today,
          conversations_count: metrics.conversations_count || 0,
          leads_captured: metrics.leads_captured || 0,
          handoffs_requested: metrics.handoffs_requested || 0,
          calendar_checks: metrics.calendar_checks || 0,
          abandoned_conversations: metrics.abandoned_conversations || 0,
          lead_conversion_rate: 0,
          handoff_rate: 0,
          calendar_booking_rate: 0,
          abandonment_rate: 0
        };

        // Calculate rates for new record
        const totalConvs = newRecord.conversations_count;
        if (totalConvs > 0) {
          newRecord.lead_conversion_rate = (newRecord.leads_captured / totalConvs * 100).toFixed(2);
          newRecord.handoff_rate = (newRecord.handoffs_requested / totalConvs * 100).toFixed(2);
          newRecord.abandonment_rate = (newRecord.abandoned_conversations / totalConvs * 100).toFixed(2);
        }

        const { error: insertError } = await getSupabase()
          .from('variation_performance_metrics')
          .insert([newRecord]);

        if (insertError) throw insertError;
      }

      return true;
    } catch (error) {
      console.error('Error updating variation metrics:', error);
      return false;
    }
  }

  /**
   * Record that a conversation started with a specific variation
   * @param {string} conversationId - Conversation ID
   * @param {Object} variationAssignments - Map of section IDs to variation IDs
   */
  static async recordConversationStart(conversationId, variationAssignments) {
    try {
      // Track which variations were used
      for (const [sectionId, variationId] of Object.entries(variationAssignments)) {
        if (!variationId) continue; // Skip if using base prompt

        // Update metrics: +1 conversation
        await this.updateVariationMetrics(variationId, {
          conversations_count: 1
        });
      }

      // Mark conversation as using test variations
      await getSupabase()
        .from('conversations')
        .update({ uses_test_variations: true })
        .eq('conversation_id', conversationId);

      return true;
    } catch (error) {
      console.error('Error recording conversation start:', error);
      return false;
    }
  }

  /**
   * Record that a lead was captured in a conversation using variations
   * @param {string} conversationId - Conversation ID
   */
  static async recordLeadCaptured(conversationId) {
    try {
      // Get all variations used in this conversation
      const { data: assignments, error } = await getSupabase()
        .from('conversation_test_assignments')
        .select('variation_id')
        .eq('conversation_id', conversationId);

      if (error) throw error;

      // Update metrics for each variation: +1 lead
      for (const assignment of assignments) {
        await this.updateVariationMetrics(assignment.variation_id, {
          leads_captured: 1
        });
      }

      return true;
    } catch (error) {
      console.error('Error recording lead captured:', error);
      return false;
    }
  }

  /**
   * Record that a handoff was requested
   * @param {string} conversationId - Conversation ID
   */
  static async recordHandoff(conversationId) {
    try {
      const { data: assignments, error } = await getSupabase()
        .from('conversation_test_assignments')
        .select('variation_id')
        .eq('conversation_id', conversationId);

      if (error) throw error;

      for (const assignment of assignments) {
        await this.updateVariationMetrics(assignment.variation_id, {
          handoffs_requested: 1
        });
      }

      return true;
    } catch (error) {
      console.error('Error recording handoff:', error);
      return false;
    }
  }

  /**
   * Record that calendar was checked
   * @param {string} conversationId - Conversation ID
   */
  static async recordCalendarCheck(conversationId) {
    try {
      const { data: assignments, error } = await getSupabase()
        .from('conversation_test_assignments')
        .select('variation_id')
        .eq('conversation_id', conversationId);

      if (error) throw error;

      for (const assignment of assignments) {
        await this.updateVariationMetrics(assignment.variation_id, {
          calendar_checks: 1
        });
      }

      return true;
    } catch (error) {
      console.error('Error recording calendar check:', error);
      return false;
    }
  }

  /**
   * Record that a conversation was abandoned
   * @param {string} conversationId - Conversation ID
   */
  static async recordAbandonment(conversationId) {
    try {
      const { data: assignments, error } = await getSupabase()
        .from('conversation_test_assignments')
        .select('variation_id')
        .eq('conversation_id', conversationId);

      if (error) throw error;

      for (const assignment of assignments) {
        await this.updateVariationMetrics(assignment.variation_id, {
          abandoned_conversations: 1
        });
      }

      return true;
    } catch (error) {
      console.error('Error recording abandonment:', error);
      return false;
    }
  }
}

export default MetricsService;
