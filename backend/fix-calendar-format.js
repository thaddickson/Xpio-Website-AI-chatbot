import dotenv from 'dotenv';
import Prompt from './src/models/Prompt.js';

dotenv.config();

async function fixCalendarFormat() {
  try {
    console.log('Fetching tool-instructions prompt...');
    const toolPrompt = await Prompt.getBySlug('tool-instructions');

    if (!toolPrompt) {
      console.error('Tool instructions prompt not found!');
      return;
    }

    const content = toolPrompt.content;

    // Replace the calendar display section with stronger instructions
    const oldSection = `## 📅 HOW TO DISPLAY CALENDAR AVAILABILITY

When you get calendar times from check_calendar_availability tool, format them in a CLEAN, SCANNABLE TABLE:

**REQUIRED FORMAT:**
\`\`\`
Here are Thad's available times:

┌─────────────┬────────────────────────┐
│ Day         │ Available Times        │
├─────────────┼────────────────────────┤
│ Mon, Nov 25 │ 2:00 PM, 3:30 PM       │
│ Tue, Nov 26 │ 10:00 AM, 1:00 PM      │
│ Wed, Nov 27 │ 9:00 AM, 2:30 PM       │
└─────────────┴────────────────────────┘

Click any time to book: [Schedule Meeting](https://calendly.com/thad-xpiohealth/30min)
\`\`\`

**FORMATTING RULES:**
- ✅ Use ASCII table with box-drawing characters (┌ ─ ┐ │ ├ ┼ ┤ └ ┴ ┘)
- ✅ Group times by day on same row, comma-separated
- ✅ Short day format: "Mon, Nov 25"
- ✅ One booking link at bottom
- ❌ NO bullet points
- ❌ NO individual links per time
- ❌ NO paragraphs explaining things`;

    const newSection = `## 📅 HOW TO DISPLAY CALENDAR AVAILABILITY - STRICT FORMAT

When check_calendar_availability returns slots, you MUST:

1. **USE THE "formatted" FIELD** - Each slot has a "formatted" field like "Tuesday, Nov 25, 10:00 AM PST" - USE THIS, not startTime!
2. **Use the single bookingLink** - NOT individual bookingUrls per slot
3. **Format as a simple list** - Clean and scannable

**REQUIRED OUTPUT FORMAT:**
\`\`\`
Here are Thad's available times:

• Tuesday, Nov 25: 10:00 AM PST
• Wednesday, Nov 26: 10:30 AM, 11:00 AM, 11:30 AM, 1:00 PM PST

Book any time here: https://calendly.com/thad-xpiohealth/30min
\`\`\`

**CRITICAL RULES:**
- ✅ Use the "formatted" field from each slot (already has correct timezone)
- ✅ Group multiple times on same day together
- ✅ Put ONE booking link at the end (use bookingLink, not individual bookingUrls)
- ✅ Keep it SHORT - just the times and link
- ❌ DO NOT use UTC times or startTime field
- ❌ DO NOT create individual links for each time slot
- ❌ DO NOT add extra explanation text
- ❌ DO NOT number the times (1, 2, 3...)`;

    if (content.includes(oldSection)) {
      const updated = content.replace(oldSection, newSection);
      await Prompt.update(toolPrompt.id, {
        content: updated,
        last_edited_by: 'calendar-format-fix'
      });
      console.log('✓ Updated calendar formatting instructions');
      console.log('New length:', updated.length);
    } else {
      console.log('Could not find exact section. Trying partial...');

      // Try partial replacement
      const partialOld = `## 📅 HOW TO DISPLAY CALENDAR AVAILABILITY`;
      if (content.includes(partialOld)) {
        // Find the section boundaries
        const startIdx = content.indexOf(partialOld);
        const endMarker = `## CRITICAL: When to Connect`;
        const endIdx = content.indexOf(endMarker);

        if (endIdx > startIdx) {
          const beforeSection = content.substring(0, startIdx);
          const afterSection = content.substring(endIdx);
          const updated = beforeSection + newSection + '\n\n' + afterSection;

          await Prompt.update(toolPrompt.id, {
            content: updated,
            last_edited_by: 'calendar-format-fix'
          });
          console.log('✓ Updated calendar formatting (partial replacement)');
          console.log('New length:', updated.length);
        }
      } else {
        console.log('Section not found at all');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

fixCalendarFormat();
