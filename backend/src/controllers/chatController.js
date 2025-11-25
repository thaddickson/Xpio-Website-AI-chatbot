import { chatWithClaude, getInitialGreeting } from '../services/claudeService.js';
import { saveLead } from '../services/leadService.js';
import { requestHandoff } from '../services/slackService.js';
import { trackUsage } from '../services/usageService.js';
import Conversation from '../models/Conversation.js';
import Lead from '../models/Lead.js';
import Prompt from '../models/Prompt.js';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_TENANT_ID } from '../models/Tenant.js';

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

// System prompt cache - short duration, can be manually cleared
let cachedSystemPrompt = null;
let lastPromptLoad = null;
const PROMPT_CACHE_DURATION = 30 * 1000; // 30 seconds - short for quick updates

/**
 * Clear the prompt cache - call this when prompts are updated
 */
export function clearPromptCache() {
  cachedSystemPrompt = null;
  lastPromptLoad = null;
  console.log('🗑️ Prompt cache cleared');
}

/**
 * Get system prompt with A/B testing variation support
 * For new conversations - loads fresh with possible variation assignment
 */
async function getSystemPromptWithVariations(conversationId, tenantId = null) {
  try {
    const result = await Prompt.buildSystemPromptWithVariations(conversationId, tenantId);
    if (result.usedVariations) {
      console.log(`🧪 A/B test active for conversation ${conversationId}`);
    }
    return result.prompt;
  } catch (error) {
    console.error('Failed to load prompt with variations:', error);
    return getSystemPrompt();
  }
}

/**
 * Get base system prompt (cached briefly for performance)
 * Used for follow-up messages in same conversation
 */
