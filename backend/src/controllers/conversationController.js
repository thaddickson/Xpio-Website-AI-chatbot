import Conversation from '../models/Conversation.js';

/**
 * Get conversations for review
 * GET /api/admin/conversations
 */
export async function getConversations(req, res) {
  try {
    const { limit = 50, flaggedOnly, hasLeadOnly, search } = req.query;

    const conversations = await Conversation.getForReview({
      limit: parseInt(limit),
      flaggedOnly: flaggedOnly === 'true',
      hasLeadOnly: hasLeadOnly === 'true',
      search: search || ''
    });

    res.json({ conversations });
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
}

/**
 * Get single conversation by ID
 * GET /api/admin/conversations/:id
 */
export async function getConversation(req, res) {
  try {
    const { id } = req.params;
    const conversation = await Conversation.getById(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ conversation });
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
}

/**
 * Flag a conversation
 * POST /api/admin/conversations/:id/flag
 */
export async function flagConversation(req, res) {
  try {
    const { id } = req.params;
    const { flagged, reason } = req.body;

    const success = await Conversation.setFlag(id, flagged, reason);

    if (!success) {
      return res.status(500).json({ error: 'Failed to flag conversation' });
    }

    res.json({
      message: flagged ? 'Conversation flagged for review' : 'Flag removed',
      flagged
    });
  } catch (error) {
    console.error('Error flagging conversation:', error);
    res.status(500).json({ error: 'Failed to flag conversation' });
  }
}

/**
 * Add review notes to a conversation
 * POST /api/admin/conversations/:id/notes
 */
export async function addNotes(req, res) {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const success = await Conversation.addReviewNotes(id, notes);

    if (!success) {
      return res.status(500).json({ error: 'Failed to add notes' });
    }

    res.json({ message: 'Notes saved successfully' });
  } catch (error) {
    console.error('Error adding notes:', error);
    res.status(500).json({ error: 'Failed to add notes' });
  }
}

/**
 * Get conversation stats
 * GET /api/admin/conversations/stats
 */
export async function getConversationStats(req, res) {
  try {
    const stats = await Conversation.getStats();
    res.json({ stats });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

export default {
  getConversations,
  getConversation,
  flagConversation,
  addNotes,
  getConversationStats
};
