import Lead from '../models/Lead.js';
import { sendLeadNotification, sendVisitorConfirmation } from './emailService.js';
import { sendLeadToSlack } from './slackService.js';

/**
 * Save a new lead and send notifications
 * @param {Object} leadData - Lead information from Claude
 * @param {string} conversationId - Unique conversation ID
 * @param {Array} conversationHistory - Full conversation messages
 * @returns {Object} Result with success status and lead ID
 */
export async function saveLead(leadData, conversationId, conversationHistory) {
  try {
    console.log(`📝 Saving new lead: ${leadData.name} (${leadData.email})`);

    // Check if email already exists (optional - remove if you want to allow duplicates)
    const emailExists = await Lead.emailExists(leadData.email);
    if (emailExists) {
      console.log(`⚠️  Email ${leadData.email} already exists in database`);
      // Still allow saving but log it - you might want different behavior
    }

    // Validate required fields
    if (!leadData.name || !leadData.email || !leadData.primary_interest) {
      throw new Error('Missing required lead information');
    }

    // Prepare lead data for database
    const lead = await Lead.create({
      ...leadData,
      conversationId,
      conversationHistory,
      source: 'website_chatbot'
    });

    console.log(`✓ Lead saved with ID: ${lead.id}`);

    // Send email notification (don't wait for it)
    sendLeadNotification(lead).catch(err => {
      console.error('Failed to send notification email:', err);
    });

    // Send Slack notification (don't wait for it)
    sendLeadToSlack(lead).catch(err => {
      console.error('Failed to send Slack notification:', err);
    });

    // Send confirmation email to the visitor (don't wait for it)
    const calendlyLink = process.env.CALENDLY_EVENT_LINK || 'https://calendly.com/thad-xpiohealth/30min';
    sendVisitorConfirmation(lead, calendlyLink).catch(err => {
      console.error('Failed to send visitor confirmation email:', err);
    });

    // Optional: Send to CRM (implement if needed)
    // await sendToCRM(lead);

    return {
      success: true,
      leadId: lead.id,
      message: 'Lead captured successfully! Our team will reach out to you shortly.',
      isNewLead: !emailExists
    };
  } catch (error) {
    console.error('❌ Error saving lead:', error);
    throw new Error(`Failed to save lead: ${error.message}`);
  }
}

/**
 * Get lead statistics
 * @returns {Object} Lead statistics
 */
export async function getLeadStats() {
  try {
    const [hotLeads, warmLeads, coldLeads] = await Promise.all([
      Lead.getByQualificationScore('hot'),
      Lead.getByQualificationScore('warm'),
      Lead.getByQualificationScore('cold')
    ]);

    return {
      hot: hotLeads.length,
      warm: warmLeads.length,
      cold: coldLeads.length,
      total: hotLeads.length + warmLeads.length + coldLeads.length
    };
  } catch (error) {
    console.error('Error getting lead stats:', error);
    return { hot: 0, warm: 0, cold: 0, total: 0 };
  }
}

/**
 * Optional: Send lead to CRM (HubSpot, Salesforce, etc.)
 * Implement this based on your CRM
 */
async function sendToCRM(lead) {
  // Example for HubSpot
  if (process.env.HUBSPOT_API_KEY) {
    try {
      // Implement HubSpot API call here
      console.log('✓ Lead sent to HubSpot CRM');
    } catch (error) {
      console.error('Failed to send lead to CRM:', error);
    }
  }
}

export default { saveLead, getLeadStats };
