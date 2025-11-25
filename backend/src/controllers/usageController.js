import { getTenantUsage, getAllTenantsUsage, fetchAnthropicUsage, fetchAnthropicCost } from '../services/usageService.js';
import { DEFAULT_TENANT_ID } from '../models/Tenant.js';

/**
 * Get usage for the current tenant
 * GET /api/admin/usage
 */
export async function getUsage(req, res) {
  try {
    const tenantId = req.tenantId || DEFAULT_TENANT_ID;
    const period = req.query.period || 'month';

    const usage = await getTenantUsage(tenantId, period);

    if (!usage) {
      return res.status(500).json({ error: 'Failed to fetch usage data' });
    }

    res.json(usage);
  } catch (error) {
    console.error('Error getting usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
}

/**
 * Get usage for all tenants (platform admin)
 * GET /api/platform/usage
 */
export async function getPlatformUsage(req, res) {
  try {
    const period = req.query.period || 'month';

    const usage = await getAllTenantsUsage(period);

    if (!usage) {
      return res.status(500).json({ error: 'Failed to fetch platform usage data' });
    }

    res.json(usage);
  } catch (error) {
    console.error('Error getting platform usage:', error);
    res.status(500).json({ error: 'Failed to fetch platform usage data' });
  }
}

/**
 * Get usage directly from Anthropic API (for tenants with their own API key)
 * GET /api/admin/usage/anthropic
 */
export async function getAnthropicUsage(req, res) {
  try {
    const apiKey = req.query.apiKey || process.env.ANTHROPIC_API_KEY;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate || new Date().toISOString().split('T')[0];

    if (!startDate) {
      // Default to start of current month
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      req.query.startDate = start.toISOString().split('T')[0];
    }

    const [usage, cost] = await Promise.all([
      fetchAnthropicUsage(apiKey, req.query.startDate, endDate),
      fetchAnthropicCost(apiKey, req.query.startDate, endDate)
    ]);

    res.json({
      usage,
      cost,
      startDate: req.query.startDate,
      endDate
    });
  } catch (error) {
    console.error('Error getting Anthropic usage:', error);
    res.status(500).json({ error: 'Failed to fetch Anthropic usage data' });
  }
}

export default {
  getUsage,
  getPlatformUsage,
  getAnthropicUsage
};
