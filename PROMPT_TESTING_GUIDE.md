# Prompt Testing & Improvement Guide

## Overview

This system helps you **iteratively test and improve chatbot prompts** using AI assistance. Perfect for low-traffic environments where you need to manually evaluate quality rather than wait for statistical significance.

## The Workflow

### 1. Test a Prompt Variation

Create different versions of your prompts to find what works best. Each "variation" is a different way of instructing the chatbot.

**Example variations for a greeting:**
- **Control:** "Hi! Welcome to Xpio Health. I'm here to learn about your behavioral health technology needs..."
- **Short Version:** "Hi! What's your biggest challenge with behavioral health tech?"
- **Question-First:** "What brings you here today? I can help with EHR systems, analytics, and compliance."

### 2. Test It Live

Click the chat widget at the bottom right of the admin panel to test your variation:
- Have a conversation with the bot
- See how it responds
- Notice what's working and what's not

### 3. Found a Problem?

Common issues:
- ❌ Responses are too long
- ❌ Not using the calendar tool when it should
- ❌ Too formal/too casual
- ❌ Not following format instructions
- ❌ Missing important information

### 4. Use AI to Fix It

Click **"🤖 AI Improve"** and describe the problem in plain English.

## How to Use the AI Prompt Editor

### Step 1: Open the Editor

**From the A/B Testing tab:**
1. Find the variation you want to improve
2. Click **"🤖 AI Improve"** on the variation card

**OR from edit modal:**
1. Click **"✏️ Edit"** on any variation
2. Click **"🤖 AI Improve"** button in the content field

### Step 2: Describe the Problem

In the feedback box, type exactly what's wrong:

**Good examples:**
- "Responses are too long, keep them under 2 sentences"
- "The bot isn't suggesting calendar booking enough, make it more proactive"
- "Too corporate sounding, make it more friendly and casual"
- "Not following the format rules, strengthen the formatting instructions"
- "Spends too much time listing features, focus on asking questions instead"

**Pro tip:** Be specific! The more detail you give, the better the AI's suggestions.

### Step 3: Get Suggestions

Click **"🚀 Get AI Suggestions"**

The AI will:
1. Analyze your current prompt
2. Apply your feedback
3. Show you the improved version side-by-side
4. Explain what it changed and why

### Step 4: Review the Changes

You'll see three sections:

**Before (Current)** - Your original prompt
**After (Improved)** - AI's suggested improvements
**Changes Made** - Explanation of what changed

Read through the explanation to understand the improvements.

### Step 5: Decide

You have three options:

**✅ Accept & Use This**
- Applies the improvements to your variation
- Closes the AI editor
- You can now save the variation

**🔄 Iterate More**
- Uses the improved version as the starting point
- Lets you describe another problem
- Perfect for fixing multiple issues

**❌ Cancel**
- Discards the suggestions
- Goes back to your original

## Iterating Multiple Times

You can iterate as many times as needed to get it perfect:

### Example Session:

**Iteration 1:**
```
You: "Responses are too long"
AI: ✓ Shortened instructions from paragraphs to bullet points
     ✓ Added "MAXIMUM 1-2 SENTENCES" rule
     ✓ Removed redundant examples
```
→ Click "Iterate More"

**Iteration 2:**
```
You: "Good, but make it even shorter - one sentence only"
AI: ✓ Changed to "MAXIMUM 1 SENTENCE per response"
     ✓ Removed additional guidelines that were wordy
     ✓ Made examples more concise
```
→ Click "Iterate More"

**Iteration 3:**
```
You: "Perfect! Now make the calendar tool usage more prominent"
AI: ✓ Moved calendar instructions to top
     ✓ Added "ALWAYS offer calendar link" rule
     ✓ Created step-by-step calendar workflow
```
→ Click "Accept & Use This"

## Quick Analysis Feature

Not sure what's wrong? Click **"⚡ Quick Analysis"** for general feedback.

The AI will review your prompt and suggest 3-5 potential improvements:
- "Consider adding more specific examples..."
- "The tone could be more conversational..."
- "Calendar booking instructions could be clearer..."

Use this to identify issues, then describe specific fixes in the feedback box.

## Complete Example Workflow

### Scenario: Testing a New Greeting

**Step 1: Create the Variation**
- Go to **🧪 A/B Testing** tab
- Find "Initial Greeting" section
- Click **"➕ New Variation"**
- Name: "Friendly Short Greeting"
- Content: "Hey! I'm here to help with your behavioral health tech needs. What's your biggest challenge?"
- Save

**Step 2: Test It**
- Click chat widget (bottom right)
- Start a conversation
- **Problem:** Bot gave a long 4-sentence response instead of being brief

**Step 3: Improve with AI**
- Click **"🤖 AI Improve"** on the variation
- Feedback: "Bot responses are too long. Instructions should enforce 1-2 sentence maximum."
- Click **"🚀 Get AI Suggestions"**
- Review: AI added strict length rules and examples
- Click **"✅ Accept & Use This"**
- Save variation

