import dotenv from 'dotenv';
dotenv.config();

import { sendLeadNotification } from './src/services/emailService.js';

// Test lead data
const testLead = {
  id: 'test-123',
  name: 'Test User',
  email: 'test@example.com',
  phone: '555-1234',
  organization: 'Test Company',
  role: 'CEO',
  organization_size: '50-100',
  primary_interest: 'Testing the email notification system',
  qualification_score: 'hot',
  current_systems: 'None',
  timeline: 'Immediate',
  budget_range: '$10k-50k',
  pain_points: 'Want to verify emails are working',
  next_steps: 'Check inbox for this test email',
  conversation_summary: 'This is a test to verify the email notification system is working correctly.',
  conversation_history: JSON.stringify([
    { role: 'assistant', content: 'Hi! Welcome to Xpio Health. How can we help you today?' },
    { role: 'user', content: 'I want to test the email system' },
    { role: 'assistant', content: 'Great! Let me capture your information.' },
    { role: 'user', content: 'My name is Test User and email is test@example.com' }
  ]),
  created_at: new Date().toISOString()
};

console.log('🧪 Testing email notification...\n');
console.log('Environment check:');
console.log('SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? '✅ SET' : '❌ NOT SET');
console.log('NOTIFICATION_EMAIL:', process.env.NOTIFICATION_EMAIL || '❌ NOT SET');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM || '❌ NOT SET');
console.log('\nSending test email to:', process.env.NOTIFICATION_EMAIL);
console.log('---\n');

sendLeadNotification(testLead)
  .then(result => {
    if (result.success) {
      console.log('✅ SUCCESS! Test email sent successfully!');
      console.log('Message ID:', result.messageId);
      console.log('\n📧 Check your inbox at:', process.env.NOTIFICATION_EMAIL);
      console.log('Subject: 🔥 HOT Lead: Test User - Test Company');
    } else if (result.skipped) {
      console.log('⚠️  Email sending was skipped:', result.reason);
    } else {
      console.log('❌ FAILED to send email:', result.error);
    }
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
