import Tenant, { TenantApiKey, DEFAULT_TENANT_ID } from '../models/Tenant.js';

/**
 * Tenant Resolution Middleware
 *
 * Resolves tenant from multiple sources (in priority order):
 * 1. API Key header (X-API-Key or Authorization: Bearer pk_...)
 * 2. Subdomain (tenant-slug.yourchatbot.com)
 * 3. Custom domain (chat.customerdomain.com)
 * 4. Query parameter (?tenant=slug) - for development
 * 5. Default tenant (for backwards compatibility)
 */

// Cache for tenant lookups (5 minute TTL)
const tenantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Clear expired cache entries
 */
function cleanCache() {
  const now = Date.now();
  for (const [key, value] of tenantCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      tenantCache.delete(key);
    }
  }
}

// Clean cache every minute
setInterval(cleanCache, 60 * 1000);

/**
 * Get cached tenant or fetch from database
 */
async function getCachedTenant(cacheKey, fetchFn) {
  const cached = tenantCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.tenant;
  }

  const tenant = await fetchFn();
  if (tenant) {
    tenantCache.set(cacheKey, { tenant, timestamp: Date.now() });
  }
  return tenant;
}

/**
 * Extract API key from request
 */
function extractApiKey(req) {
  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader) return apiKeyHeader;

  // Check Authorization header for API key format
  const authHeader = req.headers.authorization;
  if (authHeader) {
    // Format: "Bearer pk_live_..." or "ApiKey pk_live_..."
    const match = authHeader.match(/^(?:Bearer|ApiKey)\s+(pk_|sk_)(.+)$/i);
    if (match) {
      return `${match[1]}${match[2]}`;
    }
  }

  // Check query parameter (for widget script loading)
  if (req.query.apiKey) return req.query.apiKey;

  return null;
}

/**
 * Extract subdomain from host
 */
function extractSubdomain(host, baseDomains = []) {
  if (!host) return null;

  // Remove port if present
  const hostname = host.split(':')[0];

  // Check against known base domains
  for (const baseDomain of baseDomains) {
    if (hostname.endsWith(`.${baseDomain}`)) {
      const subdomain = hostname.slice(0, -(baseDomain.length + 1));
      // Ignore 'www' and 'api' subdomains
      if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
        return subdomain;
      }
    }
  }

  return null;
}

/**
 * Main tenant resolver middleware
 */
