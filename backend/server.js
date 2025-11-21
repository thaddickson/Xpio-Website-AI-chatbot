import dotenv from 'dotenv';

// Load environment variables FIRST before importing other modules
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {
  handleChatStream,
  handleGetGreeting,
  handleEndConversation,
  handleGetStats
} from './src/controllers/chatController.js';
import { initializeDatabase } from './src/models/Lead.js';
import { testEmailConfiguration } from './src/services/emailService.js';
import { chatRateLimiter } from './src/middleware/rateLimiter.js';

// Validate required environment variables
const requiredEnvVars = ['ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please check your .env file');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Serve static files (chat widget)
app.use(express.static('public'));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/chat/greeting', handleGetGreeting);
app.post('/api/chat', chatRateLimiter, handleChatStream);
app.post('/api/chat/end', handleEndConversation);

// Stats endpoint (consider adding authentication in production)
app.get('/api/stats', handleGetStats);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Initialize and start server
async function startServer() {
  try {
    console.log('🚀 Starting Xpio Health Lead Generation Chatbot...');
    console.log('');

    // Initialize database
    console.log('📊 Connecting to Supabase...');
    await initializeDatabase();

    // Test email configuration (optional)
    if (process.env.SENDGRID_API_KEY) {
      console.log('📧 Testing SendGrid configuration...');
      try {
        await testEmailConfiguration();
      } catch (error) {
        console.log('⚠️  Email configuration has issues but server will continue');
        console.log('   Leads will be saved to database without email notifications');
      }
    } else {
      console.log('⚠️  Email not configured (leads will be saved to database only)');
    }

    // Start server
    const HOST = process.env.HOST || '0.0.0.0';
    app.listen(PORT, HOST, () => {
      console.log('');
      console.log('✅ Server is running!');
      console.log('');
      console.log(`🌐 API URL: http://localhost:${PORT}`);
      console.log(`📍 Chat endpoint: POST http://localhost:${PORT}/api/chat`);
      console.log(`💚 Health check: http://localhost:${PORT}/health`);
      console.log(`📊 Stats: http://localhost:${PORT}/api/stats`);
      console.log('');
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🤖 Model: Claude Opus 4.1`);
      console.log('');
      console.log('Press Ctrl+C to stop the server');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();
