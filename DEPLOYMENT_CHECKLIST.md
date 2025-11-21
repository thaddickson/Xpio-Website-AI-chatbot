# 🚀 Complete Deployment Checklist

Get your Xpio Health AI Chatbot live on xpiohealth.com in ~15 minutes!

## ✅ Pre-Deployment (Already Done!)

- [x] Code in GitHub: `https://github.com/thaddickson/Xpio-Website-AI-chatbot`
- [x] Backend configured with Claude AI, Supabase, and SendGrid
- [x] Local testing successful
- [x] Railway configuration files created

---

## 📝 Step 1: Deploy to Railway (5 minutes)

### A. Create Railway Account
1. Go to https://railway.app
2. Click "Login with GitHub"
3. Authorize Railway

### B. Deploy Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose: `thaddickson/Xpio-Website-AI-chatbot`
4. Railway auto-detects Node.js and starts building

### C. Configure Environment Variables
1. Click on your deployed service
2. Go to "Variables" tab
3. Click "Add Variable" for each of these:

```
ANTHROPIC_API_KEY = [from backend/.env]
SUPABASE_URL = [from backend/.env]
SUPABASE_KEY = [from backend/.env]
PORT = 3001
NODE_ENV = production
ALLOWED_ORIGINS = https://xpiohealth.com,https://www.xpiohealth.com
SENDGRID_API_KEY = [from backend/.env]
EMAIL_FROM = thad@xpiohealth.com
EMAIL_FROM_NAME = Xpio Health Delphi AI
NOTIFICATION_EMAIL = thad@xpiohealth.com
SESSION_SECRET = xpio-health-secret-key-2024
```

4. Railway will auto-redeploy with new variables

### D. Get Your Deployment URL
1. Go to "Settings" tab
2. Copy the deployment URL (e.g., `https://xpio-website-ai-chatbot.up.railway.app`)
3. **Save this URL** - you'll need it for WordPress!

### E. Test Your Deployment
```bash
curl https://YOUR-RAILWAY-URL.up.railway.app/health
```

Should return: `{"status":"ok"}`

---

## 🌐 Step 2: Add to WordPress (5 minutes)

### A. Log into WordPress
1. Go to https://xpiohealth.com/wp-admin
2. Enter credentials

### B. Add Chatbot Code
1. Go to **Appearance → Theme File Editor**
2. Click `footer.php` on the right sidebar
3. Find the `</body>` tag near the bottom
4. **Paste this code RIGHT BEFORE `</body>`:**

```html
<!-- Xpio Health AI Chatbot -->
<script src="https://YOUR-RAILWAY-URL.up.railway.app/chat-widget.js"></script>
<script>
  XpioChatbot.init({
    apiUrl: 'https://YOUR-RAILWAY-URL.up.railway.app',
    primaryColor: '#FC922B',
    position: 'bottom-right'
  });
</script>
```

5. **Replace `YOUR-RAILWAY-URL`** with your actual Railway URL
6. Click "Update File"

### C. Test on Live Site
1. Visit https://xpiohealth.com
2. Look for orange chat bubble in bottom-right corner
3. Click and chat!

---

## ✅ Step 3: Verify Everything Works

### Test the Chatbot
1. Click the chat bubble
2. Type: "I need help with EHR integration"
3. Answer a few questions
4. Provide your email

### Check Email Notification
1. Check inbox for: thad@xpiohealth.com
2. You should receive a lead notification email

### View Leads in Supabase
1. Go to https://xqyavoactertympbpjcd.supabase.co
2. Click "Table Editor"
3. Select "conversations" table
4. See your test conversation!

---

## 🎨 Optional: Customize (5 minutes)

### Change Colors
```javascript
XpioChatbot.init({
  apiUrl: 'https://your-url.up.railway.app',
  primaryColor: '#0066CC',  // Change to any color
  position: 'bottom-left'   // or 'bottom-right'
});
```

### Add Custom Domain (Optional)
1. In Railway, go to Settings → Domains
2. Click "Add Domain"
3. Enter: `api.xpiohealth.com`
4. Add CNAME record to your DNS:
   - Name: `api`
   - Value: `[provided by Railway]`
5. Update WordPress code with `https://api.xpiohealth.com`

---

## 📊 Monitor Performance

### View Stats
Visit: `https://YOUR-RAILWAY-URL.up.railway.app/api/stats`

Shows:
- Total conversations
- Hot/warm/cold leads
- Conversion rates

### Check Logs
In Railway dashboard:
- Click your service
- Go to "Deployments" → Latest deployment → "View Logs"
- See real-time chatbot activity

### Monitor Costs
Railway Free Tier: $5/month credit

Typical usage: $2-5/month

---

## 🆘 Troubleshooting

### Chat bubble doesn't appear
- Check browser console (F12) for errors
- Verify Railway URL is correct
- Check ALLOWED_ORIGINS includes your WordPress domain

### Chat loads but no response
- Test API: `curl https://YOUR-URL/health`
- Check Railway logs for errors
- Verify environment variables are set

### Email not sending
- Check SendGrid API key
- Verify EMAIL_FROM matches verified sender in SendGrid
- Check Railway logs for email errors

### CORS error
- Add your WordPress URL to ALLOWED_ORIGINS in Railway
- Redeploy after changing variables

---

## 📞 Support

**Documentation:**
- Full README: [README.md](README.md)
- Railway Guide: [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md)
- WordPress Guide: [WORDPRESS_INTEGRATION.md](WORDPRESS_INTEGRATION.md)

**Issues:**
- GitHub: https://github.com/thaddickson/Xpio-Website-AI-chatbot/issues

---

## ✨ You're Live!

🎉 Congratulations! Your AI chatbot is now:
- ✅ Deployed to Railway
- ✅ Live on xpiohealth.com
- ✅ Capturing and qualifying leads
- ✅ Sending email notifications

Next: Monitor your leads and optimize the conversation flow!
