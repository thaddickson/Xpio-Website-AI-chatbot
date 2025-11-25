import { getSupabase } from '../models/Lead.js';

// Claude Opus 4.5 pricing (per million tokens)
const PRICING = {
  'claude-opus-4-5-20251101': {
    input: 15.00,   // $15 per million input tokens
    output: 75.00,  // $75 per million output tokens
    cacheWrite: 18.75, // $18.75 per million cache write tokens
    cacheRead: 1.50    // $1.50 per million cache read tokens
  },
  'claude-sonnet-4-20250514': {
    input: 3.00,
    output: 15.00,
    cacheWrite: 3.75,
    cacheRead: 0.30
  },
  // Fallback for unknown models
  'default': {
    input: 15.00,
    output: 75.00,
    cacheWrite: 18.75,
    cacheRead: 1.50
  }
};

/**
 * Track token usage for a conversation
 * @param {string} tenantId - The tenant ID
 * @param {string} conversationId - The conversation ID
 * @param {string} model - The Claude model used
 * @param {object} usage - Usage object from Claude API response
 */
export async function trackUsage(tenantId, conversationId, model, usage) {
  if (!usage) return;

  const supabase = getSupabase();
  const pricing = PRICING[model] || PRICING['default'];

  // Calculate cost
  const inputCost = (usage.input_tokens || 0) / 1_000_000 * pricing.input;
  const outputCost = (usage.output_tokens || 0) / 1_000_000 * pricing.output;
  const cacheWriteCost = (usage.cache_creation_input_tokens || 0) / 1_000_000 * pricing.cacheWrite;
  const cacheReadCost = (usage.cache_read_input_tokens || 0) / 1_000_000 * pricing.cacheRead;
  const totalCost = inputCost + outputCost + cacheWriteCost + cacheReadCost;

  try {
    // Insert usage record
    const { error } = await supabase
      .from('api_usage')
      .insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        model: model,
        input_tokens: usage.input_tokens || 0,
        output_tokens: usage.output_tokens || 0,
        cache_creation_tokens: usage.cache_creation_input_tokens || 0,
        cache_read_tokens: usage.cache_read_input_tokens || 0,
        cost_usd: totalCost
      });

    if (error) {
      console.error('Failed to track usage:', error);
    }
  } catch (err) {
    console.error('Error tracking usage:', err);
  }
}

/**
 * Get usage summary for a tenant
 * @param {string} tenantId - The tenant ID
 * @param {string} period - 'day', 'week', 'month', or 'all'
 */
