import dotenv from 'dotenv';
dotenv.config();

import { sendLeadToSlack, testSlackConfiguration } from './src/services/slackService.js';

console.log('🧪 Testing Slack integration...\n');

// First test configuration
console.log('Testing Slack configuration...');
testSlackConfiguration().then(async (isConfigured) => {
  if (!isConfigured) {
    console.log('\n❌ Slack is not configured correctly. Check your .env file.');
    process.exit(1);
  }

  console.log('\n✅ Slack configuration is valid!\n');
  console.log('Now sending test lead notification...\n');

  // Test lead data
  const testLead = {
    id: 'test-slack-123',
    name: 'Test User',
    email: 'test@example.com',
    phone: '555-1234',
    organization: 'Test Company',
    role: 'CEO',
    organization_size: '50-100',
    primary_interest: 'Testing the Slack notification system',
    qualification_score: 'hot',
    current_systems: 'None',
    timeline: 'Immediate',
    budget_range: '$10k-50k',
    pain_points: 'Want to verify Slack integration is working',
    next_steps: 'Check Slack for this test message',
    conversation_summary: 'This is a test to verify the Slack notification system is working correctly.',
    conversation_history: JSON.stringify([
      { role: 'assistant', content: 'Hi! Welcome to Xpio Health. How can we help you today?' },
      { role: 'user', content: 'I want to test the Slack integration' },
      { role: 'assistant', content: 'Great! Let me capture your information.' },
      { role: 'user', content: 'My name is Test User and email is test@example.com' }
    ]),
    created_at: new Date().toISOString()
  };

  try {
    const result = await sendLeadToSlack(testLead);

    if (result.success) {
      console.log('✅ SUCCESS! Slack notification sent!\n');
      console.log('Message sent to channel:', result.channel);
      console.log('Message timestamp:', result.ts);
      console.log('\n📱 Check your Slack channel for the test lead notification!');
    } else if (result.skipped) {
      console.log('⚠️  Slack notification was skipped (not configured)');
    } else {
      console.log('❌ Failed to send Slack notification:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
});
