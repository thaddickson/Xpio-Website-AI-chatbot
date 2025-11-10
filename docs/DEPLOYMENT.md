# Deployment Guide

Complete guide to deploying the Xpio Health Lead Generation Chatbot to production.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database
- Email account (Gmail, SendGrid, etc.)
- Anthropic API key
- Domain name for API

## Option 1: Deploy to Railway (Recommended - Easiest)

Railway provides easy deployment with built-in PostgreSQL and environment management.

### Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

### Step 2: Create New Project

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your repository

### Step 3: Add PostgreSQL

1. Click "New" > "Database" > "Add PostgreSQL"
2. Railway will automatically provide `DATABASE_URL`

### Step 4: Configure Environment Variables

In Railway dashboard, add these variables:

```env
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=(automatically provided)
EMAIL_SERVICE=gmail
EMAIL_USER=your@gmail.com
EMAIL_PASSWORD=your_app_password
NOTIFICATION_EMAIL=notifications@xpiohealth.com
ALLOWED_ORIGINS=https://xpiohealth.com,https://www.xpiohealth.com
NODE_ENV=production
```

### Step 5: Deploy

1. Railway automatically deploys on push
2. Get your API URL: `https://your-project.up.railway.app`
3. Test health endpoint: `https://your-project.up.railway.app/health`

### Step 6: Add Custom Domain (Optional)

1. In Railway dashboard, go to Settings
2. Click "Custom Domain"
3. Add `api.xpiohealth.com`
4. Update DNS records as instructed

**Cost:** ~$5-20/month depending on usage

---

## Option 2: Deploy to Vercel

Vercel is great for serverless deployment.

### Step 1: Install Vercel CLI

```bash
npm i -g vercel
```

### Step 2: Create vercel.json

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Step 3: Add PostgreSQL

