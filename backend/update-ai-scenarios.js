import dotenv from 'dotenv';
import Prompt from './src/models/Prompt.js';

dotenv.config();

async function updateAIScenarios() {
  try {
    console.log('Fetching main system prompt...');
    const mainPrompt = await Prompt.getBySlug('main-system-prompt');

    if (!mainPrompt) {
      console.error('Main system prompt not found!');
      return;
    }

    // Find the "We need help with our EHR" scenario and add AI scenarios before it
    const oldScenarioStart = `"We need help with our EHR"

Ask first: "Are you looking to select a new EHR, or optimize your current one?"`;

    const aiScenarios = `"We want AI" or "Our EHR has no AI features" or "Looking for AI solutions"

CRITICAL - Present our AI expertise FIRST:
Response: "You're in the right place - we're AI specialists! We have two powerful options:
1. **Xpio Analytics Platform** - AI-powered dashboards with predictive analytics and no-show prediction
2. **Pryzma Platform** - Build custom AI healthcare applications 10x faster

The best part? We can often ADD these AI capabilities to your existing EHR rather than replacing it."
Ask: "What specific AI capabilities are you looking for?"

"Our EHR is outdated" or "Need new features"

IMPORTANT - Don't assume they need to replace their EHR:
Response: "Before we talk about replacing your EHR, let me share three options that might save you time and money:
1. **Add Xpio Analytics** - Get AI dashboards and insights on top of your current EHR (deploys in weeks)
2. **Optimize your current EHR** - We often help unlock features people didn't know existed
3. **Build with Pryzma** - Create custom AI tools that work alongside your EHR

What's the biggest gap in your current system?"

"We need help with our EHR"

Ask first: "Are you looking to select a new EHR, or would you prefer to enhance your current one with AI capabilities?"`;

    if (!mainPrompt.content.includes(oldScenarioStart)) {
      console.log('Could not find exact scenario start. Trying alternative...');

      // Try alternative
      const altOld = `"We need help with our EHR"`;
      const altNew = `"We want AI" or "Our EHR has no AI features" or "Looking for AI solutions"

CRITICAL - Present our AI expertise FIRST:
Response: "You're in the right place - we're AI specialists! We have two powerful options:
1. **Xpio Analytics Platform** - AI-powered dashboards with predictive analytics and no-show prediction
2. **Pryzma Platform** - Build custom AI healthcare applications 10x faster

The best part? We can often ADD these AI capabilities to your existing EHR rather than replacing it."
Ask: "What specific AI capabilities are you looking for?"

"Our EHR is outdated" or "Need new features"

IMPORTANT - Don't assume they need to replace their EHR:
Response: "Before we talk about replacing your EHR, let me share three options that might save you time and money:
1. **Add Xpio Analytics** - Get AI dashboards and insights on top of your current EHR (deploys in weeks)
2. **Optimize your current EHR** - We often help unlock features people didn't know existed
3. **Build with Pryzma** - Create custom AI tools that work alongside your EHR

What's the biggest gap in your current system?"

"We need help with our EHR"`;

      // Check if AI scenarios already exist
      if (mainPrompt.content.includes('"We want AI"')) {
        console.log('AI scenarios already added. Skipping.');
        return;
      }

      if (mainPrompt.content.includes(altOld)) {
        const updatedContent = mainPrompt.content.replace(altOld, altNew);
        await Prompt.update(mainPrompt.id, {
          content: updatedContent,
          last_edited_by: 'ai-scenarios-script'
        });
        console.log('✓ Added AI scenarios to main prompt');
        console.log(`New length: ${updatedContent.length} characters`);
      } else {
        console.log('Could not find EHR scenario. Manual update needed.');
      }
      return;
    }

    const updatedContent = mainPrompt.content.replace(oldScenarioStart, aiScenarios);

    await Prompt.update(mainPrompt.id, {
      content: updatedContent,
      last_edited_by: 'ai-scenarios-script'
    });

    console.log('✓ Added AI scenarios to main prompt');
    console.log(`New length: ${updatedContent.length} characters`);

  } catch (error) {
    console.error('Error:', error);
  }
}

updateAIScenarios();
