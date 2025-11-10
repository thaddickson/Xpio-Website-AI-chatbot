# Quick Start Guide

Get the Xpio Health Lead Generation Chatbot running in 5 minutes!

## Step 1: Get Your API Keys

### Anthropic API Key (Required)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Go to API Keys section
4. Create a new key
5. Copy the key (starts with `sk-ant-`)

### Gmail App Password (Required for Email)

1. Go to your Google Account
2. Enable 2-Factor Authentication
3. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
4. Create a new app password
5. Copy the 16-character password

## Step 2: Setup Backend

```bash
# Navigate to backend folder
cd lead-gen-chatbot/backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your credentials
# On Windows: notepad .env
# On Mac/Linux: nano .env
```

Edit these values in `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
DATABASE_URL=postgresql://localhost:5432/lead_gen_db
EMAIL_USER=your@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
NOTIFICATION_EMAIL=where-to-send-leads@yourdomain.com
ALLOWED_ORIGINS=https://xpiohealth.com
```

## Step 3: Setup Database

### Option A: Use Railway (Easiest - Free Tier)

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" > "Provision PostgreSQL"
4. Copy the DATABASE_URL from the Connect tab
5. Paste into your `.env` file

### Option B: Local PostgreSQL

```bash
# Install PostgreSQL if not installed
# Mac: brew install postgresql
# Ubuntu: sudo apt install postgresql

# Create database
createdb lead_gen_db

# Update .env
DATABASE_URL=postgresql://localhost:5432/lead_gen_db
```

## Step 4: Initialize & Test

```bash
# Run setup script
node setup.js
```

Expected output:
```
✅ Environment variables validated
✅ Database tables created successfully
✅ Email service configured correctly
✅ Anthropic API key is valid
✨ Setup complete!
```

## Step 5: Start Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

You should see:
```
✅ Server is running!
🌐 API URL: http://localhost:3000
📍 Chat endpoint: POST http://localhost:3000/api/chat
💚 Health check: http://localhost:3000/health
```

## Step 6: Test the API

Open another terminal:

```bash
# Test health check
curl http://localhost:3000/health

# Test greeting
curl http://localhost:3000/api/chat/greeting
```

## Step 7: Add Widget to WordPress

### Quick Embed Method

1. Log into WordPress admin
2. Go to Appearance > Theme Editor
3. Select `footer.php`
4. Add before `</body>`:

```html
<script src="http://localhost:3000/chat-widget.js"></script>
<script>
  XpioChatbot.init({
    apiUrl: 'http://localhost:3000'
  });
</script>
```

5. Save and visit your site
6. Chat bubble should appear in bottom-right corner!

## Step 8: Test End-to-End

1. Click the chat bubble on your WordPress site
2. Type: "I need help with behavioral health EHR"
3. Answer a few questions
4. Provide your contact information
5. Check your `NOTIFICATION_EMAIL` inbox for the lead notification!

## Troubleshooting

### "Cannot connect to database"

- Check PostgreSQL is running: `psql -l`
- Verify DATABASE_URL is correct
- Try pinging database: `psql $DATABASE_URL`

### "Email not sending"

- Gmail: Make sure you're using App Password, not regular password
- Check EMAIL_USER and EMAIL_PASSWORD in .env
- Run: `node -e "require('./src/services/emailService.js').testEmailConfiguration()"`

### "CORS error in browser"

- Add your WordPress URL to ALLOWED_ORIGINS in .env
- Restart the server after changing .env
- Format: `ALLOWED_ORIGINS=http://localhost:8080,https://xpiohealth.com`

### "Widget not appearing"

- Check browser console for errors (F12)
- Verify script is loading in Network tab
- Check API is running: `curl http://localhost:3000/health`

## Next Steps

1. **Customize the chatbot**
   - Edit system prompt in `src/services/claudeService.js`
   - Change colors/position in widget config

2. **Deploy to production**
   - See [DEPLOYMENT.md](docs/DEPLOYMENT.md)
   - Railway, Vercel, or AWS

3. **Monitor leads**
   - Check email notifications
   - Query database: `psql $DATABASE_URL -c "SELECT * FROM leads"`
   - Visit: `http://localhost:3000/api/stats`

## Quick Reference

### Useful Commands

```bash
# Start server
npm run dev

# Check logs
# (if using PM2)
pm2 logs

# View database leads
psql $DATABASE_URL
SELECT email, name, qualification_score, created_at FROM leads;

# Backup database
pg_dump $DATABASE_URL > backup.sql

# Test email
node -e "require('./src/services/emailService.js').testEmailConfiguration()"
```

### Important Files

- `server.js` - Main server
- `src/services/claudeService.js` - AI prompts & behavior
- `src/services/emailService.js` - Email templates
- `frontend/chat-widget.js` - WordPress widget
- `.env` - Configuration (NEVER commit this!)

## Need Help?

- 📚 Full docs: [README.md](README.md)
- 🚀 Deployment: [DEPLOYMENT.md](docs/DEPLOYMENT.md)
- 🔌 WordPress: [WORDPRESS_INTEGRATION.md](docs/WORDPRESS_INTEGRATION.md)
- 📧 Support: tech@xpiohealth.com

---

**You're all set!** 🎉 Your AI chatbot is now capturing leads!
