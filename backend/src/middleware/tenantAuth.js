import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { TenantUser } from '../models/Tenant.js';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_PASSWORD || 'change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

/**
 * Generate JWT tokens for a user
 * @param {Object} user - User object with id, email, role, tenant info
 * @returns {Object} { accessToken, refreshToken, expiresIn }
 */
export function generateTokens(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenant_id,
    tenantSlug: user.tenant?.slug
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });

  return {
    accessToken,
    refreshToken,
    expiresIn: JWT_EXPIRES_IN,
    tokenType: 'Bearer'
  };
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null if invalid
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {string} Hashed password
 */
export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {boolean} True if match
 */
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * JWT Authentication Middleware
 * Validates JWT and attaches user/tenant to request
 */
export function jwtAuth(options = {}) {
  const {
    required = true,
    allowLegacyPassword = true // Allow old ADMIN_PASSWORD for backwards compatibility
  } = options;

  return async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      if (required) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Please provide a valid authentication token'
        });
      }
      return next();
    }

    // Check for Bearer token
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      // First try JWT
      const decoded = verifyToken(token);
      if (decoded && decoded.userId) {
        // Valid JWT - fetch full user data
        const user = await TenantUser.getById(decoded.userId);
        if (user && user.status === 'active') {
          req.user = user;
          req.userId = user.id;
          req.userRole = user.role;

          // Override tenant from JWT if not already set
          if (!req.tenant && user.tenant) {
            req.tenant = user.tenant;
            req.tenantId = user.tenant_id;
          }

          return next();
        }
      }

      // Fall back to legacy password authentication
      if (allowLegacyPassword) {
        const adminPasswords = (process.env.ADMIN_PASSWORD || '').split(',').map(p => p.trim());
        if (adminPasswords.includes(token)) {
          req.user = { role: 'admin', isLegacyAuth: true };
          req.userRole = 'admin';
          return next();
        }
      }
    }

    if (required) {
      return res.status(401).json({
        error: 'Invalid authentication',
        message: 'The provided token is invalid or expired'
      });
    }

    next();
  };
}

/**
 * Role-based access control middleware
 * @param {string[]} allowedRoles - Array of roles that can access the route
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource'
      });
    }

    const userRole = req.userRole || req.user.role;

    // Owner can access everything
    if (userRole === 'owner') {
      return next();
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Access denied',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        yourRole: userRole
      });
    }

    next();
  };
}

/**
 * Ensure user belongs to the tenant they're trying to access
 */
export function requireTenantMatch() {
  return (req, res, next) => {
    if (!req.user || !req.tenant) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource'
      });
    }

    // Legacy auth has access to default tenant
    if (req.user.isLegacyAuth) {
      return next();
    }

    // Check tenant match
    if (req.user.tenant_id !== req.tenantId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this tenant'
      });
    }

    next();
  };
}

/**
 * Platform admin middleware (for super-admin operations)
 */
export function requirePlatformAdmin() {
  return (req, res, next) => {
    // Check for platform admin key
    const platformKey = req.headers['x-platform-admin-key'];
    const expectedKey = process.env.PLATFORM_ADMIN_KEY;

    if (expectedKey && platformKey === expectedKey) {
      req.isPlatformAdmin = true;
      return next();
    }

    // Check for legacy admin password with platform admin rights
    if (req.user?.isLegacyAuth && process.env.ADMIN_PASSWORD) {
      req.isPlatformAdmin = true;
      return next();
    }

    return res.status(403).json({
      error: 'Access denied',
      message: 'Platform administrator access required'
    });
  };
}

/**
 * Login handler - authenticate user and return tokens
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} tenantSlug - Tenant slug
 * @returns {Object} { success, tokens, user, error }
 */
export async function loginUser(email, password, tenantSlug) {
  try {
    // Get tenant
    const Tenant = (await import('../models/Tenant.js')).default;
    const tenant = await Tenant.getBySlug(tenantSlug);

    if (!tenant) {
      return { success: false, error: 'Tenant not found' };
    }

    // Get user
    const user = await TenantUser.getByEmail(email, tenant.id);

    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }

    if (user.status !== 'active') {
      return { success: false, error: 'Account is not active' };
    }

    // Check password
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Track login
    await TenantUser.trackLogin(user.id);

    // Generate tokens
    const userWithTenant = { ...user, tenant };
    const tokens = generateTokens(userWithTenant);

    return {
      success: true,
      tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug
        }
      }
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Refresh token handler
 * @param {string} refreshToken - Refresh token
 * @returns {Object} { success, tokens, error }
 */
export async function refreshTokens(refreshToken) {
  try {
    const decoded = verifyToken(refreshToken);

    if (!decoded || decoded.type !== 'refresh') {
      return { success: false, error: 'Invalid refresh token' };
    }

    // Get current user data
    const user = await TenantUser.getById(decoded.userId);

    if (!user || user.status !== 'active') {
      return { success: false, error: 'User not found or inactive' };
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    return { success: true, tokens };
  } catch (error) {
    console.error('Token refresh error:', error);
    return { success: false, error: 'Token refresh failed' };
  }
}

export default jwtAuth;
