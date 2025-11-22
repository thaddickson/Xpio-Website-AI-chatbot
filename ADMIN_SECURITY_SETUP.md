# Admin Panel Security Setup

## Overview

The admin panel at `/admin.html` is now protected with password authentication to prevent unauthorized access.

## Setup Instructions

### 1. Set Environment Variable

Add the `ADMIN_PASSWORD` environment variable to your deployment:

**For Railway (Production):**
1. Go to your Railway project dashboard
2. Navigate to Variables tab
3. Add new variable:
   - Name: `ADMIN_PASSWORD`
   - Value: Choose a strong password (e.g., randomly generated 32+ character string)
4. Redeploy the service

**For Local Development:**
Add to your `backend/.env` file:
```
ADMIN_PASSWORD=your_secure_password_here
```

### 2. Accessing the Admin Panel

1. Navigate to `https://xpio-website-ai-chatbot-production.up.railway.app/admin.html`
2. You'll be prompted for the admin password
3. Enter the password you set in step 1
4. Password is stored in sessionStorage for the duration of your browser session

### 3. Security Features

- **Password Protection**: All admin API endpoints require Bearer token authentication
- **Session Storage**: Password is saved in browser session (cleared when browser closes)
- **Auto-Logout**: Invalid password clears session and prompts re-login
- **Fallback Mode**: If `ADMIN_PASSWORD` is not set, server logs a warning but allows access (for backward compatibility during setup)

## Important Notes

- ⚠️ **Set the password immediately** - Until you set `ADMIN_PASSWORD` in Railway, the admin panel is still unprotected!
- 🔒 Use a strong, randomly generated password
- 📝 Store the password securely (password manager recommended)
- 🚫 Never commit the actual password to git (only in `.env`, which is gitignored)

## What's Protected

All these endpoints now require authentication:
- `GET /api/admin/prompts` - List all prompts
- `POST /api/admin/prompts` - Create new prompt
- `PUT /api/admin/prompts/:id` - Update prompt
- `DELETE /api/admin/prompts/:id` - Delete prompt
- `GET /api/admin/prompts/preview` - Preview combined prompt
- `GET /api/admin/prompts/:slug` - Get prompt by slug
- `GET /api/admin/prompts/:id/history` - Get version history
- `POST /api/admin/prompts/import` - Import hardcoded prompt

## Troubleshooting

**"Invalid password" error:**
- Check that `ADMIN_PASSWORD` is set correctly in Railway
- Verify no extra spaces in the password
- Try clearing sessionStorage: `sessionStorage.clear()` in browser console

**Can't access admin panel:**
- Check Railway logs to see if password is set
- Look for warning: `⚠️  WARNING: ADMIN_PASSWORD not set!`
- If warning appears, add the environment variable in Railway

**Password forgotten:**
- Update `ADMIN_PASSWORD` in Railway variables
- Redeploy the service
- Clear your browser's sessionStorage and reload admin panel
