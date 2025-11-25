import PromptVariation from '../models/PromptVariation.js';
import { clearPromptCache } from './chatController.js';

/**
 * Get all variations for a prompt section
 * GET /api/admin/prompts/:promptId/variations
 */
export async function getVariations(req, res) {
  try {
    const { promptId } = req.params;
    const variations = await PromptVariation.getByPromptSection(promptId);
    res.json({ variations });
  } catch (error) {
    console.error('Error getting variations:', error);
    res.status(500).json({ error: 'Failed to fetch variations' });
  }
}

/**
 * Create a new variation
 * POST /api/admin/prompts/:promptId/variations
 */
export async function createVariation(req, res) {
  try {
    const { promptId } = req.params;
    const { variation_name, content, traffic_percentage, notes, is_active } = req.body;

    if (!variation_name || !content) {
      return res.status(400).json({
        error: 'Variation name and content are required'
      });
    }

    const variation = await PromptVariation.create({
      prompt_section_id: promptId,
      variation_name,
      content,
      traffic_percentage: traffic_percentage || 0,
      is_active: is_active || false, // Use value from request, default to false
      notes,
      created_by: 'admin'
    });

    // Clear cache so variation is available immediately
    clearPromptCache();

    res.json({
      variation,
      message: 'Variation created successfully. Activate it to start testing.'
    });
  } catch (error) {
    console.error('Error creating variation:', error);
    res.status(500).json({ error: 'Failed to create variation' });
  }
}

/**
 * Update a variation
 * PUT /api/admin/variations/:id
 */
export async function updateVariation(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const variation = await PromptVariation.update(id, updates);

    // Clear cache so updated variation takes effect immediately
    clearPromptCache();

    res.json({
      variation,
      message: 'Variation updated successfully'
    });
  } catch (error) {
    console.error('Error updating variation:', error);
    res.status(500).json({ error: 'Failed to update variation' });
  }
}

/**
 * Delete a variation
 * DELETE /api/admin/variations/:id
 */
export async function deleteVariation(req, res) {
  try {
    const { id } = req.params;
    await PromptVariation.delete(id);

    // Clear cache so deletion takes effect immediately
    clearPromptCache();

    res.json({ message: 'Variation deleted successfully' });
  } catch (error) {
    console.error('Error deleting variation:', error);
    res.status(500).json({ error: 'Failed to delete variation' });
  }
}

/**
 * Get performance comparison for all variations
 * GET /api/admin/prompts/:promptId/variations/performance
 */
export async function getPerformanceComparison(req, res) {
  try {
    const { promptId } = req.params;
    const { days = 30 } = req.query;

    const comparison = await PromptVariation.getPerformanceComparison(
      promptId,
      parseInt(days)
    );

    res.json(comparison);
  } catch (error) {
    console.error('Error getting performance comparison:', error);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
}

/**
 * Promote a variation to become the base prompt
 * POST /api/admin/variations/:id/promote
 */
export async function promoteVariation(req, res) {
  try {
    const { id } = req.params;
    const { prompt_section_id } = req.body;

    if (!prompt_section_id) {
      return res.status(400).json({
        error: 'prompt_section_id is required'
      });
    }

    await PromptVariation.promoteToBase(id, prompt_section_id);

    // Clear cache so promoted content takes effect immediately
    clearPromptCache();

    res.json({
      message: 'Variation promoted to base prompt successfully! All tests have been deactivated.'
    });
  } catch (error) {
    console.error('Error promoting variation:', error);
    res.status(500).json({ error: 'Failed to promote variation' });
  }
}

/**
 * Quick rollback: Create variation from current, restore from history
 * POST /api/admin/prompts/:promptId/rollback
 */
export async function quickRollback(req, res) {
  try {
    const { promptId } = req.params;
    const { target_version, reason } = req.body;

    // This would work with the Prompt model to:
    // 1. Get the target version from history
    // 2. Save current as a variation (as backup)
    // 3. Restore the target version to active

    // Implementation would go here
    res.json({
      message: 'Rollback feature coming soon'
    });
  } catch (error) {
    console.error('Error rolling back:', error);
    res.status(500).json({ error: 'Failed to rollback' });
  }
}

export default {
  getVariations,
  createVariation,
  updateVariation,
  deleteVariation,
  getPerformanceComparison,
  promoteVariation,
  quickRollback
};
