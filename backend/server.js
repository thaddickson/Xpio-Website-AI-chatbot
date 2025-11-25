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
import {
  getAllPrompts,
  getPromptBySlug,
  createPrompt,
  updatePrompt,
  deletePrompt,
  getPromptHistory,
  previewSystemPrompt,
  importHardcodedPrompt
} from './src/controllers/promptController.js';
import {
  getVariations,
  createVariation,
  updateVariation,
  deleteVariation,
  getPerformanceComparison,
  promoteVariation,
  quickRollback
} from './src/controllers/variationController.js';
import {
  improvePrompt,
  analyzePrompt,
  generatePrompt
} from './src/controllers/aiEditorController.js';
import {
  handleSlackEvents,
  pollSlackMessages,
  sendToSlackThread
} from './src/controllers/slackController.js';
import {
  getUsage,
  getPlatformUsage,
  getAnthropicUsage
} from './src/controllers/usageController.js';
import {
  registerTenant,
  login,
  refreshToken,
  getCurrentTenant,
  updateTenantSettings,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  listTeamMembers,
  inviteTeamMember,
  getIntegrations,
  updateIntegrations,
  listAllTenants,
  getPlans,
  checkSlugAvailability
} from './src/controllers/tenantController.js';
import { initializeDatabase } from './src/models/Lead.js';
import { testEmailConfiguration } from './src/services/emailService.js';
import { chatRateLimiter } from './src/middleware/rateLimiter.js';
import { tenantResolver, requireFeature, checkUsageLimits } from './src/middleware/tenantResolver.js';
import { jwtAuth, requireRole, requirePlatformAdmin } from './src/middleware/tenantAuth.js';

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
  credentials: true,
  exposedHeaders: ['Content-Type', 'Content-Length']
}));

// Additional CORS headers for static files
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Body parser - increased limit for large prompts
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve static files (chat widget)
app.use(express.static('public'));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Apply tenant resolver to all routes (optional tenant - backwards compatible)
app.use(tenantResolver({ allowDefaultTenant: true }));

// Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    tenant: req.tenant?.slug || 'default'
  });
});

// ==================== PUBLIC ENDPOINTS ====================

// Widget config endpoint (for multi-tenant widget initialization)
app.get('/api/widget/config', (req, res) => {
  if (!req.tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  res.json({
    branding: req.tenant.settings?.branding || {},
    features: {
      removeWatermark: req.tenant.settings?.features?.removeWatermark || false
    },
    calendlyUrl: null // Would come from tenant_integrations
  });
});

// Plans info (public)
app.get('/api/plans', getPlans);

// Check slug availability (public - for registration)
app.get('/api/tenants/check-slug/:slug', checkSlugAvailability);

// ==================== CHAT ENDPOINTS (tenant-scoped) ====================

app.get('/api/chat/greeting', handleGetGreeting);
app.post('/api/chat', chatRateLimiter, checkUsageLimits(), handleChatStream);
app.post('/api/chat/end', handleEndConversation);

// Stats endpoint (consider adding authentication in production)
app.get('/api/stats', handleGetStats);

// Slack integration endpoints
app.post('/api/slack/events', handleSlackEvents);
app.get('/api/slack/poll/:conversationId', pollSlackMessages);
app.post('/api/slack/send-to-thread', sendToSlackThread);

// ==================== TENANT AUTH ENDPOINTS ====================

app.post('/api/tenants/register', registerTenant);
app.post('/api/tenants/login', login);
app.post('/api/tenants/refresh', refreshToken);

// ==================== TENANT MANAGEMENT ENDPOINTS (authenticated) ====================

app.get('/api/tenant', jwtAuth(), getCurrentTenant);
app.put('/api/tenant/settings', jwtAuth(), requireRole('owner', 'admin'), updateTenantSettings);

// API Key management
app.get('/api/tenant/api-keys', jwtAuth(), listApiKeys);
app.post('/api/tenant/api-keys', jwtAuth(), requireRole('owner', 'admin'), createApiKey);
app.delete('/api/tenant/api-keys/:keyId', jwtAuth(), requireRole('owner', 'admin'), revokeApiKey);

// Team management
app.get('/api/tenant/team', jwtAuth(), listTeamMembers);
app.post('/api/tenant/team/invite', jwtAuth(), requireRole('owner', 'admin'), inviteTeamMember);

// Integrations
app.get('/api/tenant/integrations', jwtAuth(), getIntegrations);
app.put('/api/tenant/integrations', jwtAuth(), requireRole('owner', 'admin'), updateIntegrations);

// ==================== PLATFORM ADMIN ENDPOINTS ====================

app.get('/api/platform/tenants', jwtAuth(), requirePlatformAdmin(), listAllTenants);

// Admin authentication middleware
// Supports multiple admin passwords separated by commas
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const adminPasswordsEnv = process.env.ADMIN_PASSWORD;

  // If no password is set, warn but allow (for backward compatibility during setup)
  if (!adminPasswordsEnv) {
    console.warn('⚠️  WARNING: ADMIN_PASSWORD not set! Admin endpoints are unprotected!');
    return next();
  }

  // Check for Bearer token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin password required. Please set Authorization header.'
    });
  }

  const providedPassword = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Support multiple passwords separated by commas
  const validPasswords = adminPasswordsEnv.split(',').map(p => p.trim());

  if (!validPasswords.includes(providedPassword)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid admin password'
    });
  }

  next();
};

// Admin endpoints for prompt management (protected)
app.post('/api/admin/prompts/import', adminAuth, importHardcodedPrompt);
app.get('/api/admin/prompts/preview', adminAuth, previewSystemPrompt);
app.get('/api/admin/prompts/:id/history', adminAuth, getPromptHistory);
app.get('/api/admin/prompts/:slug', adminAuth, getPromptBySlug);
app.get('/api/admin/prompts', adminAuth, getAllPrompts);
app.post('/api/admin/prompts', adminAuth, createPrompt);
app.put('/api/admin/prompts/:id', adminAuth, updatePrompt);
app.delete('/api/admin/prompts/:id', adminAuth, deletePrompt);

// A/B testing and variation endpoints (protected)
app.get('/api/admin/prompts/:promptId/variations/performance', adminAuth, getPerformanceComparison);
app.get('/api/admin/prompts/:promptId/variations', adminAuth, getVariations);
app.post('/api/admin/prompts/:promptId/variations', adminAuth, createVariation);
app.post('/api/admin/prompts/:promptId/rollback', adminAuth, quickRollback);
app.put('/api/admin/variations/:id', adminAuth, updateVariation);
app.delete('/api/admin/variations/:id', adminAuth, deleteVariation);
app.post('/api/admin/variations/:id/promote', adminAuth, promoteVariation);

// AI Prompt Editor endpoints (protected)
app.post('/api/admin/ai-editor/improve', adminAuth, improvePrompt);
app.post('/api/admin/ai-editor/analyze', adminAuth, analyzePrompt);
app.post('/api/admin/ai-editor/generate', adminAuth, generatePrompt);

// Usage tracking endpoints (protected)
app.get('/api/admin/usage', adminAuth, getUsage);
app.get('/api/admin/usage/anthropic', adminAuth, getAnthropicUsage);
app.get('/api/platform/usage', adminAuth, getPlatformUsage);

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
