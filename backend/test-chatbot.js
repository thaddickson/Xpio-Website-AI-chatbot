/**
 * Chatbot Test Agent
 *
 * Simulates customer conversations and validates chatbot behavior.
 * Uses Claude to act as a "mystery shopper" testing the chatbot.
 *
 * Usage: node test-chatbot.js [scenario]
 *
 * Scenarios:
 *   - lead-capture: Test lead capture flow
 *   - calendar: Test calendar/scheduling functionality
 *   - handoff: Test handoff to human request
 *   - knowledge: Test product knowledge responses
 *   - all: Run all scenarios (default)
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const WIDGET_KEY = process.env.TEST_WIDGET_KEY || 'test-widget-key';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Test scenarios
const SCENARIOS = {
  'lead-capture': {
    name: 'Lead Capture Flow',
    description: 'Test that the chatbot captures lead information correctly',
    customerPersona: `You are a potential customer named "Test User" from "Acme Healthcare".
Your email is test-${Date.now()}@example.com. You're interested in reducing patient no-shows.
Be cooperative but don't volunteer information until asked. Answer questions naturally.`,
    expectedBehaviors: [
      'Should ask for contact information',
      'Should capture name and email',
      'Should discuss pain points',
      'Should offer to schedule a meeting'
    ],
    maxTurns: 8,
    validations: [
      { type: 'response_contains', value: 'email', message: 'Should ask for email' },
      { type: 'response_contains', value: 'schedule', message: 'Should mention scheduling' }
    ]
  },

  'calendar': {
    name: 'Calendar Scheduling',
    description: 'Test that available times are shown correctly',
    customerPersona: `You are interested in scheduling a demo. When asked for info, provide:
Name: Calendar Test, Email: calendar-test@example.com, Company: Test Corp.
Ask specifically for available meeting times.`,
    expectedBehaviors: [
      'Should use the calendar tool',
      'Should show times in clean format (not raw URLs)',
      'Should mention the Schedule a Meeting button'
    ],
    maxTurns: 6,
    validations: [
      { type: 'response_not_contains', value: 'calendly.com/d/', message: 'Should NOT show raw Calendly booking URLs' },
      { type: 'response_contains', value: 'Schedule a Meeting', message: 'Should mention Schedule button' }
    ]
  },

  'handoff': {
    name: 'Human Handoff',
    description: 'Test requesting to speak with a human',
    customerPersona: `You want to speak with a real person, not an AI.
Be polite but insistent that you need human assistance.`,
    expectedBehaviors: [
      'Should acknowledge the request',
      'Should initiate handoff process',
      'Should not refuse or deflect repeatedly'
    ],
    maxTurns: 4,
    validations: [
      { type: 'response_contains_any', values: ['human', 'person', 'team', 'connect'], message: 'Should acknowledge human request' }
    ]
  },

  'knowledge': {
    name: 'Product Knowledge',
    description: 'Test that the bot knows about Xpio Health services',
    customerPersona: `You're researching healthcare analytics solutions.
Ask about what services they offer and how they help reduce no-shows.`,
    expectedBehaviors: [
      'Should explain Xpio Health services',
      'Should mention relevant capabilities',
      'Should be knowledgeable about healthcare analytics'
    ],
    maxTurns: 4,
    validations: [
      { type: 'response_contains_any', values: ['analytics', 'no-show', 'patient', 'healthcare'], message: 'Should discuss relevant topics' }
    ]
  }
};

/**
 * Send a message to the chatbot and get response
 */
async function sendMessage(conversationId, message) {
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-widget-key': WIDGET_KEY
      },
      body: JSON.stringify({
        message,
        conversationId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Read SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let toolsUsed = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'content') {
              fullResponse += data.content;
            } else if (data.type === 'tool_use') {
              toolsUsed.push(data.tool);
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }

    return { response: fullResponse, toolsUsed };
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

/**
 * Use Claude to generate customer responses
 */
async function generateCustomerMessage(persona, conversationHistory, botResponse) {
  const messages = [
    {
      role: 'user',
      content: `You are acting as a customer testing a chatbot. Here's your persona:

${persona}

The conversation so far:
${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

The chatbot just said:
"${botResponse}"

Respond naturally as this customer would. Keep your response concise (1-2 sentences).
If the conversation seems complete (you've shared your info and they've offered help), say "END_CONVERSATION".
Only output your response, nothing else.`
    }
  ];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages
  });

  return response.content[0].text.trim();
}

/**
 * Run validation checks on responses
 */
