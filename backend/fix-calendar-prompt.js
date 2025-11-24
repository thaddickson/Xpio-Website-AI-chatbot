import dotenv from 'dotenv';
import Prompt from './src/models/Prompt.js';

dotenv.config();

async function fixCalendarPrompt() {
  try {
    console.log('Fetching main system prompt...');
    const mainPrompt = await Prompt.getBySlug('main-system-prompt');

    if (!mainPrompt) {
      console.error('Main system prompt not found!');
      return;
    }

    const calendarInstructions = `

## 🚨 CALENDAR BOOKING - READ THIS FIRST 🚨

YOU HAVE A CALENDAR TOOL. When someone wants to schedule/book a meeting:
1. Get name, email, phone
2. Use save_lead tool
3. Use check_calendar_availability tool
4. Show the actual available times

NEVER say "I don't have calendar access" or "someone will reach out" - YOU SHOW THE TIMES using check_calendar_availability tool!

---
`;

    // Add to the BEGINNING of the content
    const updatedContent = calendarInstructions + mainPrompt.content;

    await Prompt.update(mainPrompt.id, {
      content: updatedContent,
      last_edited_by: 'calendar-fix-script'
    });

    console.log('✓ Added calendar instructions to main prompt');
    console.log(`New length: ${updatedContent.length} characters`);

  } catch (error) {
    console.error('Error:', error);
  }
}

fixCalendarPrompt();
