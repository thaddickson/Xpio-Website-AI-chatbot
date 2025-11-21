import Prompt from '../models/Prompt.js';

/**
 * Get all prompt sections
 * GET /api/admin/prompts
 */
export async function getAllPrompts(req, res) {
  try {
    const prompts = await Prompt.getAll();
    res.json({ prompts });
  } catch (error) {
    console.error('Error getting prompts:', error);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
}

/**
 * Get single prompt by slug
 * GET /api/admin/prompts/:slug
 */
export async function getPromptBySlug(req, res) {
  try {
    const { slug } = req.params;
    const prompt = await Prompt.getBySlug(slug);
    res.json({ prompt });
  } catch (error) {
    console.error('Error getting prompt:', error);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
}

/**
 * Create new prompt section
 * POST /api/admin/prompts
 */
export async function createPrompt(req, res) {
  try {
    const { name, slug, description, content, is_active, display_order } = req.body;

    if (!name || !slug || !content) {
      return res.status(400).json({ error: 'Name, slug, and content are required' });
    }

    const prompt = await Prompt.create({
      name,
      slug,
      description,
      content,
      is_active: is_active !== undefined ? is_active : true,
      display_order: display_order || 0,
      last_edited_by: 'admin'
    });

    res.json({ prompt, message: 'Prompt section created successfully' });
  } catch (error) {
    console.error('Error creating prompt:', error);
    res.status(500).json({ error: 'Failed to create prompt' });
  }
}

/**
 * Update prompt section
 * PUT /api/admin/prompts/:id
 */
export async function updatePrompt(req, res) {
  try {
    const { id } = req.params;
    const updates = { ...req.body, last_edited_by: 'admin' };

    const prompt = await Prompt.update(id, updates);
    res.json({ prompt, message: 'Prompt updated successfully' });
  } catch (error) {
    console.error('Error updating prompt:', error);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
}

/**
 * Delete prompt section
 * DELETE /api/admin/prompts/:id
 */
export async function deletePrompt(req, res) {
  try {
    const { id } = req.params;
    await Prompt.delete(id);
    res.json({ message: 'Prompt deleted successfully' });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
}

/**
 * Get version history
 * GET /api/admin/prompts/:id/history
 */
export async function getPromptHistory(req, res) {
  try {
    const { id } = req.params;
    const history = await Prompt.getVersionHistory(id);
    res.json({ history });
  } catch (error) {
    console.error('Error getting prompt history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
}

/**
 * Preview compiled system prompt
 * GET /api/admin/prompts/preview
 */
export async function previewSystemPrompt(req, res) {
  try {
    const systemPrompt = await Prompt.buildSystemPrompt();
    const sections = await Prompt.getAllActive();

    res.json({
      systemPrompt,
      sections: sections.map(s => ({
        name: s.name,
        slug: s.slug,
        length: s.content.length,
        order: s.display_order
      })),
      totalLength: systemPrompt.length,
      sectionCount: sections.length
    });
  } catch (error) {
    console.error('Error previewing prompt:', error);
    res.status(500).json({ error: 'Failed to preview prompt' });
  }
}

export default {
  getAllPrompts,
  getPromptBySlug,
  createPrompt,
  updatePrompt,
  deletePrompt,
  getPromptHistory,
  previewSystemPrompt
};