Use [Supabase](https://supabase.com) (free tier available):

1. Create Supabase project
2. Get connection string from Settings > Database
3. Add to Vercel environment variables

### Step 4: Deploy

```bash
cd backend
vercel --prod
```

### Step 5: Configure Environment Variables

In Vercel dashboard > Settings > Environment Variables, add all required variables.

**Cost:** Free for hobby projects, $20/month for production

---

## Option 3: Deploy to AWS (Most Scalable)

### Architecture

- AWS Elastic Beanstalk (or EC2)
- RDS PostgreSQL
- SES for email
- CloudFront CDN

### Step 1: Create RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier xpio-chatbot-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password YOUR_PASSWORD \
  --allocated-storage 20
```

### Step 2: Deploy to Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize
cd backend
eb init -p node.js xpio-chatbot

# Create environment
eb create production

# Set environment variables
eb setenv ANTHROPIC_API_KEY=sk-ant-... EMAIL_USER=... (etc)

# Deploy
eb deploy
```

### Step 3: Configure Email with SES

1. Verify your domain in AWS SES
2. Update email service in code to use SES
3. Update environment variables

**Cost:** ~$30-50/month minimum

---

## Option 4: Deploy to VPS (DigitalOcean, Linode)

### Step 1: Create Droplet

1. Create Ubuntu 22.04 droplet
2. SSH into server

### Step 2: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install PM2 for process management
sudo npm install -g pm2
```

### Step 3: Setup PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE lead_gen_db;
CREATE USER chatbot_user WITH PASSWORD 'strong_password';
GRANT ALL PRIVILEGES ON DATABASE lead_gen_db TO chatbot_user;
\q
```

### Step 4: Deploy Application

```bash
# Clone repository
git clone https://github.com/your-org/lead-gen-chatbot.git
cd lead-gen-chatbot/backend

# Install dependencies
npm install

# Create .env file
nano .env
# (Add all environment variables)

# Start with PM2
pm2 start server.js --name xpio-chatbot
pm2 save
pm2 startup
```

### Step 5: Setup Nginx Reverse Proxy

```bash
sudo apt install nginx

# Create nginx config
sudo nano /etc/nginx/sites-available/chatbot
```

```nginx
server {
    listen 80;
    server_name api.xpiohealth.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/chatbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: Setup SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.xpiohealth.com
```

**Cost:** ~$5-12/month for droplet

---

## Database Setup

### Create Tables

The application automatically creates tables on first run. To manually create:

```sql
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  organization VARCHAR(255),
  role VARCHAR(255),
  organization_size VARCHAR(100),
  primary_interest TEXT NOT NULL,
  current_systems TEXT,
  timeline VARCHAR(100),
  budget_range VARCHAR(100),
  pain_points TEXT,
  conversation_summary TEXT NOT NULL,
  qualification_score VARCHAR(20) NOT NULL,
  next_steps TEXT,
  conversation_history JSONB NOT NULL,
  source VARCHAR(50) DEFAULT 'website_chatbot',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  followed_up BOOLEAN DEFAULT FALSE,
  followed_up_at TIMESTAMP
);

CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_qualification ON leads(qualification_score);
```

---

## Email Setup

### Gmail Setup

1. Enable 2FA on Google account
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use app password in `EMAIL_PASSWORD`

```env
EMAIL_SERVICE=gmail
EMAIL_USER=your@gmail.com
EMAIL_PASSWORD=app_password_here
```

### SendGrid Setup (Better for Production)

1. Sign up at sendgrid.com
2. Create API key
3. Update email service:

```javascript
// In emailService.js
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY
  }
});
```

---

## Monitoring & Maintenance

### Health Checks

Setup monitoring for:
- `https://your-api.com/health` - Should return 200
- `https://your-api.com/api/stats` - Check active conversations

### Logging

```bash
# View PM2 logs (VPS)
pm2 logs xpio-chatbot

# View Railway logs
railway logs

# View Vercel logs
vercel logs
```

### Database Backups

```bash
# Manual backup
pg_dump -U username database_name > backup.sql

# Automated daily backup (cron)
0 2 * * * pg_dump -U username database_name > /backups/$(date +\%Y\%m\%d).sql
```

---

## Cost Estimate

### Monthly Costs

| Component | Railway | Vercel + Supabase | AWS | VPS |
|-----------|---------|-------------------|-----|-----|
| Hosting | $5-10 | Free-$20 | $30-50 | $5-12 |
| Database | Included | Free-$25 | $15-30 | Included |
| Claude API* | $50-200 | $50-200 | $50-200 | $50-200 |
| **Total** | **$55-210** | **$50-245** | **$95-280** | **$55-212** |

*Depends on conversation volume. ~1000 conversations/month with Claude Opus 4.1

### Cost Optimization

1. **Use Claude Sonnet instead of Opus** - 90% cheaper
2. **Add conversation caching** - Reduce token usage
3. **Implement conversation timeouts** - Auto-cleanup
4. **Use economy mode for simple queries**

---

## Security Checklist

- ✅ Use HTTPS everywhere
- ✅ Set strong `SESSION_SECRET`
- ✅ Enable rate limiting
- ✅ Whitelist origins in CORS
- ✅ Use environment variables for secrets
- ✅ Regular database backups
- ✅ Monitor for unusual activity
- ✅ Keep dependencies updated

---

## Going Live Checklist

- [ ] Backend deployed and accessible
- [ ] Database tables created
- [ ] Environment variables configured
- [ ] Email notifications working
- [ ] HTTPS enabled
- [ ] Health check passing
- [ ] Test conversation end-to-end
- [ ] Widget integrated in WordPress
- [ ] DNS configured (if using custom domain)
- [ ] Monitoring setup
- [ ] Backups configured

---

## Troubleshooting

### Connection Refused

```bash
# Check if server is running
curl https://your-api.com/health

# Check logs
pm2 logs
```

### Database Connection Failed

```bash
# Test connection
psql $DATABASE_URL

# Check firewall rules
# Ensure database allows connections from your server
```

### Email Not Sending

```bash
# Test SMTP
node -e "require('./src/services/emailService.js').testEmailConfiguration()"
```

---

## Support

Need help deploying? Contact: tech@xpiohealth.com
