/**
 * Setup script to initialize the database and test email configuration
 * Run with: node setup.js
 */

import dotenv from 'dotenv';

// Load environment variables FIRST before importing other modules
dotenv.config();

import { initializeDatabase } from './src/models/Lead.js';
import { testEmailConfiguration } from './src/services/emailService.js';

async function setup() {
  console.log('🚀 Starting Xpio Health Chatbot Setup...\n');

  // Check required environment variables
  const required = [
    'ANTHROPIC_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_KEY'
  ];

  const optional = [
    'EMAIL_USER',
    'EMAIL_PASSWORD',
    'NOTIFICATION_EMAIL'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n💡 Please create a .env file with all required variables.');
    console.error('   See .env.example for reference.\n');
    process.exit(1);
  }

  console.log('✅ Environment variables validated\n');

  // Initialize database
  try {
    console.log('📊 Connecting to Supabase...');
    await initializeDatabase();
    console.log('✅ Supabase connection successful\n');
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
    console.error('\n💡 Check your SUPABASE_URL and SUPABASE_KEY in .env file.\n');
    process.exit(1);
  }

  // Test email configuration (optional)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    try {
      console.log('📧 Testing email configuration...');
      const emailOk = await testEmailConfiguration();
      if (emailOk) {
        console.log('✅ Email service configured correctly\n');
      } else {
        console.error('❌ Email configuration failed');
        console.error('💡 Check your EMAIL_USER and EMAIL_PASSWORD\n');
        console.error('For Gmail:');
        console.error('  1. Enable 2FA on your Google account');
        console.error('  2. Generate App Password: https://myaccount.google.com/apppasswords');
        console.error('  3. Use the app password (not your regular password)\n');
      }
    } catch (error) {
      console.error('❌ Email test failed:', error.message);
    }
  } else {
    console.log('⚠️  Email configuration not set (optional - leads will still be saved to database)\n');
  }

  // Test Anthropic API key
  try {
    console.log('🤖 Testing Anthropic API...');
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Simple test call
    await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'test' }]
    });

    console.log('✅ Anthropic API key is valid\n');
  } catch (error) {
    console.error('❌ Anthropic API test failed:', error.message);
    console.error('💡 Check your ANTHROPIC_API_KEY');
    console.error('   Get one at: https://console.anthropic.com\n');
  }

  console.log('✨ Setup complete! You can now start the server with:');
  console.log('   npm run dev   (development)');
  console.log('   npm start     (production)\n');
}

setup();