export async function getTenantUsage(tenantId, period = 'month') {
  const supabase = getSupabase();

  let startDate;
  const now = new Date();

  switch (period) {
    case 'day':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'all':
      startDate = new Date(0);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  try {
    const { data, error } = await supabase
      .from('api_usage')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    // Aggregate the data
    const summary = {
      period,
      startDate: startDate.toISOString(),
      totalRequests: data.length,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheCreationTokens: 0,
      totalCacheReadTokens: 0,
      totalCostUsd: 0,
      byModel: {},
      byDay: {}
    };

    data.forEach(record => {
      summary.totalInputTokens += record.input_tokens || 0;
      summary.totalOutputTokens += record.output_tokens || 0;
      summary.totalCacheCreationTokens += record.cache_creation_tokens || 0;
      summary.totalCacheReadTokens += record.cache_read_tokens || 0;
      summary.totalCostUsd += parseFloat(record.cost_usd) || 0;

      // Group by model
      if (!summary.byModel[record.model]) {
        summary.byModel[record.model] = {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0
        };
      }
      summary.byModel[record.model].requests++;
      summary.byModel[record.model].inputTokens += record.input_tokens || 0;
      summary.byModel[record.model].outputTokens += record.output_tokens || 0;
      summary.byModel[record.model].costUsd += parseFloat(record.cost_usd) || 0;

      // Group by day
      const day = record.created_at.split('T')[0];
      if (!summary.byDay[day]) {
        summary.byDay[day] = {
          requests: 0,
          tokens: 0,
          costUsd: 0
        };
      }
      summary.byDay[day].requests++;
      summary.byDay[day].tokens += (record.input_tokens || 0) + (record.output_tokens || 0);
      summary.byDay[day].costUsd += parseFloat(record.cost_usd) || 0;
    });

    // Round costs
    summary.totalCostUsd = Math.round(summary.totalCostUsd * 10000) / 10000;
    Object.keys(summary.byModel).forEach(model => {
      summary.byModel[model].costUsd = Math.round(summary.byModel[model].costUsd * 10000) / 10000;
    });
    Object.keys(summary.byDay).forEach(day => {
      summary.byDay[day].costUsd = Math.round(summary.byDay[day].costUsd * 10000) / 10000;
    });

    return summary;
  } catch (err) {
    console.error('Error getting tenant usage:', err);
    return null;
  }
}

/**
 * Get usage for all tenants (platform admin)
 * @param {string} period - 'day', 'week', 'month', or 'all'
 */
export async function getAllTenantsUsage(period = 'month') {
  const supabase = getSupabase();

  let startDate;
  const now = new Date();

  switch (period) {
    case 'day':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  try {
    // Get usage grouped by tenant
    const { data, error } = await supabase
      .from('api_usage')
      .select(`
        tenant_id,
        input_tokens,
        output_tokens,
        cost_usd,
        tenants (name, slug)
      `)
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    // Aggregate by tenant
    const byTenant = {};

    data.forEach(record => {
      const tenantId = record.tenant_id;
      if (!byTenant[tenantId]) {
        byTenant[tenantId] = {
          tenantId,
          tenantName: record.tenants?.name || 'Unknown',
          tenantSlug: record.tenants?.slug || 'unknown',
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0
        };
      }
      byTenant[tenantId].requests++;
      byTenant[tenantId].inputTokens += record.input_tokens || 0;
      byTenant[tenantId].outputTokens += record.output_tokens || 0;
      byTenant[tenantId].costUsd += parseFloat(record.cost_usd) || 0;
    });

    // Convert to array and sort by cost
    const tenants = Object.values(byTenant)
      .map(t => ({
        ...t,
        costUsd: Math.round(t.costUsd * 10000) / 10000
      }))
      .sort((a, b) => b.costUsd - a.costUsd);

    return {
      period,
      startDate: startDate.toISOString(),
      totalCostUsd: Math.round(tenants.reduce((sum, t) => sum + t.costUsd, 0) * 10000) / 10000,
      totalRequests: tenants.reduce((sum, t) => sum + t.requests, 0),
      tenants
    };
  } catch (err) {
    console.error('Error getting all tenants usage:', err);
    return null;
  }
}

/**
 * Fetch usage from Anthropic API (for tenants with their own API key)
 * @param {string} apiKey - The tenant's Anthropic API key
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 */
export async function fetchAnthropicUsage(apiKey, startDate, endDate) {
  try {
    const response = await fetch(
      `https://api.anthropic.com/v1/organizations/usage_report/messages?start_date=${startDate}&end_date=${endDate}&time_bucket=1d`,
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch Anthropic usage');
    }

    return await response.json();
  } catch (err) {
    console.error('Error fetching Anthropic usage:', err);
    return null;
  }
}

/**
 * Fetch cost report from Anthropic API
 * @param {string} apiKey - The tenant's Anthropic API key
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 */
export async function fetchAnthropicCost(apiKey, startDate, endDate) {
  try {
    const response = await fetch(
      `https://api.anthropic.com/v1/organizations/cost_report?start_date=${startDate}&end_date=${endDate}&time_bucket=1d`,
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch Anthropic cost');
    }

    return await response.json();
  } catch (err) {
    console.error('Error fetching Anthropic cost:', err);
    return null;
  }
}

export default {
  trackUsage,
  getTenantUsage,
  getAllTenantsUsage,
  fetchAnthropicUsage,
  fetchAnthropicCost
};
