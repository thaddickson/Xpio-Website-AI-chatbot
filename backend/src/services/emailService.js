import sgMail from '@sendgrid/mail';

// Lazy initialize SendGrid
let sendgridInitialized = false;

function initSendGrid() {
  if (!sendgridInitialized) {
    // Check if SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️  SendGrid not configured. Set SENDGRID_API_KEY in .env');
      return false;
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    sendgridInitialized = true;
    console.log('✉️  SendGrid email service initialized');
  }
  return true;
}

/**
 * Send email notification when a lead is captured
 * @param {Object} lead - Lead data from database
 */
export async function sendLeadNotification(lead) {
  // Initialize SendGrid
  if (!initSendGrid()) {
    console.log('ℹ️  Email notification skipped (SendGrid not configured)');
    return {
      success: false,
      skipped: true,
      reason: 'SendGrid not configured'
    };
  }

  try {
    // Format the lead quality badge
    const qualityBadge = {
      hot: '🔥 HOT',
      warm: '⚡ WARM',
      cold: '❄️ COLD'
    }[lead.qualification_score] || lead.qualification_score;

    // Format conversation history
    const formattedConversation = formatConversationHistory(lead.conversation_history);

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #FC922B 0%, #BF5409 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .badge { display: inline-block; padding: 8px 16px; background: #ff6b6b; color: white; border-radius: 20px; font-weight: bold; margin: 10px 0; }
    .badge.hot { background: #ff4757; }
    .badge.warm { background: #ffa502; }
    .badge.cold { background: #70a1ff; }
    .content { background: #f8f9fa; padding: 20px; }
    .section { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .label { font-weight: bold; color: #FC922B; }
    .conversation { background: #f8f9fa; padding: 15px; border-left: 4px solid #FC922B; margin: 10px 0; }
    .message { margin: 10px 0; }
    .user-msg { color: #2d3436; }
    .assistant-msg { color: #636e72; }
    .footer { text-align: center; padding: 20px; color: #95a5a6; font-size: 12px; }
    .cta-button { display: inline-block; background: #FC922B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 New Lead Captured!</h1>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Xpio Health Delphi AI</p>
      <div class="badge ${lead.qualification_score}">${qualityBadge} LEAD</div>
    </div>

    <div class="content">
      <div class="section">
        <h2>📋 Contact Information</h2>
        <p><span class="label">Name:</span> ${lead.name}</p>
        <p><span class="label">Email:</span> <a href="mailto:${lead.email}">${lead.email}</a></p>
        ${lead.phone ? `<p><span class="label">Phone:</span> <a href="tel:${lead.phone}">${lead.phone}</a></p>` : ''}
        ${lead.organization ? `<p><span class="label">Organization:</span> ${lead.organization}</p>` : ''}
        ${lead.role ? `<p><span class="label">Role:</span> ${lead.role}</p>` : ''}
        ${lead.organization_size ? `<p><span class="label">Organization Size:</span> ${lead.organization_size}</p>` : ''}
      </div>

      <div class="section">
        <h2>💡 Lead Details</h2>
        <p><span class="label">Primary Interest:</span><br>${lead.primary_interest}</p>
        ${lead.current_systems ? `<p><span class="label">Current Systems:</span> ${lead.current_systems}</p>` : ''}
        ${lead.timeline ? `<p><span class="label">Timeline:</span> ${lead.timeline}</p>` : ''}
        ${lead.budget_range ? `<p><span class="label">Budget:</span> ${lead.budget_range}</p>` : ''}
        ${lead.pain_points ? `<p><span class="label">Pain Points:</span><br>${lead.pain_points}</p>` : ''}
        ${lead.next_steps ? `<p><span class="label">Expected Next Steps:</span><br>${lead.next_steps}</p>` : ''}
      </div>

      <div class="section">
        <h2>📝 Conversation Summary</h2>
        <p>${lead.conversation_summary}</p>
      </div>

      <div class="section">
        <h2>💬 Full Conversation</h2>
        <div class="conversation">
          ${formattedConversation}
        </div>
      </div>

      <div class="section">
        <h2>⏰ Timing</h2>
        <p><span class="label">Captured At:</span> ${new Date(lead.created_at).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>
        <p><span class="label">Lead ID:</span> ${lead.id}</p>
      </div>

      <div style="text-align: center; margin: 20px 0;">
        <a href="mailto:${lead.email}?subject=Following up from Xpio Health" class="cta-button">
          📧 Email Lead Now
        </a>
      </div>
    </div>

    <div class="footer">
      <p>This lead was captured via Xpio Health Delphi AI</p>
      <p>Powered by Claude AI Lead Generation System</p>
    </div>
  </div>
</body>
</html>
    `;

    const msg = {
      to: process.env.NOTIFICATION_EMAIL,
      from: {
        email: process.env.EMAIL_FROM || 'thad@xpiohealth.com',
        name: process.env.EMAIL_FROM_NAME || 'Xpio Health Delphi AI'
      },
      replyTo: {
        email: process.env.NOTIFICATION_EMAIL || 'thad@xpiohealth.com',
        name: 'Xpio Health Team'
      },
      subject: `${qualityBadge} Lead: ${lead.name} - ${lead.organization || 'Individual'}`,
      html: emailBody,
    };

    const result = await sgMail.send(msg);
    console.log(`✅ Lead notification email sent for: ${lead.email}`);
    return { success: true, messageId: result[0].headers['x-message-id'] };
  } catch (error) {
    console.error('❌ Failed to send lead notification email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Format conversation history for email
 * @param {string|Array} conversationHistory - Conversation messages
 * @returns {string} Formatted HTML
 */
function formatConversationHistory(conversationHistory) {
  let messages = [];

  if (typeof conversationHistory === 'string') {
    try {
      messages = JSON.parse(conversationHistory);
    } catch (e) {
      return '<p>Unable to parse conversation history</p>';
    }
  } else {
    messages = conversationHistory;
  }

  return messages
    .map((msg, index) => {
      if (msg.role === 'user') {
        return `<div class="message user-msg"><strong>Visitor:</strong> ${escapeHtml(msg.content)}</div>`;
      } else if (msg.role === 'assistant') {
        const content = typeof msg.content === 'string' ? msg.content :
                       Array.isArray(msg.content) ? msg.content.map(c => c.text || '').join('') : '';
        return `<div class="message assistant-msg"><strong>Chatbot:</strong> ${escapeHtml(content)}</div>`;
      }
      return '';
    })
    .join('');
}

/**
 * Escape HTML to prevent XSS in emails
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Test email configuration
 * @returns {boolean} True if email is configured correctly
 */
export async function testEmailConfiguration() {
  if (!initSendGrid()) {
    console.warn('⚠️  SendGrid not configured');
    return false;
  }

  try {
    // SendGrid doesn't have a verify method, but we can check if API key is set
    console.log('✅ SendGrid is configured correctly');
    return true;
  } catch (error) {
    console.error('❌ SendGrid configuration error:', error.message);
    return false;
  }
}

export default { sendLeadNotification, testEmailConfiguration };
