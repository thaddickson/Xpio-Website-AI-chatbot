import dotenv from 'dotenv';
import Prompt from './src/models/Prompt.js';

dotenv.config();

async function updateAITriggers() {
  try {
    console.log('Fetching main system prompt...');
    const mainPrompt = await Prompt.getBySlug('main-system-prompt');

    if (!mainPrompt) {
      console.error('Main system prompt not found!');
      return;
    }

    const content = mainPrompt.content;

    // Update the "Which Service to Lead With" AI trigger to catch more phrases
    const oldTrigger = `"AI" / "artificial intelligence" / "machine learning" / "predictive" → CRITICAL: Lead with our AI expertise!`;

    const newTrigger = `"AI" / "artificial intelligence" / "machine learning" / "predictive" / "learn about AI" / "use AI" / "adopt AI" / "AI for our org" → CRITICAL: Lead with our AI expertise!`;

    if (content.includes(oldTrigger)) {
      let updated = content.replace(oldTrigger, newTrigger);

      // Also update the response to include consulting
      const oldResponse = `  - "We're actually AI specialists! We have two powerful AI solutions:
    1. **Xpio Analytics Platform** - AI-powered data warehouse with predictive analytics, no-show prediction, and custom dashboards
    2. **Pryzma Platform** - Build custom AI-powered healthcare applications 10x faster
    Plus, we can often ADD AI capabilities to your existing EHR rather than replacing it. What AI capabilities are most important to you?"`;

      const newResponse = `  - "You're in the right place - we're AI specialists AND security experts! We offer:
    1. **Xpio Analytics Platform** - AI-powered dashboards with predictive analytics and no-show prediction
    2. **Pryzma Platform** - Build custom AI healthcare apps 10x faster
    3. **AI Consulting** - Help your org effectively and compliantly adopt AI
    Plus we're experts in **NIST AI RMF** for AI governance and compliance.
    We can often ADD AI to your existing EHR rather than replacing it. What are you hoping AI can help with?"`;

      if (updated.includes(oldResponse)) {
        updated = updated.replace(oldResponse, newResponse);
        console.log('✓ Also updated the AI response text');
      }

      await Prompt.update(mainPrompt.id, {
        content: updated,
        last_edited_by: 'ai-triggers-update'
      });
      console.log('✓ Updated AI triggers to catch more phrases');
      console.log('New length:', updated.length);
    } else {
      console.log('Could not find AI trigger section.');

      // Show what we have
      const idx = content.indexOf('Which Service to Lead With');
      if (idx > -1) {
        console.log('Current section:');
        console.log(content.substring(idx, idx + 1500));
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

updateAITriggers();
