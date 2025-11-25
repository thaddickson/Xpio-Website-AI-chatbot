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
 * Send confirmation email to the visitor after their info is captured
 * @param {Object} lead - Lead data from database
 * @param {string} calendlyLink - Optional calendly link if they requested scheduling
 */
export async function sendVisitorConfirmation(lead, calendlyLink = null) {
  // Initialize SendGrid
  if (!initSendGrid()) {
    console.log('ℹ️  Visitor confirmation skipped (SendGrid not configured)');
    return {
      success: false,
      skipped: true,
      reason: 'SendGrid not configured'
    };
  }

  try {
    const firstName = lead.name ? lead.name.split(' ')[0] : 'there';

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #FC922B 0%, #BF5409 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0 0; opacity: 0.9; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
    .section { margin: 20px 0; }
    .cta-button { display: inline-block; background: #FC922B; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 15px 0; font-weight: bold; }
    .cta-button:hover { background: #BF5409; }
    .info-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FC922B; }
    .footer { text-align: center; padding: 20px; color: #95a5a6; font-size: 12px; background: #f8f9fa; border-radius: 0 0 8px 8px; }
    .contact-info { margin-top: 20px; }
    .contact-info p { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Thanks for Reaching Out!</h1>
      <p>Xpio Health - Behavioral Health Technology Experts</p>
    </div>

    <div class="content">
      <p>Hi ${firstName},</p>

      <p>Thank you for connecting with Xpio Health! We've received your information and a member of our team will be in touch shortly.</p>

      ${lead.primary_interest ? `
      <div class="info-box">
        <strong>What you're interested in:</strong><br>
        ${lead.primary_interest}
      </div>
      ` : ''}

      ${calendlyLink ? `
      <div class="section" style="text-align: center;">
        <p><strong>Ready to schedule your meeting?</strong></p>
        <a href="${calendlyLink}" class="cta-button">📅 Schedule Meeting with Thad</a>
      </div>
      ` : ''}

      <div class="section">
        <h3>What to Expect Next:</h3>
        <ul>
          <li>A member of our team will review your needs</li>
          <li>We'll reach out within 1 business day (often much sooner!)</li>
          <li>We'll come prepared with insights specific to your situation</li>
        </ul>
      </div>

      <div class="section">
        <h3>In the Meantime:</h3>
        <p>Feel free to explore our solutions:</p>
        <ul>
          <li><a href="https://xpiohealth.com/analytics">Xpio Analytics Platform</a> - AI-powered insights for behavioral health</li>
          <li><a href="https://xpiohealth.com/cybersecurity">HIPAA Compliance & Security</a> - Stay protected and compliant</li>
          <li><a href="https://xpiohealth.com/ehr-consulting">EHR Consulting</a> - Vendor-neutral guidance</li>
        </ul>
      </div>

      <div class="contact-info">
        <h3>Questions? Reach Us Directly:</h3>
        <p>📧 Email: <a href="mailto:inquiry@xpiohealth.com">inquiry@xpiohealth.com</a></p>
        <p>📞 Phone: (888) 974-6408</p>
        <p>🌐 Website: <a href="https://xpiohealth.com">xpiohealth.com</a></p>
      </div>
    </div>

    <div class="footer">
      <p>Xpio Health | Improving the health of organizations and the people they serve</p>
      <p>3118 Judson Street, PO Box 498, Gig Harbor, WA 98335</p>
    </div>
  </div>
</body>
</html>
    `;

    const msg = {
      to: lead.email,
      from: {
        email: process.env.EMAIL_FROM || 'thad@xpiohealth.com',
        name: process.env.EMAIL_FROM_NAME || 'Xpio Health'
      },
      replyTo: {
        email: process.env.NOTIFICATION_EMAIL || 'inquiry@xpiohealth.com',
        name: 'Xpio Health Team'
      },
      subject: `Thanks for Connecting with Xpio Health, ${firstName}!`,
      html: emailBody,
    };

    const result = await sgMail.send(msg);
    console.log(`✅ Visitor confirmation email sent to: ${lead.email}`);
    return { success: true, messageId: result[0].headers['x-message-id'] };
  } catch (error) {
    console.error('❌ Failed to send visitor confirmation email:', error);
    return { success: false, error: error.message };
  }
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

export default { sendLeadNotification, sendVisitorConfirmation, testEmailConfiguration };
