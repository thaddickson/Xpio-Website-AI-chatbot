# Xpio Health Delphi AI - Lead Generation Chatbot

AI-powered lead generation chatbot for Xpio Health's website, built with Claude AI (Anthropic).

## Features

- **Smart Conversational AI**: Powered by Claude Opus 4.1
- **Intelligent Lead Qualification**: Automatically scores leads as hot, warm, or cold
- **Beautiful UI**: Xpio Health branded widget with smooth animations
- **Real-time Streaming**: SSE-based streaming responses
- **Supabase Integration**: Secure cloud database for lead storage
- **Email Notifications**: Automated email alerts for new leads
- **HIPAA Awareness**: Designed for healthcare technology conversations

## Tech Stack

### Backend
- Node.js + Express
- Claude AI (Anthropic SDK)
- Supabase (PostgreSQL)
- Nodemailer for email notifications
- Server-Sent Events (SSE) for streaming

### Frontend
- Vanilla JavaScript (embeddable widget)
- Custom CSS with Xpio Health branding
- Responsive design

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Create `backend/.env`:

```env
# Anthropic API
ANTHROPIC_API_KEY=your_anthropic_key

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Server
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:5500

# Email (optional)
EMAIL_SERVICE=gmail
EMAIL_USER=your@email.com
EMAIL_PASSWORD=your_app_password
NOTIFICATION_EMAIL=notifications@xpiohealth.com
```

### 3. Set Up Database

Run the SQL in `backend/supabase-setup.sql` in your Supabase SQL editor.

### 4. Start the Server

```bash
cd backend
npm run dev
```

Server runs on http://localhost:3001

### 5. Test the Widget

Open `frontend/test.html` in your browser to test the chatbot.

## Embedding the Widget

Add to your website:

```html
<script src="https://your-domain.com/chat-widget.js"></script>
<script>
  XpioChatbot.init({
    apiUrl: 'https://your-api-domain.com',
    primaryColor: '#FC922B',
    position: 'bottom-right'
  });
</script>
```

## API Endpoints

- `POST /api/chat` - Chat with AI (streaming)
- `GET /api/chat/greeting` - Get initial greeting
- `POST /api/chat/end` - End conversation
- `GET /api/stats` - Get conversation stats
- `GET /health` - Health check

## Lead Qualification

The AI automatically qualifies leads based on:
- Budget and timeline
- Decision-making authority
- Specific pain points
- Organization size and fit

Leads are scored as:
- 🔥 **Hot**: Ready to buy, clear need, budget confirmed
- ⚡ **Warm**: Interested, evaluating options
- ❄️ **Cold**: Early research phase

## Xpio Health Services

The chatbot is trained on Xpio Health's full service portfolio:

- Analytics & Data Warehousing
- HIPAA Compliance & Security
- EHR Consulting & Integration
- Cloud Infrastructure (AWS, Azure, GCP)
- HIE Integration
- HEDIS & RAF Scoring
- Virtual CISO/CTO Services
- Cyber Incident Response

## Development

```bash
# Backend development
cd backend
npm run dev

# The frontend is static HTML/JS/CSS
# Open frontend/test.html in browser
```

## License

Proprietary - Xpio Health

## Support

For support, contact the Xpio Health development team.
