import dotenv from 'dotenv';
import Prompt from './src/models/Prompt.js';

dotenv.config();

async function fixCalendarWorkflow() {
  try {
    console.log('Fetching tool-instructions prompt...');
    const toolPrompt = await Prompt.getBySlug('tool-instructions');

    if (!toolPrompt) {
      console.error('Tool instructions prompt not found!');
      return;
    }

    const content = toolPrompt.content;

    // Find and replace the calendar workflow section
    const oldWorkflow = `## 🔒 CALENDAR BOOKING - STRICT WORKFLOW 🔒

**MANDATORY SEQUENCE WHEN SOMEONE ASKS TO SCHEDULE:**

Step 1: Get their info
- "I'd love to show you Thad's availability! Can I get your name, email, and phone number?"

Step 2: Use save_lead tool

Step 3: IMMEDIATELY use check_calendar_availability tool
- DO NOT say "we'll be in touch" and stop
- DO NOT end the conversation
- CONTINUE by showing the times!

Step 4: Show times in table format

**CRITICAL RULES:**
- ❌ NEVER say "we'll be in touch" after save_lead when user asked for meeting times
- ❌ NEVER end conversation after capturing lead info if they want to schedule
- ✅ ALWAYS follow save_lead with check_calendar_availability when scheduling
- ✅ Show the times immediately after lead is saved

**Example conversation:**
User: "can you schedule a meeting"
You: "Absolutely! Can I get your name, email, and phone number so I can show you available times?"
User: "John Smith, john@example.com, 555-1234"
You: *use save_lead tool* ← captures info
You: *use check_calendar_availability tool* ← gets times
You: *show formatted table* ← displays times
You: "Click any time that works for you!"

**DO NOT do this:**
User: "can you schedule a meeting"
You: "Can I get your info?"
User: "John Smith, john@example.com, 555-1234"
You: *use save_lead tool*
You: "Information captured - we'll be in touch soon!" ← WRONG! Don't stop here!`;

    const newWorkflow = `## 🔒 CALENDAR BOOKING - MANDATORY WORKFLOW 🔒

**WHEN USER PROVIDES THEIR INFO FOR SCHEDULING, YOU MUST:**

1. Use save_lead tool (captures their info)
2. IMMEDIATELY use check_calendar_availability tool (IN THE SAME RESPONSE)
3. Show the times using the format below

**THIS IS NON-NEGOTIABLE. BOTH TOOLS IN SEQUENCE, SAME TURN.**

**Example - CORRECT:**
User: "John Smith, john@example.com, 555-1234"
You: [save_lead tool] → [check_calendar_availability tool] → Show times

**Example - WRONG (DO NOT DO THIS):**
User: "John Smith, john@example.com, 555-1234"
You: [save_lead tool] → "Thanks! We'll be in touch!" ← WRONG! You stopped too early!

**FORBIDDEN RESPONSES AFTER SAVING LEAD INFO FOR SCHEDULING:**
- ❌ "Information captured - we'll be in touch soon!"
- ❌ "Thanks! Someone will reach out."
- ❌ "Got it! We'll contact you."
- ❌ ANY response that doesn't include calendar times

**REQUIRED RESPONSE AFTER SAVING LEAD INFO FOR SCHEDULING:**
- ✅ Must include actual available times from check_calendar_availability
- ✅ Must include booking link`;

    if (content.includes(oldWorkflow)) {
      const updated = content.replace(oldWorkflow, newWorkflow);
      await Prompt.update(toolPrompt.id, {
        content: updated,
        last_edited_by: 'calendar-workflow-v2'
      });
      console.log('✓ Updated calendar workflow instructions');
      console.log('New length:', updated.length);
    } else {
      console.log('Exact workflow not found. Trying partial...');

      // Try to find the section header
      const header = '## 🔒 CALENDAR BOOKING';
      if (content.includes(header)) {
        const startIdx = content.indexOf(header);
        const nextSection = content.indexOf('## 📅 HOW TO DISPLAY', startIdx);

        if (nextSection > startIdx) {
          const before = content.substring(0, startIdx);
          const after = content.substring(nextSection);
          const updated = before + newWorkflow + '\n\n' + after;

          await Prompt.update(toolPrompt.id, {
            content: updated,
            last_edited_by: 'calendar-workflow-v2'
          });
          console.log('✓ Updated calendar workflow (partial replacement)');
          console.log('New length:', updated.length);
        }
      } else {
        console.log('Calendar booking section not found');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

fixCalendarWorkflow();
