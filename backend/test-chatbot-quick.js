/**
 * Quick Chatbot Validation Tests
 *
 * Sends specific test messages and validates expected behaviors.
 * Faster than the full AI-driven test suite.
 *
 * Usage: node test-chatbot-quick.js
 *
 * Environment variables:
 *   API_BASE_URL - Server URL (default: http://localhost:3000)
 *   TEST_WIDGET_KEY - Your widget API key (pk_live_...) from Admin > Settings > API Keys
 *                     If not set, uses default tenant (works for single-tenant setups)
 */

import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const WIDGET_KEY = process.env.TEST_WIDGET_KEY; // Optional - if not set, uses default tenant

// Quick test cases
const TEST_CASES = [
  {
    name: 'Greeting Response',
    message: 'Hello',
    validates: [
      { check: 'length > 50', desc: 'Response should be substantial' },
      { check: 'contains_any:help,assist,Xpio,healthcare', desc: 'Should mention help or Xpio' }
    ]
  },
  {
    name: 'No-Show Question',
    message: 'How can you help reduce patient no-shows?',
    validates: [
      { check: 'contains_any:no-show,appointment,reminder,analytics,patient', desc: 'Should discuss no-show solutions' },
      { check: 'length > 100', desc: 'Should provide detailed answer' }
    ]
  },
  {
    name: 'Calendar Request',
    message: 'What times are available for a meeting?',
    validates: [
      { check: 'not_contains:calendly.com/d/', desc: 'Should NOT show raw Calendly URLs' },
      { check: 'contains_any:Schedule a Meeting,available,time', desc: 'Should discuss scheduling' }
    ]
  },
  {
    name: 'Contact Info Capture',
    message: 'My name is Test User and my email is quicktest@example.com',
    validates: [
      { check: 'contains_any:thank,got it,saved,noted,great', desc: 'Should acknowledge info' }
    ]
  },
  {
    name: 'Human Handoff Request',
    message: 'I want to talk to a real person please',
    validates: [
      { check: 'contains_any:human,person,team,connect,reach out', desc: 'Should acknowledge human request' }
    ]
  }
];

/**
 * Send a message and get response
 */
async function sendMessage(conversationId, message) {
  const headers = {
    'Content-Type': 'application/json'
  };

  // Only add API key header if provided
  if (WIDGET_KEY) {
    headers['x-api-key'] = WIDGET_KEY;
  }

  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, conversationId })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let toolsUsed = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'content') fullResponse += data.content;
          if (data.type === 'tool_use') toolsUsed.push(data.tool);
        } catch (e) {}
      }
    }
  }

  return { response: fullResponse, toolsUsed };
}

/**
 * Run validation check
 */
function validate(response, check) {
  const text = response.toLowerCase();

  if (check.startsWith('length > ')) {
    const minLen = parseInt(check.split(' ')[2]);
    return response.length > minLen;
  }

  if (check.startsWith('contains:')) {
    const value = check.split(':')[1].toLowerCase();
    return text.includes(value);
  }

  if (check.startsWith('not_contains:')) {
    const value = check.split(':')[1].toLowerCase();
    return !text.includes(value);
  }

  if (check.startsWith('contains_any:')) {
    const values = check.split(':')[1].split(',');
    return values.some(v => text.includes(v.toLowerCase()));
  }

  return false;
}

/**
 * Run all quick tests
 */
async function runQuickTests() {
  console.log('\n⚡ Quick Chatbot Validation');
  console.log('===========================\n');
  console.log(`API: ${API_BASE}`);
  console.log(`Widget Key: ${WIDGET_KEY ? WIDGET_KEY.substring(0, 15) + '...' : '(none - using default tenant)'}\n`);

  let passed = 0;
  let failed = 0;

  for (const test of TEST_CASES) {
    const conversationId = uuidv4();

    console.log(`\n📝 ${test.name}`);
    console.log(`   Sending: "${test.message}"`);

    try {
      const { response, toolsUsed } = await sendMessage(conversationId, test.message);

      console.log(`   Response: "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`);

      if (toolsUsed.length > 0) {
        console.log(`   Tools: ${toolsUsed.join(', ')}`);
      }

      let allPassed = true;
      for (const v of test.validates) {
        const result = validate(response, v.check);
        const icon = result ? '✅' : '❌';
        console.log(`   ${icon} ${v.desc}`);
        if (!result) allPassed = false;
      }

      if (allPassed) {
        passed++;
      } else {
        failed++;
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      failed++;
    }

    // Small delay
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '='.repeat(40));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  return failed === 0;
}

// Run tests
runQuickTests()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Tests failed:', err);
    process.exit(1);
  });
