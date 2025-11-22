import { WebClient } from '@slack/web-api';

// Lazy initialize Slack client
let slackClient = null;

function initSlack() {
  if (!slackClient) {
    if (!process.env.SLACK_BOT_TOKEN) {
      console.warn('⚠️  Slack not configured. Set SLACK_BOT_TOKEN in .env');
      return false;
    }
    slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
    console.log('💬 Slack service initialized');
  }
  return true;
}

/**
 * Format conversation for Slack display
 */
function formatConversationForSlack(conversationHistory) {
  let messages = [];

  if (typeof conversationHistory === 'string') {
    try {
      messages = JSON.parse(conversationHistory);
    } catch (e) {
      return 'Unable to parse conversation history';
    }
  } else {
    messages = conversationHistory;
  }

  return messages
    .map((msg) => {
      if (msg.role === 'user') {
        return `*Visitor:* ${msg.content}`;
      } else if (msg.role === 'assistant') {
        const content = typeof msg.content === 'string' ? msg.content :
                       Array.isArray(msg.content) ? msg.content.map(c => c.text || '').join('') : '';
        return `*AI:* ${content}`;
      }
      return '';
    })
    .filter(m => m)
    .join('\n');
}

/**
 * Send lead notification to Slack
 * @param {Object} lead - Lead data from database
 */
export async function sendLeadToSlack(lead) {
  if (!initSlack()) {
    console.log('ℹ️  Slack notification skipped (not configured)');
    return { success: false, skipped: true };
  }

  try {
    const qualityEmoji = {
      hot: '🔥',
      warm: '⚡',
      cold: '❄️'
    }[lead.qualification_score] || '📋';

    const qualityText = {
      hot: 'HOT',
      warm: 'WARM',
      cold: 'COLD'
    }[lead.qualification_score] || lead.qualification_score;

    // Format conversation
    const conversationText = formatConversationForSlack(lead.conversation_history);

    // Build rich message blocks
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${qualityEmoji} ${qualityText} Lead: ${lead.name}`,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Email:*\n<mailto:${lead.email}|${lead.email}>`
          },
          {
            type: 'mrkdwn',
            text: `*Phone:*\n${lead.phone || 'Not provided'}`
          },
          {
            type: 'mrkdwn',
            text: `*Organization:*\n${lead.organization || 'Not provided'}`
          },
          {
            type: 'mrkdwn',
            text: `*Role:*\n${lead.role || 'Not provided'}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Primary Interest:*\n${lead.primary_interest}`
        }
      }
    ];

    // Add optional fields if present
    if (lead.timeline) {
      blocks.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Timeline:*\n${lead.timeline}`
          },
          {
            type: 'mrkdwn',
            text: `*Budget:*\n${lead.budget_range || 'Not provided'}`
          }
        ]
      });
    }

    if (lead.pain_points) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Pain Points:*\n${lead.pain_points}`
        }
      });
    }

    // Add conversation summary
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Conversation Summary:*\n${lead.conversation_summary}`
      }
    });

    // Add divider before conversation
    blocks.push({ type: 'divider' });

    // Add full conversation (truncate if too long for Slack)
    const conversationBlock = {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*💬 Full Conversation:*\n${conversationText.substring(0, 2800)}${conversationText.length > 2800 ? '...\n_Conversation truncated. See full details in email._' : ''}`
      }
    };
    blocks.push(conversationBlock);

    // Add action buttons
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📧 Email Lead',
            emoji: true
          },
          url: `mailto:${lead.email}?subject=Following up from Xpio Health`,
          action_id: 'email_lead'
        }
      ]
    });

    // Send to Slack channel
    const result = await slackClient.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      blocks: blocks,
      text: `${qualityEmoji} ${qualityText} Lead: ${lead.name} from ${lead.organization || 'website'}` // Fallback text
    });

    console.log(`✅ Lead notification sent to Slack: ${lead.email}`);
    return { success: true, ts: result.ts, channel: result.channel };
  } catch (error) {
    console.error('❌ Failed to send Slack notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send handoff request to Slack when visitor needs human help
 * @param {string} conversationId - Conversation ID
 * @param {Array} conversationHistory - Messages so far
 * @param {Object} visitorInfo - Any info collected about visitor
 */
export async function requestHandoff(conversationId, conversationHistory, visitorInfo = {}) {
  if (!initSlack()) {
    console.log('ℹ️  Slack handoff request skipped (not configured)');
    return { success: false, skipped: true };
  }

  try {
    const conversationText = formatConversationForSlack(conversationHistory);

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🆘 Visitor Needs Human Help!',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Conversation ID:* \`${conversationId}\``
        }
      }
    ];

    // Add visitor info if available
    if (visitorInfo.name || visitorInfo.email) {
      blocks.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Name:*\n${visitorInfo.name || 'Not provided'}`
          },
          {
            type: 'mrkdwn',
            text: `*Email:*\n${visitorInfo.email || 'Not provided'}`
          }
        ]
      });
    }

    // Add conversation
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*💬 Conversation So Far:*\n${conversationText.substring(0, 2800)}${conversationText.length > 2800 ? '...' : ''}`
      }
    });

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '💡 _Reply in this thread to chat with the visitor in real-time!_'
        }
      ]
    });

    const result = await slackClient.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      blocks: blocks,
      text: `🆘 Visitor needs help (Conversation ID: ${conversationId})`
    });

    console.log(`✅ Handoff request sent to Slack for conversation: ${conversationId}`);
    return {
      success: true,
      ts: result.ts,
      channel: result.channel,
      threadTs: result.ts // This will be used for threading replies
    };
  } catch (error) {
    console.error('❌ Failed to send handoff request to Slack:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a message to an existing Slack thread
 * @param {string} threadTs - Thread timestamp to reply to
 * @param {string} message - Message content from visitor
 * @param {string} conversationId - Conversation ID for context
 */
export async function sendMessageToThread(threadTs, message, conversationId) {
  if (!initSlack()) {
    console.log('ℹ️  Slack message skipped (not configured)');
    return { success: false, skipped: true };
  }

  try {
    const result = await slackClient.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      thread_ts: threadTs,
      text: `*Visitor (${conversationId}):* ${message}`,
      mrkdwn: true
    });

    console.log(`✅ Visitor message sent to Slack thread: ${threadTs}`);
    return { success: true, ts: result.ts };
  } catch (error) {
    console.error('❌ Failed to send message to Slack thread:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Test Slack configuration
 */
export async function testSlackConfiguration() {
  if (!initSlack()) {
    console.warn('⚠️  Slack not configured');
    return false;
  }

  try {
    // Test by getting channel info
    const result = await slackClient.conversations.info({
      channel: process.env.SLACK_CHANNEL_ID
    });
    console.log(`✅ Slack configured correctly. Connected to channel: ${result.channel.name}`);
    return true;
  } catch (error) {
    console.error('❌ Slack configuration error:', error.message);
    return false;
  }
}

export default { sendLeadToSlack, requestHandoff, sendMessageToThread, testSlackConfiguration };
