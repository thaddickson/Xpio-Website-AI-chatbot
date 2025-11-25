import dotenv from 'dotenv';
import Prompt from './src/models/Prompt.js';

dotenv.config();

async function updateAIPrompt() {
  try {
    console.log('Fetching main system prompt...');
    const mainPrompt = await Prompt.getBySlug('main-system-prompt');

    if (!mainPrompt) {
      console.error('Main system prompt not found!');
      return;
    }

    // Find the "Which Service to Lead With" section and update it
    const oldSection = `Which Service to Lead With
IF visitor mentions:

"data" / "reports" / "analytics" / "dashboards" → Analytics Platform
"security" / "HIPAA" / "breach" / "cyber attack" / "compliance" → Cybersecurity
"EHR" + frustration/problems → Ask: "Are you looking to select a new EHR, or improve your current one?"
"EHR" + selection/shopping → EHR Consulting (emphasize vendor-neutral)
"integration" / "systems not talking" / "HIE" → Technical Integration
Vague or general inquiry → Start with Analytics (most universal pain point)`;

    const newSection = `Which Service to Lead With
IF visitor mentions:

"AI" / "artificial intelligence" / "machine learning" / "predictive" → CRITICAL: Lead with our AI expertise!
  - "We're actually AI specialists! We have two powerful AI solutions:
    1. **Xpio Analytics Platform** - AI-powered data warehouse with predictive analytics, no-show prediction, and custom dashboards
    2. **Pryzma Platform** - Build custom AI-powered healthcare applications 10x faster
    Plus, we can often ADD AI capabilities to your existing EHR rather than replacing it. What AI capabilities are most important to you?"

"data" / "reports" / "analytics" / "dashboards" → Analytics Platform
"security" / "HIPAA" / "breach" / "cyber attack" / "compliance" → Cybersecurity
"EHR" + "AI" or "outdated" or "no features" → IMPORTANT: Present ALL THREE options:
  1. Keep current EHR + Add Xpio Analytics (AI dashboards, weeks to deploy)
  2. Optimize current EHR (unlock hidden features, configure properly)
  3. Build custom with Pryzma (AI-powered apps without replacing EHR)
  Only suggest EHR replacement as option 4 if none of the above fit
"EHR" + frustration/problems → Ask: "Are you looking to select a new EHR, or would you prefer to enhance your current one with AI capabilities?"
"EHR" + selection/shopping → EHR Consulting (emphasize vendor-neutral)
"integration" / "systems not talking" / "HIE" → Technical Integration
Vague or general inquiry → Start with Analytics (most universal pain point)`;

    if (!mainPrompt.content.includes(oldSection)) {
      console.log('Could not find exact section to replace. Looking for partial match...');

      // Try a more flexible replacement
      const partialOld = `"EHR" + frustration/problems → Ask: "Are you looking to select a new EHR, or optimize your current one?"`;
      const partialNew = `"AI" / "artificial intelligence" / "machine learning" / "predictive" → CRITICAL: Lead with AI expertise!
  - Present our two AI solutions: Xpio Analytics Platform (AI dashboards) and Pryzma Platform (custom AI apps)
  - Mention we can ADD AI to existing EHR rather than replacing it
  - Ask: "What AI capabilities are most important to you?"

"EHR" + "AI" or "outdated" or "no features" → Present THREE options before suggesting replacement:
  1. Keep EHR + Add Xpio Analytics (AI dashboards, weeks to deploy)
  2. Optimize current EHR (unlock hidden features)
  3. Build custom with Pryzma Platform (AI apps without EHR replacement)

"EHR" + frustration/problems → Ask: "Are you looking to select a new EHR, or would you prefer to enhance your current one with AI capabilities?"`;

      if (mainPrompt.content.includes(partialOld)) {
        const updatedContent = mainPrompt.content.replace(partialOld, partialNew);
        await Prompt.update(mainPrompt.id, {
          content: updatedContent,
          last_edited_by: 'ai-update-script'
        });
        console.log('✓ Updated main prompt with AI handling (partial replacement)');
        console.log(`New length: ${updatedContent.length} characters`);
      } else {
        console.log('Could not find section to replace. Manual update required.');
        console.log('Section being searched for:');
        console.log(partialOld);
      }
      return;
    }

    const updatedContent = mainPrompt.content.replace(oldSection, newSection);

    await Prompt.update(mainPrompt.id, {
      content: updatedContent,
      last_edited_by: 'ai-update-script'
    });

    console.log('✓ Updated main prompt with AI handling');
    console.log(`New length: ${updatedContent.length} characters`);

  } catch (error) {
    console.error('Error:', error);
  }
}

updateAIPrompt();
