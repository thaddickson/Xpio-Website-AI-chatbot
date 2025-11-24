# Xpio Health AI Chatbot - System Documentation

## Overview

This is an AI-powered lead generation chatbot for Xpio Health, built with Claude Opus 4 (Anthropic). The chatbot engages visitors on the website, qualifies leads, captures contact information, and saves everything to a Supabase database.

## Architecture

### Stack
- **Backend**: Node.js + Express
- **AI Model**: Claude Opus 4.1 (claude-opus-4-20250514)
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Railway (auto-deploys from GitHub)
- **Frontend Widget**: Vanilla JavaScript (embeddable)

### Key Components

```
backend/
├── server.js                          # Main Express server
├── src/
│   ├── controllers/
│   │   ├── chatController.js          # Handles chat streaming, loads prompts from DB
│   │   └── promptController.js        # Admin API for prompt management
│   ├── models/
│   │   ├── Lead.js                    # Lead database operations
│   │   ├── Conversation.js            # Conversation logging
│   │   └── Prompt.js                  # Prompt management (NEW!)
│   └── services/
│       ├── claudeService.js           # Claude API integration (fallback prompt)
│       ├── leadService.js             # Lead capture logic
│       └── emailService.js            # SendGrid email notifications
├── public/
│   ├── chat-widget.js                 # Embeddable chatbot widget
│   └── admin.html                     # Prompt management dashboard
└── database/
    ├── conversations-schema.sql       # SQL for conversations table
    └── prompts-schema-fixed.sql       # SQL for prompt management tables
```

## How It Works

### 1. Chat Flow

1. **User visits website** → Chat widget loads from `chat-widget.js`
2. **User sends message** → POST to `/api/chat`
3. **Server creates conversation** → Saves to Supabase `conversations` table
4. **Server loads system prompt** → Fetches active prompt sections from `prompt_sections` table (cached 5 min)
5. **Server calls Claude** → Streams response back to user
6. **Claude may use tool** → `save_lead` tool captures contact info
7. **Lead saved** → Stored in `leads` table, email sent to sales team
8. **All messages logged** → Full conversation saved to `conversations` table

### 2. Prompt Management System

**The chatbot's knowledge is now database-driven, not hardcoded!**

#### Database Tables

**`prompt_sections`** - Stores editable prompt sections
```sql
- id (UUID)
- name (text) - Display name like "Core Identity"
- slug (text) - URL-friendly ID like "core-identity"
- content (text) - The actual prompt text (up to 1MB)
- is_active (boolean) - Whether to include in system prompt
- display_order (integer) - Order to combine sections (0 = first)
- version (integer) - Auto-increments on each edit
- created_at, updated_at
```

**`prompt_versions`** - Version history
```sql
- id (UUID)
- section_id (UUID) - Links to prompt_sections
- content (text) - Snapshot of old content
- version (integer)
- edited_by (text)
- created_at
```

#### How Prompts Load

1. **Request comes in** → `chatController.js` calls `getSystemPrompt()`
2. **Check cache** → If cached and < 5 minutes old, use cached version
3. **Load from DB** → `Prompt.buildSystemPrompt()` fetches all active sections
4. **Combine sections** → Orders by `display_order` and joins with `\n\n---\n\n`
5. **Cache result** → Stores for 5 minutes to reduce DB queries
6. **Send to Claude** → Uses combined prompt as system message

#### Cache Timing
- **Cache duration**: 5 minutes
- **Why**: Reduces database queries while allowing prompt updates
- **Result**: Prompt changes take effect within 5 minutes (no redeployment needed!)

### 3. Lead Capture

Claude has access to a `save_lead` tool that captures:

**Required Fields:**
- Full name
- Email address
- Primary interest/need
- Conversation summary
- Qualification score (hot/warm/cold)

**Optional Fields:**
- Phone number
- Organization name
- Role/title
- Organization size
- Current systems
- Timeline
- Budget range
- Pain points
- Next steps