export function tenantResolver(options = {}) {
  const {
    baseDomains = ['localhost', 'yourchatbot.com'], // Add your actual domain
    requireTenant = false, // If true, reject requests without valid tenant
    allowDefaultTenant = true // If true, fall back to default tenant
  } = options;

  return async (req, res, next) => {
    let tenant = null;
    let resolvedVia = null;

    try {
      // 1. Try API Key
      const apiKey = extractApiKey(req);
      if (apiKey) {
        const result = await TenantApiKey.validate(apiKey);
        if (result) {
          tenant = result.tenant;
          req.apiKeyData = result.keyData;
          resolvedVia = 'api_key';
        }
      }

      // 2. Try subdomain
      if (!tenant) {
        const subdomain = extractSubdomain(req.headers.host, baseDomains);
        if (subdomain) {
          tenant = await getCachedTenant(`slug:${subdomain}`, () => Tenant.getBySlug(subdomain));
          if (tenant) resolvedVia = 'subdomain';
        }
      }

      // 3. Try custom domain
      if (!tenant && req.headers.host) {
        const hostname = req.headers.host.split(':')[0];
        tenant = await getCachedTenant(`domain:${hostname}`, () => Tenant.getByDomain(hostname));
        if (tenant) resolvedVia = 'custom_domain';
      }

      // 4. Try query parameter (development only)
      if (!tenant && process.env.NODE_ENV === 'development' && req.query.tenant) {
        tenant = await getCachedTenant(`slug:${req.query.tenant}`, () => Tenant.getBySlug(req.query.tenant));
        if (tenant) resolvedVia = 'query_param';
      }

      // 5. Fall back to default tenant
      if (!tenant && allowDefaultTenant) {
        tenant = await getCachedTenant(`id:${DEFAULT_TENANT_ID}`, () => Tenant.getById(DEFAULT_TENANT_ID));
        if (tenant) resolvedVia = 'default';
      }

      // Check if tenant is required
      if (!tenant && requireTenant) {
        return res.status(401).json({
          error: 'Tenant not found',
          message: 'Valid API key or tenant identifier required'
        });
      }

      // Check tenant status
      if (tenant && tenant.status !== 'active' && tenant.status !== 'trial') {
        return res.status(403).json({
          error: 'Tenant suspended',
          message: 'This account has been suspended. Please contact support.'
        });
      }

      // Check trial expiration
      if (tenant && tenant.status === 'trial' && tenant.trial_ends_at) {
        if (new Date(tenant.trial_ends_at) < new Date()) {
          return res.status(403).json({
            error: 'Trial expired',
            message: 'Your trial has expired. Please upgrade to continue.'
          });
        }
      }

      // Attach tenant to request
      req.tenant = tenant;
      req.tenantId = tenant?.id || null;
      req.tenantResolvedVia = resolvedVia;

      // Log tenant resolution (debug)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Tenant] Resolved: ${tenant?.slug || 'none'} via ${resolvedVia || 'none'}`);
      }

      next();
    } catch (error) {
      console.error('Tenant resolution error:', error);

      // Don't fail the request on resolution errors - fall back to default
      if (allowDefaultTenant) {
        req.tenant = await Tenant.getById(DEFAULT_TENANT_ID);
        req.tenantId = req.tenant?.id || null;
        req.tenantResolvedVia = 'default_fallback';
        next();
      } else {
        res.status(500).json({
          error: 'Tenant resolution failed',
          message: 'Unable to determine tenant context'
        });
      }
    }
  };
}

/**
 * Middleware to require a valid tenant (no default fallback)
 */
export function requireTenant() {
  return tenantResolver({ requireTenant: true, allowDefaultTenant: false });
}

/**
 * Middleware to check tenant feature access
 */
export function requireFeature(featureName) {
  return (req, res, next) => {
    if (!req.tenant) {
      return res.status(401).json({
        error: 'No tenant context',
        message: 'Authentication required'
      });
    }

    const features = req.tenant.settings?.features || {};
    if (!features[featureName]) {
      return res.status(403).json({
        error: 'Feature not available',
        message: `The '${featureName}' feature is not available on your current plan. Please upgrade to access this feature.`,
        feature: featureName,
        currentPlan: req.tenant.plan_type
      });
    }

    next();
  };
}

/**
 * Middleware to check tenant usage limits
 */
export function checkUsageLimits() {
  return async (req, res, next) => {
    if (!req.tenant) {
      return next(); // No tenant, no limits to check
    }

    try {
      const limits = await Tenant.checkLimits(req.tenantId);

      if (!limits.withinLimits) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: `You have reached your monthly ${limits.limitType} limit (${limits.current}/${limits.max}). Please upgrade your plan for more capacity.`,
          limitType: limits.limitType,
          current: limits.current,
          max: limits.max,
          currentPlan: req.tenant.plan_type
        });
      }

      // Attach limits to request for reference
      req.tenantLimits = limits;
      next();
    } catch (error) {
      console.error('Error checking usage limits:', error);
      next(); // Don't block on limit check errors
    }
  };
}

/**
 * Rate limiter that respects tenant-specific limits
 */
export function tenantRateLimiter() {
  const requestCounts = new Map(); // tenantId:endpoint -> { count, resetAt }

  return (req, res, next) => {
    if (!req.tenant) return next();

    const rateLimitPerMinute = req.apiKeyData?.rateLimitPerMinute || 60;
    const key = `${req.tenantId}:${req.path}`;
    const now = Date.now();

    let record = requestCounts.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + 60000 };
    }

    record.count++;
    requestCounts.set(key, record);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', rateLimitPerMinute);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimitPerMinute - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    if (record.count > rateLimitPerMinute) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please slow down.',
        retryAfter: Math.ceil((record.resetAt - now) / 1000)
      });
    }

    next();
  };
}

export default tenantResolver;
