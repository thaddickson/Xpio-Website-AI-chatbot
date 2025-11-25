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
 * Conversation Model - Handles database operations for ALL conversations
 */
class Conversation {
  /**
   * Create a new conversation in the database
   * @param {string} conversationId - Unique conversation identifier
   * @param {Object} metadata - Optional metadata (user_agent, ip_address, referrer)
   * @param {Object} firstMessage - Optional first message to include (prevents race condition)
   * @returns {Object} Created conversation
   */
  static async create(conversationId, metadata = {}, firstMessage = null) {
    try {
      // If first message provided, include it in the initial messages array
      const initialMessages = firstMessage ? [{
        ...firstMessage,
        timestamp: new Date().toISOString()
      }] : [];

      const { data, error } = await getSupabase()
        .from('conversations')
        .insert([
          {
            conversation_id: conversationId,
            user_agent: metadata.user_agent || null,
            ip_address: metadata.ip_address || null,
            referrer: metadata.referrer || null,
            messages: initialMessages,
            message_count: initialMessages.length,
            status: 'active'
          }
        ])
        .select()
        .single();

      if (error) throw error;
      console.log(`📝 Conversation logged to database: ${conversationId}${firstMessage ? ' (with first message)' : ''}`);
      return data;
    } catch (error) {
      // If conversation already exists (unique constraint), that's okay
      if (error.code === '23505') {
        console.log(`Conversation ${conversationId} already exists in database`);
        return null;
      }
      console.error('Database error creating conversation:', error);
      // Don't throw - we don't want conversation logging to break the chat
      return null;
    }
  }

  /**
   * Add a message to an existing conversation
   * @param {string} conversationId - Unique conversation identifier
   * @param {Object} message - Message object with role and content
   * @returns {boolean} Success status
   */
  static async addMessage(conversationId, message) {
    try {
      // First, get the current conversation
      const { data: current, error: fetchError } = await getSupabase()
        .from('conversations')
        .select('messages, message_count')
        .eq('conversation_id', conversationId)
        .single();

      if (fetchError) throw fetchError;

      // Add new message to the array
      const messages = current.messages || [];
      messages.push({
        ...message,
        timestamp: new Date().toISOString()
      });

      // Update the conversation
      const { error: updateError } = await getSupabase()
        .from('conversations')
        .update({
          messages: messages,
          message_count: messages.length,
          last_activity: new Date().toISOString()
        })
        .eq('conversation_id', conversationId);

      if (updateError) throw updateError;
      return true;
    } catch (error) {
      console.error('Database error adding message to conversation:', error);
      // Don't throw - we don't want logging to break the chat
      return false;
    }
  }

  /**
   * Mark conversation as having captured a lead
   * @param {string} conversationId - Unique conversation identifier
   * @param {string} leadId - UUID of the captured lead
   * @returns {boolean} Success status
   */
  static async markLeadCaptured(conversationId, leadId) {
    try {
      const { error } = await getSupabase()
        .from('conversations')
        .update({
          lead_captured: true,
          lead_id: leadId,
          status: 'ended'
        })
        .eq('conversation_id', conversationId);

      if (error) throw error;
      console.log(`✓ Conversation ${conversationId} marked with lead ${leadId}`);
      return true;
    } catch (error) {
      console.error('Database error marking lead captured:', error);
      return false;
    }
  }