**When captured:**
1. Lead saved to Supabase `leads` table
2. Email notification sent via SendGrid to `thad@xpiohealth.com`
3. Conversation marked as `lead_captured = true`
4. Lead ID linked to conversation record

### 4. Conversation Logging

**Every conversation is logged** (not just leads):

- New conversation → Creates record in `conversations` table
- Each message → Appended to `messages` JSONB field
- Metadata tracked → User agent, IP, referrer, message count
- Status tracking → active, ended, or abandoned
- Analytics → View stats at `/api/stats`

## Admin Dashboard

**URL**: https://xpio-website-ai-chatbot-production.up.railway.app/admin.html

### Features

1. **View All Prompts** - See all sections, active/inactive status
2. **Edit Prompts** - Click "Edit" to modify content
3. **Create New Sections** - Click "Add New Section"
4. **Activate/Deactivate** - Toggle sections on/off without deleting
5. **Reorder Sections** - Change `display_order` to control prompt structure
6. **Preview System Prompt** - See exactly what Claude receives
7. **Version History** - Track changes over time (via API)
8. **Test Chat Widget** - Chat bubble on admin page for instant testing

### How to Update Prompts

1. Go to admin dashboard
2. Click "Edit" on any section
3. Modify the content
4. Click "Save Section"
5. ✅ **Done!** - Changes take effect within 5 minutes (no deployment needed)

**Note**: Body size limit is 1MB, so prompts can be very long.

### Current Prompt Structure

As of now, you have:
- **People** (order 0) - Team/credential information
- **Main System Prompt** (order 1) - Core identity, services, conversation strategy

These combine to form the full system prompt sent to Claude.

## API Endpoints

### Chat Endpoints
- `GET /api/chat/greeting` - Get initial greeting message
- `POST /api/chat` - Send message, receive streaming response
- `POST /api/chat/end` - End conversation and cleanup
- `GET /api/stats` - View conversation statistics

### Admin Endpoints (Prompt Management)
- `GET /api/admin/prompts` - List all prompt sections
- `GET /api/admin/prompts/:slug` - Get single section by slug
- `GET /api/admin/prompts/:id/history` - Get version history
- `POST /api/admin/prompts` - Create new section
- `PUT /api/admin/prompts/:id` - Update section
- `DELETE /api/admin/prompts/:id` - Delete section
- `GET /api/admin/prompts/preview` - Preview compiled system prompt
- `POST /api/admin/prompts/import` - Import hardcoded prompt (one-time use)

### Health & Status
- `GET /health` - Server health check
- `GET /` - Serves chat widget for testing

## Database Schema

### Tables

**leads** - Captured lead information
- Core contact details (name, email, phone, organization)
- Qualification data (score, timeline, budget, pain points)
- Conversation context (summary, next steps)
- Full conversation history (JSONB)
- Email tracking (followed_up, followed_up_at)

**conversations** - All chat sessions (not just leads)
- Conversation metadata (ID, timestamps, status)
- Full message history (JSONB array)
- Session info (user agent, IP, referrer)
- Lead linkage (lead_id if captured)
- Message count, lead capture flag

**prompt_sections** - Editable prompt sections
- Section details (name, slug, description)
- Content (up to 1MB)
- Status (active/inactive, display order)
- Versioning (version number, last editor)

**prompt_versions** - Version history for rollback
- Snapshots of old content
- Version numbers
- Editor tracking
- Timestamps

## Environment Variables

### Required (in Railway)
```bash
# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-api03-...

# Supabase Database
SUPABASE_URL=https://xqyavoactertympbpjcd.supabase.co
SUPABASE_KEY=eyJhbGci...

# Email Notifications
SENDGRID_API_KEY=SG.Uooq2vw1...
EMAIL_FROM=thad@xpiohealth.com
EMAIL_FROM_NAME=Xpio Health Delphi AI
NOTIFICATION_EMAIL=thad@xpiohealth.com

# Server Config
PORT=3000 (Railway sets this automatically)
NODE_ENV=development (allows all CORS origins)
ALLOWED_ORIGINS=https://xpiohealth.com,https://www.xpiohealth.com
```

