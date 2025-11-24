# A/B Testing System for Prompt Variations

## Overview

The A/B testing system allows you to test multiple versions of any prompt section and measure their performance. You can run experiments to find which greeting converts better, which tool instructions lead to more calendar bookings, etc.

## Setup (One-Time)

### 1. Run Database Migration

First, you need to create the database tables. Go to your **Supabase Dashboard** → **SQL Editor** and run this SQL:

```sql
-- Copy the contents of backend/migrations/002_add_ab_testing.sql
-- Paste into Supabase SQL Editor and click "Run"
```

This creates three tables:
- `prompt_variations` - Stores test versions
- `conversation_test_assignments` - Tracks which variations were used
- `variation_performance_metrics` - Performance data

### 2. Verify Setup

After running the migration, check that tables exist:
```sql
SELECT * FROM prompt_variations LIMIT 1;
```

If you see columns, you're good to go!

## How to Use A/B Testing

### Step 1: Create a Variation

Let's say you want to test a shorter greeting. First, find the prompt section ID:

**GET** `https://your-api.railway.app/api/admin/prompts`
```json
{
  "prompts": [
    {
      "id": "abc-123-def",
      "name": "Initial Greeting",
      "slug": "initial-greeting",
      ...
    }
  ]
}
```

Now create a variation:

**POST** `https://your-api.railway.app/api/admin/prompts/abc-123-def/variations`
```json
{
  "variation_name": "Short & Direct Greeting",
  "content": "Hi! I'm here to help with your behavioral health tech needs. What's your biggest challenge?",
  "traffic_percentage": 0,
  "notes": "Testing if a shorter greeting improves engagement"
}
```

### Step 2: Activate the Test

Update the variation to send 50% of traffic to it:

**PUT** `https://your-api.railway.app/api/admin/variations/{variation-id}`
```json
{
  "is_active": true,
  "traffic_percentage": 50
}
```

Now:
- 50% of conversations will use your new greeting (Test Group)
- 50% will use the original greeting (Control Group)

### Step 3: Let It Run

Wait for data to collect. Aim for at least:
- 100 conversations per variation
- 1-2 weeks of data
- Statistical significance

### Step 4: Check Performance

**GET** `https://your-api.railway.app/api/admin/prompts/abc-123-def/variations/performance`
```json
{
  "variations": [
    {
      "variation_name": "Short & Direct Greeting",
      "total_conversations": 150,
      "total_leads": 45,
      "conversion_rate": 30.0,
      "handoff_rate": 12.0,
      "calendar_booking_rate": 22.0
    }
  ]
}
```

### Step 5: Graduate the Winner

If the variation performs better, promote it to be the new base prompt:

**POST** `https://your-api.railway.app/api/admin/variations/{variation-id}/promote`
```json
{
  "prompt_section_id": "abc-123-def"
}
```

This will:
1. Replace the base prompt with the winning variation
2. Deactivate all tests for that section
3. Everyone now gets the winning version

## Advanced Usage

### Running Multiple Tests

You can test multiple variations simultaneously:

```json
// Variation A: 30% traffic
{
  "variation_name": "Very Short",
  "traffic_percentage": 30
}

// Variation B: 30% traffic
{
  "variation_name": "Conversational",
  "traffic_percentage": 30
}

// Control: Gets remaining 40%
```

### Metrics Tracked

For each variation, the system tracks:

| Metric | Description |
|--------|-------------|
| `conversations_count` | Total conversations using this variation |
| `leads_captured` | Number of leads captured |
| `lead_conversion_rate` | Percentage of conversations that became leads |
| `handoffs_requested` | How often human handoff was requested |
| `handoff_rate` | Percentage requesting handoff |
| `calendar_checks` | How often calendar was checked |
| `calendar_booking_rate` | Booking success rate |
| `abandoned_conversations` | Conversations that ended early |
| `abandonment_rate` | Percentage abandoned |

### What to Test

