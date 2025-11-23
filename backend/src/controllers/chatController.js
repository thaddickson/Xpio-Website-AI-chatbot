import { chatWithClaude, getInitialGreeting } from '../services/claudeService.js';
import { saveLead } from '../services/leadService.js';
import { requestHandoff } from '../services/slackService.js';
import Conversation from '../models/Conversation.js';
import Lead from '../models/Lead.js';
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

// Import fallback prompt and tool definitions
import { LEAD_CAPTURE_TOOL, HANDOFF_TOOL, CALENDLY_TOOL } from '../services/claudeService.js';

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

    // SECURITY: Detect obvious prompt injection attempts
    const suspiciousPatterns = [
      /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
      /disregard\s+(all\s+)?(previous|prior)\s+instructions/i,
      /forget\s+(all\s+)?(previous|prior|everything)/i,
      /you\s+are\s+now\s+(a|an)/i,
      /pretend\s+(you|that)/i,
      /reveal\s+(your\s+)?(system\s+)?prompt/i,
      /show\s+(me\s+)?(your\s+)?(system\s+)?prompt/i,
      /what\s+(is|are)\s+your\s+(system\s+)?instructions/i,
      /new\s+instructions:/i,
      /\[SYSTEM\]/i,
      /\<SYSTEM\>/i
    ];

    const foundSuspicious = suspiciousPatterns.some(pattern => pattern.test(message));
    if (foundSuspicious) {
      console.warn(`⚠️ Prompt injection attempt detected in conversation ${clientConversationId || 'new'}: ${message.substring(0, 100)}`);
      // Log to database for monitoring
      // Don't block completely - Claude can handle it, but we log the attempt
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
        handoffRequested: false,
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
        tools: [LEAD_CAPTURE_TOOL, HANDOFF_TOOL, CALENDLY_TOOL],
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
        } else if (toolUseDetected && toolUseDetected.name === 'check_calendar_availability') {
          console.log(`📅 Checking Calendly availability...`);

          // Track calendar check
          conversationData.calendarChecked = true;

          // Add assistant's response to history
          const assistantMessage = {
            role: 'assistant',
            content: message.content
          };
          conversationData.messages.push(assistantMessage);

          // Log assistant message to database (don't wait)
          Conversation.addMessage(conversationId, { role: 'assistant', content: fullResponse })
            .catch(err => console.error('Failed to log assistant message:', err));

          // Get available times from Calendly
          const { getAvailableTimes } = await import('../services/calendlyService.js');
          let availabilityResult;
          try {
            availabilityResult = await getAvailableTimes();
            console.log('📅 Calendly availability:', availabilityResult);
          } catch (error) {
            console.error('Failed to check Calendly availability:', error);
            availabilityResult = {
              available: false,
              error: error.message,
              message: "I'm having trouble checking the calendar right now.",
              bookingLink: process.env.CALENDLY_EVENT_LINK
            };
          }

          // Send tool result back to Claude
          conversationData.messages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: toolUseDetected.id,
              content: JSON.stringify(availabilityResult)
            }]
          });

          // Get Claude's follow-up message with the availability info
          console.log('💬 Getting follow-up message from Claude with availability...');
          const followUpResponse = await chatWithClaude(conversationData.messages, conversationId);

          let followUpText = '';
          for (const block of followUpResponse.content) {
            if (block.type === 'text') {
              followUpText += block.text;
            }
          }

          // Add follow-up to conversation history
          conversationData.messages.push({
            role: 'assistant',
            content: followUpText
          });

          // Log follow-up message to database (don't wait)
          Conversation.addMessage(conversationId, { role: 'assistant', content: followUpText })
            .catch(err => console.error('Failed to log follow-up message:', err));

          // Stream the follow-up message
          res.write(`data: ${JSON.stringify({ type: 'text', content: '\n\n' + followUpText })}\n\n`);
          fullResponse += '\n\n' + followUpText;
        } else if (toolUseDetected && toolUseDetected.name === 'request_human_help') {
          console.log(`🆘 Handoff requested for conversation: ${conversationId}`);

          // SECURITY: Prevent handoff spam - only allow one handoff per conversation
          if (conversationData.handoffRequested) {
            console.warn(`⚠️ Handoff already requested for conversation: ${conversationId}`);
            // Don't process duplicate handoff requests
            const assistantMessage = {
              role: 'assistant',
              content: fullResponse
            };
            conversationData.messages.push(assistantMessage);
            Conversation.addMessage(conversationId, { role: 'assistant', content: fullResponse })
              .catch(err => console.error('Failed to log assistant message:', err));

            // Send completion event
            res.write(`data: ${JSON.stringify({ type: 'done', conversationId, leadCaptured: conversationData.leadCaptured })}\n\n`);
            res.end();
            return;
          }

          conversationData.handoffRequested = true;

          // Add assistant's response to history
          const assistantMessage = {
            role: 'assistant',
            content: message.content
          };
          conversationData.messages.push(assistantMessage);

          // Log assistant message to database (don't wait)
          Conversation.addMessage(conversationId, { role: 'assistant', content: fullResponse })
            .catch(err => console.error('Failed to log assistant message:', err));

          // Request handoff via Slack
          let handoffResult;
          try {
            handoffResult = await requestHandoff(
              conversationId,
              conversationData.messages,
              {
                name: toolUseDetected.input.visitor_name,
                email: toolUseDetected.input.visitor_email,
                reason: toolUseDetected.input.reason,
                urgency: toolUseDetected.input.urgency,
                context: toolUseDetected.input.context_summary
              }
            );

            // Mark conversation as handed off in database
            if (handoffResult.success && handoffResult.threadTs) {
              Conversation.markHandedOff(conversationId, handoffResult.threadTs)
                .catch(err => console.error('Failed to mark handoff in database:', err));
            }

            res.write(`data: ${JSON.stringify({ type: 'handed_off', threadTs: handoffResult.threadTs })}\n\n`);
          } catch (error) {
            console.error('Failed to request handoff:', error);
            handoffResult = {
              success: false,
              error: 'Failed to connect you with a team member. Please try again.'
            };
            res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to request handoff' })}\n\n`);
          }

          // Send tool result back to Claude
          conversationData.messages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: toolUseDetected.id,
              content: JSON.stringify(handoffResult)
            }]
          });

          // Get Claude's follow-up message
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
    // Get database stats
    const dbStats = await Conversation.getStats();

    // Get recent leads (last 10)
    const recentLeads = await Lead.getAll(10, 0);

    // Count tool usage in conversations
    let handoffsRequested = 0;
    let calendarChecks = 0;

    Array.from(conversations.values()).forEach(conv => {
      if (conv.handoffRequested) handoffsRequested++;
      if (conv.calendarChecked) calendarChecks++;
    });

    // Return stats in format expected by frontend
    res.json({
      totalConversations: dbStats.total || 0,
      totalLeads: dbStats.withLeads || 0,
      activeConversations: conversations.size,
      handoffsRequested,
      calendarChecks,
      recentLeads: recentLeads.map(lead => ({
        name: lead.name,
        email: lead.email,
        primary_interest: lead.primary_interest,
        created_at: lead.created_at
      }))
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