async function getSystemPrompt() {
  const now = Date.now();

  // Use cache if recent (30 seconds)
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

    // Build user message object
    const userMessage = {
      role: 'user',
      content: message
    };

    if (!conversationId || !conversations.has(conversationId)) {
      conversationId = uuidv4();
      conversationData = {
        id: conversationId,
        messages: [],
        leadCaptured: false,
        handoffRequested: false,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        systemPrompt: null // Will be set with A/B variation for this conversation
      };
      conversations.set(conversationId, conversationData);
      isNewConversation = true;
      console.log(`📝 New conversation started: ${conversationId}`);

      // Create conversation in database WITH the first message included
      // This prevents race condition where addMessage runs before create completes
      Conversation.create(conversationId, {
        user_agent: req.headers['user-agent'],
        ip_address: req.ip,
        referrer: req.headers['referer']
      }, userMessage).catch(err => console.error('Failed to create conversation in DB:', err));
    } else {
      conversationData = conversations.get(conversationId);
      conversationData.lastActivity = Date.now();

      // Log user message to database (only for existing conversations)
      Conversation.addMessage(conversationId, userMessage)
        .catch(err => console.error('Failed to log user message:', err));
    }

    // Add user message to in-memory history
    conversationData.messages.push(userMessage);

    console.log(`💬 User message in ${conversationId}: ${message.substring(0, 100)}...`);

    // Set up Server-Sent Events (SSE) for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    let fullResponse = '';
    let toolUseDetected = null;

    try {
      // Check if conversation is handed off and if human is still active
      const handoffState = await Conversation.getHandoffState(conversationId);

      if (handoffState.is_handed_off) {
        // Check when last human message was
        const lastHumanMessage = conversationData.messages
          .filter(m => m.from === 'human')
          .pop();

        const timeSinceLastHuman = lastHumanMessage
          ? Date.now() - new Date(lastHumanMessage.timestamp || conversationData.lastActivity).getTime()
          : Date.now() - conversationData.lastActivity;

        // If human responded in last 2 minutes, don't let AI interfere
        if (lastHumanMessage && timeSinceLastHuman < 120000) {
          console.log(`🙋 Human is active in conversation ${conversationId}, AI staying silent`);
          res.write(`data: ${JSON.stringify({
            type: 'handed_off',
            message: 'Our team member is helping you now. They will respond shortly.'
          })}\n\n`);
          res.write(`data: ${JSON.stringify({ type: 'done', conversationId })}\n\n`);
          res.end();
          return;
        }

        // If we get here, human hasn't responded in 2+ minutes, AI can resume
        console.log(`🤖 Human inactive for ${Math.floor(timeSinceLastHuman/1000)}s, AI resuming conversation ${conversationId}`);
      }

      // Get system prompt - use A/B variations for new conversations, cached for existing
      const tenantId = req.tenantId || DEFAULT_TENANT_ID;
      let systemPrompt;

      if (isNewConversation || !conversationData.systemPrompt) {
        // New conversation: load fresh prompt with possible A/B variation
        systemPrompt = await getSystemPromptWithVariations(conversationId, tenantId);
        conversationData.systemPrompt = systemPrompt; // Cache for this conversation
      } else {
        // Existing conversation: use the same prompt for consistency
        systemPrompt = conversationData.systemPrompt;
      }

      // Create streaming request to Claude
      const stream = await getAnthropic().messages.stream({
        model: 'claude-opus-4-5-20251101', // Claude Opus 4.5 - latest
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
        // Track API usage for this request
        const tenantId = req.tenantId || DEFAULT_TENANT_ID;
        if (message.usage) {
          trackUsage(tenantId, conversationId, 'claude-opus-4-5-20251101', message.usage)
            .catch(err => console.error('Failed to track usage:', err));
        }

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

          // Get Claude's follow-up message WITH TOOLS so it can call check_calendar_availability
          const followUpResponse = await getAnthropic().messages.create({
            model: 'claude-opus-4-5-20251101',
            max_tokens: 2048,
            system: systemPrompt,
            tools: [LEAD_CAPTURE_TOOL, HANDOFF_TOOL, CALENDLY_TOOL], // CRITICAL: Include tools!
            messages: conversationData.messages,
          });

          // Track usage for follow-up call
          if (followUpResponse.usage) {
            trackUsage(tenantId, conversationId, 'claude-opus-4-5-20251101', followUpResponse.usage)
              .catch(err => console.error('Failed to track follow-up usage:', err));
          }

          // Check if Claude wants to use a tool (likely check_calendar_availability)
          let followUpToolUse = null;
          let followUpText = '';
          for (const block of followUpResponse.content) {
            if (block.type === 'text') {
              followUpText += block.text;
            } else if (block.type === 'tool_use') {
              followUpToolUse = block;
            }
          }

          // If there's text, stream it
          if (followUpText) {
            res.write(`data: ${JSON.stringify({ type: 'text', content: '\n\n' + followUpText })}\n\n`);
            fullResponse += '\n\n' + followUpText;
          }

          // Add assistant's response to history
          const followUpMessage = {
            role: 'assistant',
            content: followUpResponse.content
          };
          conversationData.messages.push(followUpMessage);

          // Log follow-up message to database (don't wait)
          Conversation.addMessage(conversationId, { role: 'assistant', content: followUpText })
            .catch(err => console.error('Failed to log follow-up message:', err));

          // If Claude wants to check calendar after saving lead, handle it!
          if (followUpToolUse && followUpToolUse.name === 'check_calendar_availability') {
            console.log(`📅 Claude wants to check calendar after save_lead - handling...`);

            conversationData.calendarChecked = true;

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
                tool_use_id: followUpToolUse.id,
                content: JSON.stringify(availabilityResult)
              }]
            });

            // Get Claude's final response with the calendar times
            const calendarResponse = await getAnthropic().messages.create({
              model: 'claude-opus-4-5-20251101',
              max_tokens: 2048,
              system: systemPrompt,
              messages: conversationData.messages,
            });

            // Track usage for calendar response
            if (calendarResponse.usage) {
              trackUsage(tenantId, conversationId, 'claude-opus-4-5-20251101', calendarResponse.usage)
                .catch(err => console.error('Failed to track calendar usage:', err));
            }

            let calendarText = '';
            for (const block of calendarResponse.content) {
              if (block.type === 'text') {
                calendarText += block.text;
              }
            }

            // Add to history and stream
            conversationData.messages.push({
              role: 'assistant',
              content: calendarText
            });

            Conversation.addMessage(conversationId, { role: 'assistant', content: calendarText })
              .catch(err => console.error('Failed to log calendar message:', err));

            res.write(`data: ${JSON.stringify({ type: 'text', content: '\n\n' + calendarText })}\n\n`);
            fullResponse += '\n\n' + calendarText;
          }
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

          // Track usage for calendar availability follow-up
          if (followUpResponse.usage) {
            trackUsage(tenantId, conversationId, followUpResponse.model || 'claude-opus-4-5-20251101', followUpResponse.usage)
              .catch(err => console.error('Failed to track calendar availability follow-up usage:', err));
          }

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

          // Track that handoff was requested (for stats, but don't block future AI responses)
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
            model: 'claude-opus-4-5-20251101', // Claude Opus 4.5
            max_tokens: 2048,
            system: systemPrompt,
            messages: conversationData.messages,
          });

          // Track usage for handoff follow-up
          if (followUpResponse.usage) {
            trackUsage(tenantId, conversationId, 'claude-opus-4-5-20251101', followUpResponse.usage)
              .catch(err => console.error('Failed to track handoff follow-up usage:', err));
          }

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
    // Get database stats (includes handoff count from DB)
    const dbStats = await Conversation.getStats();

    // Get recent leads (last 10)
    const recentLeads = await Lead.getAll(10, 0);

    // Count calendar checks from active in-memory conversations only
    let calendarChecks = 0;
    Array.from(conversations.values()).forEach(conv => {
      if (conv.calendarChecked) calendarChecks++;
    });

    // Return stats in format expected by frontend
    // Use database handoff count (persisted) instead of in-memory (volatile)
    res.json({
      totalConversations: dbStats.total || 0,
      totalLeads: dbStats.withLeads || 0,
      activeConversations: conversations.size,
      handoffsRequested: dbStats.handoffsRequested || 0,
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