**Step 4: Test Again**
- Start another conversation
- **Better!** Responses are now 1-2 sentences
- **New problem:** Not offering calendar link often enough

**Step 5: Iterate More**
- Click **"🤖 AI Improve"** again
- Feedback: "Bot should offer the calendar link much more frequently, especially after capturing interest"
- Get suggestions → Accept
- Save

**Step 6: Final Test**
- Test one more time
- **Perfect!** Short responses AND offers calendar proactively
- Click **"🏆 Promote to Base"** to make this the standard

## Best Practices

### 1. Test One Thing at a Time

Instead of: "Make it shorter, more casual, and use more emojis"

Better approach:
1. First iteration: "Make it shorter"
2. Second iteration: "Make it more casual"
3. Third iteration: "Add occasional emojis for friendliness"

This helps you understand which change had which effect.

### 2. Be Specific in Your Feedback

❌ Vague: "This isn't working"
✅ Specific: "Bot responses are 3-4 sentences when they should be 1-2"

❌ Vague: "Use calendar more"
✅ Specific: "After someone expresses interest, the bot should immediately offer the calendar link"

❌ Vague: "Wrong tone"
✅ Specific: "Too formal - use contractions and casual language like 'Hey' instead of 'Hello'"

### 3. Test After Every Change

Don't iterate 5 times and then test. Test after each iteration:
1. Make change with AI
2. Save
3. Test in chat widget
4. Identify next issue
5. Repeat

### 4. Use Traffic % for Comparison (Optional)

If you want to compare variations:
- Set Variation A to 50%
- Set Variation B to 50%
- Over a few days, manually review conversations in both groups
- Pick the winner based on quality

**But:** With low traffic, manual testing is usually faster and better.

### 5. Keep Notes

Use the "Notes" field to track what you're testing:
- "Testing if shorter responses reduce abandonment"
- "Emphasizing calendar tool usage per Will's feedback"
- "V3 of greeting after AI improvements - seems to work well!"

## Common Improvements

### Making Responses Shorter

**Feedback to AI:**
- "Responses are too long, enforce 1-2 sentence maximum"
- "Bot is verbose, add strict brevity rules"
- "Remove explanatory text, just get to the point"

### Improving Tool Usage

**Feedback to AI:**
- "Bot rarely uses the calendar tool, make it a priority"
- "Strengthen the handoff instructions, bot should trigger it more often"
- "Bot forgets to save leads, emphasize the save_lead workflow"

### Adjusting Tone

**Feedback to AI:**
- "Too formal, make it conversational and friendly"
- "Too casual, make it more professional"
- "Add occasional emojis to make it warmer"

### Following Formats

**Feedback to AI:**
- "Bot ignores the 'one question per message' rule, strengthen it"
- "Calendar formatting isn't working, fix the table instructions"
- "Bot uses bullet points when it shouldn't, remove those examples"

## Promoting a Winner

Once you've found a prompt that works well:

1. Click **"🏆 Promote to Base"** on the variation
2. This replaces the main prompt with your improved version
3. All traffic now uses this prompt
4. All active tests for that section are paused

**When to promote:**
- You've tested it multiple times and it works consistently well
- It solves the problems you identified
- No major issues after several test conversations

## Troubleshooting

### "AI suggestions aren't helpful"

- **Make feedback more specific** - Instead of "fix this", say exactly what's wrong
- **Try iterating** - First improvement might not be perfect, iterate more
- **Check your prompt** - If original is very messy, AI might struggle. Clean it up first.

### "Changes didn't improve things"

- **Revert:** Edit the variation and paste back the old content
- **Try different feedback:** Maybe describe the problem differently
- **Iterate more:** Sometimes takes 2-3 rounds to get it right

### "Want to start over"

- **Create new variation:** Click "➕ New Variation" for fresh start
- **Keep old one** for comparison
- **Delete old one** once you're happy with new version

## Quick Reference

### Keyboard Shortcuts
- **Enter** in feedback box = Get AI Suggestions (when focused)
- **Esc** = Close any modal
- **Tab** = Navigate between fields

### Button Guide
- **🤖 AI Improve** - Open AI prompt editor
- **⚡ Quick Analysis** - Get general feedback
- **🚀 Get AI Suggestions** - Analyze and improve based on feedback
- **✅ Accept & Use This** - Apply improvements
- **🔄 Iterate More** - Keep improving from current version
- **❌ Cancel** - Discard changes
- **✏️ Edit** - Modify variation content/settings
- **▶️ Activate** - Start using this variation
- **⏸️ Pause** - Stop using this variation
- **🏆 Promote to Base** - Make this the new standard
- **🗑️ Delete** - Remove variation permanently

## Need Help?

The AI Prompt Editor is powered by Claude Sonnet 4, the same model that wrote this guide! It understands:
- Chatbot design best practices
- Prompt engineering techniques
- Your specific feedback
- How to make surgical improvements without rewriting everything

Just describe what's wrong in plain English and let it help!

---

**Remember:** This is about iterative improvement, not statistical testing. Test manually, use AI to improve, iterate until perfect! 🎯