  /**
   * Mark conversation as ended
   * @param {string} conversationId - Unique conversation identifier
   * @returns {boolean} Success status
   */
  static async markEnded(conversationId) {
    try {
      const { error } = await getSupabase()
        .from('conversations')
        .update({
          status: 'ended',
          last_activity: new Date().toISOString()
        })
        .eq('conversation_id', conversationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Database error marking conversation ended:', error);
      return false;
    }
  }

  /**
   * Get conversation by ID
   * @param {string} conversationId - Unique conversation identifier
   * @returns {Object} Conversation data
   */
  static async getById(conversationId) {
    try {
      const { data, error } = await getSupabase()
        .from('conversations')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Database error fetching conversation:', error);
      return null;
    }
  }

  /**
   * Get recent conversations with stats
   * @param {number} limit - Number of conversations to return
   * @returns {Array} Array of conversations
   */
  static async getRecent(limit = 50) {
    try {
      const { data, error } = await getSupabase()
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Database error fetching conversations:', error);
      return [];
    }
  }

  /**
   * Mark conversation as handed off to human
   * @param {string} conversationId - Unique conversation identifier
   * @param {string} slackThreadTs - Slack thread timestamp for replies
   * @param {string} handedOffTo - Name of person handling it
   * @returns {boolean} Success status
   */
  static async markHandedOff(conversationId, slackThreadTs, handedOffTo = 'Xpio Team') {
    try {
      const { error } = await getSupabase()
        .from('conversations')
        .update({
          is_handed_off: true,
          slack_thread_ts: slackThreadTs,
          handed_off_at: new Date().toISOString(),
          handed_off_to: handedOffTo
        })
        .eq('conversation_id', conversationId);

      if (error) throw error;
      console.log(`🤝 Conversation ${conversationId} handed off to ${handedOffTo}`);
      return true;
    } catch (error) {
      console.error('Database error marking handoff:', error);
      return false;
    }
  }

  /**
   * Get handoff state for a conversation
   * @param {string} conversationId - Unique conversation identifier
   * @returns {Object} Handoff state
   */
  static async getHandoffState(conversationId) {
    try {
      const { data, error } = await getSupabase()
        .from('conversations')
        .select('is_handed_off, slack_thread_ts, handed_off_to')
        .eq('conversation_id', conversationId)
        .single();

      if (error) throw error;
      return data || { is_handed_off: false, slack_thread_ts: null, handed_off_to: null };
    } catch (error) {
      console.error('Database error getting handoff state:', error);
      return { is_handed_off: false, slack_thread_ts: null, handed_off_to: null };
    }
  }

  /**
   * Clear handoff state - allow AI to resume conversation
   * @param {string} conversationId - Unique conversation identifier
   * @returns {boolean} Success status
   */
  static async clearHandoff(conversationId) {
    try {
      const { error } = await getSupabase()
        .from('conversations')
        .update({
          is_handed_off: false,
          handed_off_to: null
          // Keep slack_thread_ts for history
        })
        .eq('conversation_id', conversationId);

      if (error) throw error;
      console.log(`🔄 Conversation ${conversationId} handoff cleared - AI resumed`);
      return true;
    } catch (error) {
      console.error('Database error clearing handoff:', error);
      return false;
    }
  }

  /**
   * Get recent conversations for review with filtering
   * @param {Object} options - Filter options
   * @returns {Array} Array of conversations
   */
  static async getForReview(options = {}) {
    const { limit = 50, flaggedOnly = false, hasLeadOnly = false, search = '' } = options;

    try {
      let query = getSupabase()
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: false });

      if (flaggedOnly) {
        query = query.eq('flagged', true);
      }

      if (hasLeadOnly) {
        query = query.eq('lead_captured', true);
      }

      query = query.limit(limit);

      const { data, error } = await query;

      if (error) throw error;

      // If search term provided, filter in memory (for message content search)
      let results = data || [];
      if (search) {
        const searchLower = search.toLowerCase();
        results = results.filter(c => {
          const messages = c.messages || [];
          return messages.some(m =>
            m.content && m.content.toLowerCase().includes(searchLower)
          );
        });
      }

      // Fetch variation assignments for these conversations
      if (results.length > 0) {
        const conversationIds = results.map(c => c.conversation_id);
        const { data: assignments, error: assignmentError } = await getSupabase()
          .from('conversation_test_assignments')
          .select(`
            conversation_id,
            prompt_variations (
              id,
              variation_name
            )
          `)
          .in('conversation_id', conversationIds);

        if (!assignmentError && assignments) {
          // Create a map of conversation_id -> variation names
          const variationMap = {};
          assignments.forEach(a => {
            if (!variationMap[a.conversation_id]) {
              variationMap[a.conversation_id] = [];
            }
            if (a.prompt_variations) {
              variationMap[a.conversation_id].push(a.prompt_variations.variation_name);
            }
          });

          // Add variation info to each conversation
          results = results.map(conv => ({
            ...conv,
            variation_names: variationMap[conv.conversation_id] || [],
            has_variation: (variationMap[conv.conversation_id] || []).length > 0
          }));
        }
      }

      return results;
    } catch (error) {
      console.error('Database error fetching conversations for review:', error);
      return [];
    }
  }

  /**
   * Flag a conversation for review
   * @param {string} conversationId - Unique conversation identifier
   * @param {boolean} flagged - Flag status
   * @param {string} flagReason - Reason for flagging
   * @returns {boolean} Success status
   */
  static async setFlag(conversationId, flagged, flagReason = '') {
    try {
      const { error } = await getSupabase()
        .from('conversations')
        .update({
          flagged: flagged,
          flag_reason: flagReason,
          flagged_at: flagged ? new Date().toISOString() : null
        })
        .eq('conversation_id', conversationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Database error flagging conversation:', error);
      return false;
    }
  }

  /**
   * Add review notes to a conversation
   * @param {string} conversationId - Unique conversation identifier
   * @param {string} notes - Review notes
   * @returns {boolean} Success status
   */
  static async addReviewNotes(conversationId, notes) {
    try {
      const { error } = await getSupabase()
        .from('conversations')
        .update({
          review_notes: notes,
          reviewed_at: new Date().toISOString()
        })
        .eq('conversation_id', conversationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Database error adding review notes:', error);
      return false;
    }
  }

  /**
   * Get conversation statistics
   * @returns {Object} Stats about conversations
   */
  static async getStats() {
    try {
      const { data, error } = await getSupabase()
        .from('conversations')
        .select('status, lead_captured, message_count, is_handed_off');

      if (error) throw error;

      const stats = {
        total: data.length,
        active: data.filter(c => c.status === 'active').length,
        ended: data.filter(c => c.status === 'ended').length,
        abandoned: data.filter(c => c.status === 'abandoned').length,
        withLeads: data.filter(c => c.lead_captured).length,
        withoutLeads: data.filter(c => !c.lead_captured).length,
        handoffsRequested: data.filter(c => c.is_handed_off).length,
        avgMessages: data.length > 0
          ? (data.reduce((sum, c) => sum + c.message_count, 0) / data.length).toFixed(1)
          : 0
      };

      return stats;
    } catch (error) {
      console.error('Database error getting conversation stats:', error);
      return {
        total: 0,
        active: 0,
        ended: 0,
        abandoned: 0,
        withLeads: 0,
        withoutLeads: 0,
        handoffsRequested: 0,
        avgMessages: 0
      };
    }
  }
}

export default Conversation;
