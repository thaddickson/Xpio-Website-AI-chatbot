import dotenv from 'dotenv';
import Prompt from './src/models/Prompt.js';

dotenv.config();

async function updateAISecurity() {
  try {
    console.log('Fetching main system prompt...');
    const mainPrompt = await Prompt.getBySlug('main-system-prompt');

    if (!mainPrompt) {
      console.error('Main system prompt not found!');
      return;
    }

    const content = mainPrompt.content;

    // Find and replace the AI scenario section
    const oldPattern = `"We want AI" or "Our EHR has no AI features" or "Looking for AI solutions"

CRITICAL - Present our AI expertise FIRST:
Response: "You're in the right place - we're AI specialists! We have two powerful options:
1. **Xpio Analytics Platform** - AI-powered dashboards with predictive analytics and no-show prediction
2. **Pryzma Platform** - Build custom AI healthcare applications 10x faster

The best part? We can often ADD these AI capabilities to your existing EHR rather than replacing it."
Ask: "What specific AI capabilities are you looking for?"`;

    const newPattern = `"We want AI" or "Our EHR has no AI features" or "Looking for AI solutions" or "AI consulting" or "learn about AI"

CRITICAL - Present our COMPLETE AI expertise (we're AI AND security experts):
Response: "You're in the right place - we're AI specialists AND security experts! Here's how we help:

**AI Solutions:**
1. **Xpio Analytics Platform** - AI-powered dashboards with predictive analytics and no-show prediction
2. **Pryzma Platform** - Build custom AI healthcare applications 10x faster
3. **AI Consulting Services** - Help your organization effectively and compliantly adopt AI to improve the health of your organization

**AI Security & Compliance Expertise:**
- Experts in the **NIST AI Risk Management Framework (AI RMF)**
- AI governance, risk assessment, and responsible AI implementation
- Ensure AI tools are secure, compliant, and aligned with healthcare regulations

The best part? We can often ADD AI capabilities to your existing EHR rather than replacing it."
Ask: "Are you looking for AI tools, help implementing AI compliantly, or both?"`;

    if (content.includes(oldPattern)) {
      const updated = content.replace(oldPattern, newPattern);
      await Prompt.update(mainPrompt.id, {
        content: updated,
        last_edited_by: 'ai-security-update'
      });
      console.log('✓ Updated AI section with security/compliance expertise');
      console.log('New length:', updated.length);
    } else {
      console.log('Could not find exact AI section to replace.');
      console.log('Searching for partial match...');

      // Try partial match
      if (content.includes('"We want AI"')) {
        console.log('Found "We want AI" - section exists but format differs');
        console.log('Manual update may be needed via admin dashboard');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

updateAISecurity();
