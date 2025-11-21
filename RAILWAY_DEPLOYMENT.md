# Railway Deployment Guide

## Step 1: Create Railway Account

1. Go to https://railway.app
2. Click "Login" → "Login with GitHub"
3. Authorize Railway to access your GitHub account

## Step 2: Deploy from GitHub

1. On Railway dashboard, click "New Project"
2. Select "Deploy from GitHub repo"
3. Find and select: `thaddickson/Xpio-Website-AI-chatbot`
4. Railway will automatically detect it's a Node.js app

## Step 3: Configure Environment Variables

In Railway project settings, add these environment variables:

**Copy these values from your `backend/.env` file:**

```
ANTHROPIC_API_KEY=<your-anthropic-api-key>
SUPABASE_URL=<your-supabase-url>
SUPABASE_KEY=<your-supabase-anon-key>
PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=https://xpiohealth.com,https://www.xpiohealth.com
SENDGRID_API_KEY=<your-sendgrid-api-key>
EMAIL_FROM=thad@xpiohealth.com
EMAIL_FROM_NAME=Xpio Health Delphi AI
NOTIFICATION_EMAIL=thad@xpiohealth.com
SESSION_SECRET=xpio-health-secret-key-2024
```

**IMPORTANT:** Get the actual values from `backend/.env` file on your local machine.

## Step 4: Deploy

1. Railway will automatically build and deploy
2. Wait for deployment to complete (2-3 minutes)
3. Copy your deployment URL (looks like: `https://your-app.up.railway.app`)

## Step 5: Test Your API

Test the health endpoint:
```bash
curl https://your-app.up.railway.app/health
```

Should return: `{"status":"ok","service":"Xpio Health Lead Gen Chatbot"}`

## Step 6: Add Custom Domain (Optional)

In Railway project settings:
1. Go to "Settings" → "Domains"
2. Add custom domain: `api.xpiohealth.com`
3. Add the CNAME record to your DNS:
   - Type: CNAME
   - Name: api
   - Value: [Railway provides this]

## Next Steps

Once deployed, you'll get a URL like:
- `https://xpio-website-ai-chatbot.up.railway.app`

Use this URL to update your WordPress widget!

## Cost

- Railway Free Tier: $5 credit per month (enough for this chatbot)
- If you exceed free tier: ~$5-10/month

## Troubleshooting

### Build fails
- Check that `railway.json` is in the root directory
- Verify all files are committed to GitHub

### Deployment succeeds but app crashes
- Check logs in Railway dashboard
- Verify environment variables are set correctly

### CORS errors
- Make sure `ALLOWED_ORIGINS` includes your WordPress domain
- Use the exact domain (with https://)
