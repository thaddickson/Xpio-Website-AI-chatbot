import Conversation from '../models/Conversation.js';

// In-memory storage for pending messages to visitors
// In production, use Redis or similar
const pendingMessages = new Map();

/**
 * Handle Slack events (messages from your team)
 * POST /api/slack/events
 */
export async function handleSlackEvents(req, res) {
  try {
    const { type, challenge, event } = req.body;

    // Slack URL verification
    if (type === 'url_verification') {
      return res.json({ challenge });
    }

    // Handle message events
    if (type === 'event_callback' && event?.type === 'message') {
      // Ignore bot messages and message edits
      if (event.bot_id || event.subtype) {
        return res.json({ ok: true });
      }

      // Check if this message is in a thread
      if (event.thread_ts) {
        console.log(`💬 Slack reply received in thread: ${event.thread_ts}`);

        // Find the conversation with this thread_ts
        // We need to query the database to find which conversation this thread belongs to
        const conversationId = await findConversationByThreadTs(event.thread_ts);

        if (conversationId) {
          // Store the message for the visitor to poll
          if (!pendingMessages.has(conversationId)) {
            pendingMessages.set(conversationId, []);
          }

          pendingMessages.get(conversationId).push({
            text: event.text,
            user: event.user,
            timestamp: event.ts,
            threadTs: event.thread_ts
          });

          console.log(`✓ Message queued for visitor in conversation: ${conversationId}`);

          // Add the human message to conversation history
          await Conversation.addMessage(conversationId, {
            role: 'assistant', // Human responses are shown as assistant messages
            content: event.text,
            from: 'human',
            slack_user: event.user
          });
        }
      }

      return res.json({ ok: true });
    }

    // Default response
    res.json({ ok: true });
  } catch (error) {
    console.error('Error handling Slack event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Poll for new messages from Slack
 * GET /api/slack/poll/:conversationId
 */
export async function pollSlackMessages(req, res) {
  try {
    const { conversationId } = req.params;

    // Check if conversation is handed off
    const handoffState = await Conversation.getHandoffState(conversationId);

    if (!handoffState.is_handed_off) {
      return res.json({ messages: [], isHandedOff: false });
    }

    // Get pending messages
    const messages = pendingMessages.get(conversationId) || [];

    // Clear pending messages after sending
    if (messages.length > 0) {
      pendingMessages.delete(conversationId);
    }

    res.json({
      messages,
      isHandedOff: true,
      handedOffTo: handoffState.handed_off_to,
      threadTs: handoffState.slack_thread_ts
    });
  } catch (error) {
    console.error('Error polling Slack messages:', error);
    res.status(500).json({ error: 'Failed to poll messages' });
  }
}

/**
 * Send visitor's message to Slack thread
 * POST /api/slack/send-to-thread
 */
export async function sendToSlackThread(req, res) {
  try {
    const { conversationId, message } = req.body;

    // Get handoff state to find the thread
    const handoffState = await Conversation.getHandoffState(conversationId);

    if (!handoffState.is_handed_off || !handoffState.slack_thread_ts) {
      return res.status(400).json({ error: 'Conversation not handed off' });
    }

    // Import Slack client dynamically to avoid circular dependencies
    const { sendMessageToThread } = await import('../services/slackService.js');

    // Send message to Slack thread
    const result = await sendMessageToThread(
      handoffState.slack_thread_ts,
      message,
      conversationId
    );

    if (result.success) {
      // Add visitor message to conversation history
      await Conversation.addMessage(conversationId, {
        role: 'user',
        content: message,
        from: 'visitor'
      });

      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to send message to Slack' });
    }
  } catch (error) {
    console.error('Error sending to Slack thread:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
}

/**
 * Helper function to find conversation by Slack thread timestamp
 */
async function findConversationByThreadTs(threadTs) {
  try {
    // Query Supabase to find conversation with this thread_ts
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    const { data, error } = await supabase
      .from('conversations')
      .select('conversation_id')
      .eq('slack_thread_ts', threadTs)
      .single();

    if (error) throw error;
    return data?.conversation_id || null;
  } catch (error) {
    console.error('Error finding conversation by thread_ts:', error);
    return null;
  }
}

export default {
  handleSlackEvents,
  pollSlackMessages,
  sendToSlackThread
};