**Good Candidates for A/B Testing:**
- ✅ Initial greeting messages
- ✅ Tool usage instructions
- ✅ Response style guidelines
- ✅ Qualification questions
- ✅ Calendar booking prompts

**Bad Candidates:**
- ❌ Core company facts (these shouldn't vary)
- ❌ Contact information
- ❌ Compliance/legal text

## Example Test Scenarios

### Scenario 1: Testing Greeting Length

**Hypothesis:** Shorter greetings lead to more engagement

**Control:**
```
Hi! Welcome to Xpio Health. I'm here to learn about your behavioral health technology needs and show you how we can help. What brings you here today?
```

**Variation A (50% traffic):**
```
Hi! I'm here to help with your behavioral health tech needs. What's your biggest challenge?
```

**Expected Outcome:** Higher engagement, more messages per conversation

### Scenario 2: Testing Tool Instructions Clarity

**Hypothesis:** More explicit calendar instructions increase bookings

**Control:**
```
Only show calendar times to qualified leads.
```

**Variation A (50% traffic):**
```
🔒 CALENDAR BOOKING - STRICT WORKFLOW:
1. Get name, email, phone
2. Use save_lead tool
3. IMMEDIATELY use check_calendar_availability
4. Show times in table format
```

**Expected Outcome:** Higher calendar booking rate

### Scenario 3: Testing Response Length

**Hypothesis:** Even shorter responses reduce abandonment

**Control:**
```
MAXIMUM 1-2 SENTENCES per response
```

**Variation A (50% traffic):**
```
MAXIMUM 1 SENTENCE per response (exception: calendar tables)
```

**Expected Outcome:** Lower abandonment rate, faster conversations

## API Reference

### Create Variation
```
POST /api/admin/prompts/:promptId/variations
Authorization: Bearer {admin_password}

Body:
{
  "variation_name": string,
  "content": string,
  "traffic_percentage": number (0-100),
  "notes": string (optional)
}
```

### Get All Variations
```
GET /api/admin/prompts/:promptId/variations
Authorization: Bearer {admin_password}
```

### Update Variation
```
PUT /api/admin/variations/:id
Authorization: Bearer {admin_password}

Body:
{
  "is_active": boolean,
  "traffic_percentage": number,
  "content": string,
  ...
}
```

### Get Performance
```
GET /api/admin/prompts/:promptId/variations/performance?days=30
Authorization: Bearer {admin_password}
```

### Promote to Base
```
POST /api/admin/variations/:id/promote
Authorization: Bearer {admin_password}

Body:
{
  "prompt_section_id": string
}
```

### Delete Variation
```
DELETE /api/admin/variations/:id
Authorization: Bearer {admin_password}
```

## Best Practices

1. **Test One Thing at a Time**
   - Change only one variable per test
   - Makes it clear what caused the difference

2. **Wait for Statistical Significance**
   - Minimum 100 conversations per variation
   - More is better for confidence

3. **Document Your Hypotheses**
   - Use the `notes` field to explain what you're testing
   - Makes it easier to review results later

4. **Monitor Daily**
   - Check for any major issues
   - Stop bad tests early if they're clearly worse

5. **Graduate Winners**
   - Don't leave tests running forever
   - Promote winners and move on to next test

## Troubleshooting

**Q: My variation isn't being used**
- Check `is_active` is true
- Check `traffic_percentage` > 0
- Verify sum of all traffic percentages <= 100

**Q: No metrics showing up**
- Metrics update in real-time as conversations happen
- Wait for at least a few conversations
- Check `conversation_test_assignments` table has records

**Q: How do I stop a test?**
```json
PUT /api/admin/variations/{id}
{
  "is_active": false,
  "traffic_percentage": 0
}
```

**Q: Can I test multiple sections at once?**
Yes! Each prompt section can have its own independent tests running.

## Next Steps

1. Run the database migration in Supabase
2. Create your first test variation via API
3. Let it run for 1-2 weeks
4. Review performance data
5. Graduate the winner
6. Start next test!

---

**Need help?** Check the API logs for debugging info. All variation selections are logged with 🧪 emoji.