### Optional
```bash
SESSION_SECRET=your_random_secret
HUBSPOT_API_KEY=... (for CRM integration)
SALESFORCE_API_KEY=... (for CRM integration)
```

## WordPress Integration

The chatbot is embedded on xpiohealth.com via the widget code in `footer.php`:

```html
<!-- Xpio Health AI Chatbot -->
<script src="https://xpio-website-ai-chatbot-production.up.railway.app/chat-widget.js"></script>
<script>
  XpioChatbot.init({
    apiUrl: 'https://xpio-website-ai-chatbot-production.up.railway.app',
    primaryColor: '#FC922B',
    position: 'bottom-left'
  });
</script>
```

**Widget Configuration:**
- `apiUrl` - Backend API endpoint
- `primaryColor` - Xpio Health orange (#FC922B)
- `position` - 'bottom-left' or 'bottom-right'

## Deployment

### Railway Auto-Deployment

**Repository**: https://github.com/thaddickson/Xpio-Website-AI-chatbot

**Trigger**: Automatic deployment on `git push` to `master` branch

**Process**:
1. Code pushed to GitHub
2. Railway detects changes
3. Runs `npm install` in `backend` directory
4. Starts server with `npm start` (runs `node server.js`)
5. Deployment takes ~2-3 minutes

**Important**: Prompt changes do NOT require redeployment! Only code changes trigger Railway rebuilds.

### Railway Environment
- **URL**: https://xpio-website-ai-chatbot-production.up.railway.app
- **Build Command**: `npm install` (in backend directory)
- **Start Command**: `npm start --prefix backend`
- **Listen Address**: `0.0.0.0` (required for Railway)
- **Port**: Automatically set by Railway

## Key Files

### Backend Configuration
- `backend/server.js` - Main server, loads prompt controller
- `backend/package.json` - Dependencies (Express, Anthropic SDK, Supabase, etc.)
- `backend/.env` - Local environment variables (NOT in git)

### Prompt System
- `backend/src/controllers/promptController.js` - Admin API endpoints
- `backend/src/models/Prompt.js` - Database operations for prompts
- `backend/src/controllers/chatController.js` - Loads prompts, calls Claude
- `backend/src/services/claudeService.js` - Fallback hardcoded prompt (only used if DB fails)

### Chat Logic
- `backend/src/controllers/chatController.js` - Streaming chat handler
- `backend/src/services/leadService.js` - Lead capture and email
- `backend/src/models/Lead.js` - Lead database operations
- `backend/src/models/Conversation.js` - Conversation logging

### Frontend
- `backend/public/chat-widget.js` - Embeddable chat widget
- `backend/public/admin.html` - Prompt management dashboard

## Common Tasks

### Update Chatbot Knowledge
1. Go to admin dashboard: https://xpio-website-ai-chatbot-production.up.railway.app/admin.html
2. Edit existing section OR create new section
3. Save changes
4. Wait 5 minutes for cache refresh OR test immediately on admin page

### Add New Prompt Section
1. Click "Add New Section" in admin dashboard
2. Fill in:
   - Name: Display name (e.g., "Pricing Information")
   - Slug: URL-friendly ID (e.g., "pricing-info")
   - Description: Optional notes
   - Content: The prompt text
   - Display Order: Where it appears (0 = first)
   - Active: Check to include in prompt
3. Save
4. Preview to see combined prompt

### View Leads
1. Go to Supabase: https://supabase.com/dashboard/project/xqyavoactertympbpjcd/editor
2. Click `leads` table
3. View all captured leads with full conversation history

### View All Conversations
1. Go to Supabase → `conversations` table
2. See all chats (even those without leads)
3. Check `messages` column for full history

### Check Analytics
Visit: https://xpio-website-ai-chatbot-production.up.railway.app/api/stats

Shows:
- Total conversations
- Active conversations
- Leads generated
- Conversion rate
- Average messages per conversation

### Deploy Code Changes
```bash
git add .
git commit -m "Description of changes"
git push
```
Railway auto-deploys in ~2-3 minutes.

### Test Locally
```bash
cd backend
npm install
npm run dev  # Uses nodemon for auto-restart
```
Visit: http://localhost:3001

## Troubleshooting

### Chatbot Not Responding
1. Check Railway logs for errors
2. Verify `ANTHROPIC_API_KEY` is set correctly (no extra whitespace!)
3. Check `/health` endpoint
4. Look for CORS errors in browser console

### Prompt Changes Not Showing
- **Wait 5 minutes** - Prompts are cached
- Check section is marked as `is_active = true`
- Preview system prompt to verify content
- Check Railway logs for database errors

### Lead Not Captured
- Check Supabase `leads` table
- Verify SendGrid API key is valid
- Check Railway logs for save errors
- Ensure conversation had enough context for Claude to qualify

### Admin Dashboard Not Loading
- Hard refresh browser (Ctrl+Shift+R)
- Check Railway deployment status
- Verify `/admin.html` route is working
- Check browser console for JavaScript errors

### Body Size Too Large Error
- Current limit: 1MB
- If you need more, increase in `server.js`: `app.use(express.json({ limit: '1mb' }))`

## Security Notes

### Current Status
- ⚠️ Admin dashboard has NO authentication (add auth in production!)
- ✅ CORS configured for xpiohealth.com and localhost
- ✅ Rate limiting enabled on chat endpoint
- ✅ Input validation on messages (max 5000 chars)
- ✅ Body size limits (1MB for prompts)
- ⚠️ RLS (Row Level Security) not enabled on Supabase (fine for backend-only access)

### Recommendations for Production
1. Add authentication to `/api/admin/*` endpoints
2. Use environment-based CORS (not `development` mode)
3. Enable RLS on Supabase tables
4. Add HTTPS-only cookies for sessions
5. Implement rate limiting on admin endpoints

## Key Features

### ✅ Implemented
- Real-time streaming chat responses
- Lead capture with Claude tool use
- Full conversation logging
- Database-driven prompt management
- Admin dashboard for prompt editing
- Version history for prompts
- Email notifications via SendGrid
- WordPress widget integration
- Railway auto-deployment
- Chat widget on admin page for testing
- CORS configuration for production
- Rate limiting
- Health monitoring

### 🔄 Potential Enhancements
- Clear cache button (instant prompt updates)
- Admin authentication
- Analytics dashboard
- Export leads to CSV
- CRM integration (HubSpot/Salesforce)
- Multi-language support
- Conversation search
- A/B testing different prompts
- Scheduled prompt changes
- Prompt templates library

## Contact & Support

**Developer**: Built with Claude Code
**Email Notifications**: thad@xpiohealth.com
**Website**: https://xpiohealth.com
**Admin Dashboard**: https://xpio-website-ai-chatbot-production.up.railway.app/admin.html

## Quick Reference

| Task | Command/URL |
|------|-------------|
| Edit Prompts | https://xpio-website-ai-chatbot-production.up.railway.app/admin.html |
| View Leads | https://supabase.com/dashboard/project/xqyavoactertympbpjcd/editor |
| Check Stats | https://xpio-website-ai-chatbot-production.up.railway.app/api/stats |
| Test Chat | Click bubble on admin page or visit xpiohealth.com |
| Deploy Code | `git push` |
| Run Locally | `cd backend && npm run dev` |
| Check Health | https://xpio-website-ai-chatbot-production.up.railway.app/health |

---

**Last Updated**: November 2025
**Version**: 1.0
**Status**: Production ✅
