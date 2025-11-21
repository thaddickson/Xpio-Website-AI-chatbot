import { chatWithClaude, getInitialGreeting } from '../services/claudeService.js';
import { saveLead } from '../services/leadService.js';
import Conversation from '../models/Conversation.js';
import Prompt from '../models/Prompt.js';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';

// Lazy initialize Anthropic client
let anthropic = null;
function getAnthropic() {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY must be set in environment variables');
    }
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropic;
}

// In-memory conversation storage (use Redis for production)
const conversations = new Map();

// Conversation timeout (30 minutes)
const CONVERSATION_TIMEOUT = 30 * 60 * 1000;

// System prompt - loaded from database and cached
let cachedSystemPrompt = null;
let lastPromptLoad = null;
const PROMPT_CACHE_DURATION = 5 * 60 * 1000; // Refresh every 5 minutes

async function getSystemPrompt() {
  const now = Date.now();

  // Use cache if it's recent
  if (cachedSystemPrompt && lastPromptLoad && (now - lastPromptLoad < PROMPT_CACHE_DURATION)) {
    return cachedSystemPrompt;
  }

  try {
    // Load from database
    cachedSystemPrompt = await Prompt.buildSystemPrompt();
    lastPromptLoad = now;
    console.log('✓ Loaded system prompt from database');
    return cachedSystemPrompt;
  } catch (error) {
    console.error('Failed to load prompt from database, using fallback:', error);
    // Fallback to hardcoded prompt if database fails
    const { SYSTEM_PROMPT } = await import('../services/claudeService.js');
    return SYSTEM_PROMPT;
  }
}

// Import fallback prompt and tool definition
import { LEAD_CAPTURE_TOOL } from '../services/claudeService.js';

/**
 * Clean up old conversations periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of conversations.entries()) {
    if (now - data.lastActivity > CONVERSATION_TIMEOUT) {
      conversations.delete(id);
      console.log(`🧹 Cleaned up inactive conversation: ${id}`);

      // Mark as abandoned in database (don't wait)
      Conversation.getById(id).then(conv => {
        if (conv && conv.status === 'active') {
          Conversation.markEnded(id).catch(err =>
            console.error('Failed to mark conversation as abandoned:', err)
          );
        }
      }).catch(err => console.error('Error checking conversation:', err));
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

/**
 * Handle chat messages with STREAMING support
 * POST /api/chat
 */