function runValidations(responses, validations) {
  const results = [];
  const allText = responses.join(' ').toLowerCase();

  for (const validation of validations) {
    let passed = false;

    switch (validation.type) {
      case 'response_contains':
        passed = allText.includes(validation.value.toLowerCase());
        break;
      case 'response_not_contains':
        passed = !allText.includes(validation.value.toLowerCase());
        break;
      case 'response_contains_any':
        passed = validation.values.some(v => allText.includes(v.toLowerCase()));
        break;
    }

    results.push({
      ...validation,
      passed,
      status: passed ? '✅' : '❌'
    });
  }

  return results;
}

/**
 * Run a single test scenario
 */
async function runScenario(scenarioKey) {
  const scenario = SCENARIOS[scenarioKey];
  if (!scenario) {
    console.error(`Unknown scenario: ${scenarioKey}`);
    return null;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Testing: ${scenario.name}`);
  console.log(`   ${scenario.description}`);
  console.log('='.repeat(60));

  const conversationId = uuidv4();
  const conversationHistory = [];
  const botResponses = [];
  const allToolsUsed = [];
  let turn = 0;

  // Start with an initial customer message
  let customerMessage = await generateCustomerMessage(
    scenario.customerPersona,
    [],
    'Hello! How can I help you today?'
  );

  while (turn < scenario.maxTurns && customerMessage !== 'END_CONVERSATION') {
    turn++;
    console.log(`\n--- Turn ${turn} ---`);
    console.log(`👤 Customer: ${customerMessage}`);

    conversationHistory.push({ role: 'customer', content: customerMessage });

    // Send to chatbot
    const { response: botResponse, toolsUsed } = await sendMessage(conversationId, customerMessage);

    console.log(`🤖 Chatbot: ${botResponse.substring(0, 200)}${botResponse.length > 200 ? '...' : ''}`);

    if (toolsUsed.length > 0) {
      console.log(`   🔧 Tools used: ${toolsUsed.join(', ')}`);
      allToolsUsed.push(...toolsUsed);
    }

    conversationHistory.push({ role: 'chatbot', content: botResponse });
    botResponses.push(botResponse);

    // Generate next customer response
    customerMessage = await generateCustomerMessage(
      scenario.customerPersona,
      conversationHistory,
      botResponse
    );

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Run validations
  console.log(`\n📋 Validation Results:`);
  const validationResults = runValidations(botResponses, scenario.validations);

  for (const result of validationResults) {
    console.log(`   ${result.status} ${result.message}`);
  }

  const passedCount = validationResults.filter(r => r.passed).length;
  const totalCount = validationResults.length;
  const passed = passedCount === totalCount;

  console.log(`\n${passed ? '✅' : '❌'} Scenario ${passed ? 'PASSED' : 'FAILED'} (${passedCount}/${totalCount} validations)`);

  return {
    scenario: scenarioKey,
    name: scenario.name,
    passed,
    turns: turn,
    validations: validationResults,
    toolsUsed: [...new Set(allToolsUsed)]
  };
}

/**
 * Run all test scenarios
 */
async function runAllTests() {
  console.log('\n🚀 Xpio Chatbot Test Suite');
  console.log('==========================\n');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Widget Key: ${WIDGET_KEY}`);

  const results = [];
  const scenarioKeys = Object.keys(SCENARIOS);

  for (const key of scenarioKeys) {
    try {
      const result = await runScenario(key);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.error(`\n❌ Error running scenario ${key}:`, error.message);
      results.push({
        scenario: key,
        name: SCENARIOS[key].name,
        passed: false,
        error: error.message
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));

  const passedScenarios = results.filter(r => r.passed).length;
  const totalScenarios = results.length;

  for (const result of results) {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}${result.error ? ` (Error: ${result.error})` : ''}`);
  }

  console.log(`\nOverall: ${passedScenarios}/${totalScenarios} scenarios passed`);

  return {
    passed: passedScenarios === totalScenarios,
    results
  };
}

// Main execution
const scenario = process.argv[2] || 'all';

if (scenario === 'all') {
  runAllTests()
    .then(({ passed }) => process.exit(passed ? 0 : 1))
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
} else if (SCENARIOS[scenario]) {
  runScenario(scenario)
    .then(result => process.exit(result?.passed ? 0 : 1))
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
} else {
  console.log('Available scenarios:');
  Object.keys(SCENARIOS).forEach(key => {
    console.log(`  - ${key}: ${SCENARIOS[key].description}`);
  });
  console.log('  - all: Run all scenarios');
}