export async function handleChatStream(req, res) {
  try {
    const { message, conversationId: clientConversationId } = req.body;

    // Validate input
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message is required and must be a non-empty string'
      });
    }

    if (message.length > 5000) {
      return res.status(400).json({
        error: 'Message is too long (max 5000 characters)'
      });
    }

    // Get or create conversation
    let conversationId = clientConversationId;
    let conversationData;
    let isNewConversation = false;

    if (!conversationId || !conversations.has(conversationId)) {
      conversationId = uuidv4();
      conversationData = {
        id: conversationId,
        messages: [],
        leadCaptured: false,
        createdAt: Date.now(),
        lastActivity: Date.now()
      };
      conversations.set(conversationId, conversationData);
      isNewConversation = true;
      console.log(`📝 New conversation started: ${conversationId}`);

      // Create conversation in database (don't wait)
      Conversation.create(conversationId, {
        user_agent: req.headers['user-agent'],
        ip_address: req.ip,
        referrer: req.headers['referer']
      }).catch(err => console.error('Failed to create conversation in DB:', err));
    } else {
      conversationData = conversations.get(conversationId);
      conversationData.lastActivity = Date.now();
    }

    // Add user message to history
    const userMessage = {
      role: 'user',
      content: message
    };
    conversationData.messages.push(userMessage);

    console.log(`💬 User message in ${conversationId}: ${message.substring(0, 100)}...`);

    // Log user message to database (don't wait)
    Conversation.addMessage(conversationId, userMessage)
      .catch(err => console.error('Failed to log user message:', err));

    // Set up Server-Sent Events (SSE) for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    let fullResponse = '';
    let toolUseDetected = null;

    try {
      // Get system prompt from database
      const systemPrompt = await getSystemPrompt();

      // Create streaming request to Claude
      const stream = await getAnthropic().messages.stream({
        model: 'claude-opus-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools: [LEAD_CAPTURE_TOOL],
        messages: conversationData.messages,
        temperature: 0.7,
      });

      // Send conversation ID immediately
      res.write(`data: ${JSON.stringify({ type: 'conversation_id', conversationId })}\n\n`);

      // Handle text streaming
      stream.on('text', (text) => {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
      });

      // Handle tool use
      stream.on('contentBlock', (block) => {
        if (block.type === 'tool_use') {
          toolUseDetected = block;
          console.log(`🎯 Lead capture triggered: ${block.name}`);
        }
      });

      // Handle message completion
      stream.on('message', async (message) => {
        // If tool was used, process it
        if (toolUseDetected && toolUseDetected.name === 'save_lead') {
          console.log(`💾 Saving lead data...`);

          // Add assistant's response to history
          const assistantMessage = {
            role: 'assistant',
            content: message.content
          };
          conversationData.messages.push(assistantMessage);

          // Log assistant message to database (don't wait)
          Conversation.addMessage(conversationId, { role: 'assistant', content: fullResponse })
            .catch(err => console.error('Failed to log assistant message:', err));

          // Save the lead
          let leadResult;
          try {
            leadResult = await saveLead(
              toolUseDetected.input,
              conversationId,
              conversationData.messages
            );
            conversationData.leadCaptured = true;

            // Mark lead captured in conversations table (don't wait)
            Conversation.markLeadCaptured(conversationId, leadResult.leadId)
              .catch(err => console.error('Failed to mark lead in conversations:', err));

            res.write(`data: ${JSON.stringify({ type: 'lead_captured', leadId: leadResult.leadId })}\n\n`);
          } catch (error) {
            console.error('Failed to save lead:', error);
            leadResult = {
              success: false,
              error: 'Failed to save your information. Please try again.'
            };
            res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to save lead' })}\n\n`);
          }

          // Send tool result back to Claude
          conversationData.messages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: toolUseDetected.id,
              content: JSON.stringify(leadResult)
            }]
          });

          // Get Claude's follow-up message (non-streaming for simplicity)
          const followUpResponse = await getAnthropic().messages.create({
            model: 'claude-opus-4-20250514',
            max_tokens: 2048,
            system: systemPrompt,
            messages: conversationData.messages,
          });

          const followUpText = followUpResponse.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('');

          const followUpMessage = {
            role: 'assistant',
            content: followUpText
          };
          conversationData.messages.push(followUpMessage);

          // Log follow-up message to database (don't wait)
          Conversation.addMessage(conversationId, followUpMessage)
            .catch(err => console.error('Failed to log follow-up message:', err));

          // Stream the follow-up message
          res.write(`data: ${JSON.stringify({ type: 'text', content: '\n\n' + followUpText })}\n\n`);
          fullResponse += '\n\n' + followUpText;
        } else {
          // No tool use, just add to history
          const assistantMessage = {
            role: 'assistant',
            content: fullResponse
          };
          conversationData.messages.push(assistantMessage);

          // Log assistant message to database (don't wait)
          Conversation.addMessage(conversationId, assistantMessage)
            .catch(err => console.error('Failed to log assistant message:', err));
        }

        // Send completion event
        res.write(`data: ${JSON.stringify({ type: 'done', conversationId, leadCaptured: conversationData.leadCaptured })}\n\n`);
        res.end();
      });

      // Handle errors
      stream.on('error', (error) => {
        console.error('Stream error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      });

    } catch (error) {
      console.error('❌ Streaming error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to connect to AI' })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('❌ Chat error:', error);
    // If headers already sent, can't send JSON
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({
        error: 'Sorry, something went wrong. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

/**
 * Get initial greeting
 * GET /api/chat/greeting
 */
export function handleGetGreeting(req, res) {
  res.json({
    message: getInitialGreeting()
  });
}

/**
 * End a conversation and clean up
 * POST /api/chat/end
 */
export function handleEndConversation(req, res) {
  const { conversationId } = req.body;

  if (conversationId && conversations.has(conversationId)) {
    conversations.delete(conversationId);
    console.log(`🏁 Conversation ended: ${conversationId}`);

    // Mark as ended in database (don't wait)
    Conversation.markEnded(conversationId)
      .catch(err => console.error('Failed to mark conversation ended:', err));
  }

  res.json({ success: true });
}

/**
 * Get conversation stats (for monitoring)
 * GET /api/stats
 */
export async function handleGetStats(req, res) {
  try {
    // Get in-memory stats
    const memoryStats = {
      activeConversations: conversations.size,
      conversations: Array.from(conversations.values()).map(conv => ({
        id: conv.id,
        messageCount: conv.messages.length,
        leadCaptured: conv.leadCaptured,
        age: Math.floor((Date.now() - conv.createdAt) / 1000 / 60) + ' minutes',
        lastActivity: Math.floor((Date.now() - conv.lastActivity) / 1000) + ' seconds ago'
      }))
    };

    // Get database stats
    const dbStats = await Conversation.getStats();

    res.json({
      memory: memoryStats,
      database: dbStats,
      combined: {
        totalConversations: dbStats.total,
        activeInMemory: memoryStats.activeConversations,
        leadsGenerated: dbStats.withLeads,
        conversionRate: dbStats.total > 0
          ? ((dbStats.withLeads / dbStats.total) * 100).toFixed(1) + '%'
          : '0%',
        averageMessagesPerConversation: dbStats.avgMessages
      }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
}

export default {
  handleChatStream,
  handleGetGreeting,
  handleEndConversation,
  handleGetStats
};
