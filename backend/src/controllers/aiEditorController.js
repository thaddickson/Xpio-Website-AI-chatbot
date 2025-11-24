import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * AI Prompt Editor - Helps improve prompts based on feedback
 * POST /api/admin/ai-editor/improve
 */
export async function improvePrompt(req, res) {
  try {
    const { currentPrompt, feedback, promptType } = req.body;

    if (!currentPrompt || !feedback) {
      return res.status(400).json({
        error: 'currentPrompt and feedback are required'
      });
    }

    // Build the improvement request
    const systemPrompt = `You are an expert prompt engineer specializing in chatbot system prompts. Your job is to analyze and improve prompts based on user feedback.

When improving prompts:
1. Keep the core intent and structure
2. Address the specific feedback provided
3. Make surgical improvements - don't rewrite everything
4. Maintain existing formatting and sections
5. Be concise and clear
6. Explain what you changed and why

Output format:
1. First, provide the IMPROVED PROMPT in full
2. Then explain your changes in a separate section`;

    const userPrompt = `Current Prompt:
---
${currentPrompt}
---

User Feedback: "${feedback}"

Type: ${promptType || 'general'}

Please improve this prompt to address the feedback. Provide:
1. The complete improved prompt
2. A brief explanation of what you changed and why

Use this exact format:

IMPROVED PROMPT:
[full improved prompt here]

CHANGES MADE:
- Change 1 explanation
- Change 2 explanation
- etc.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: userPrompt
      }]
    });

    const content = response.content[0].text;

    // Parse the response to separate improved prompt from explanation
    const improvedPromptMatch = content.match(/IMPROVED PROMPT:\s*([\s\S]*?)\s*CHANGES MADE:/);
    const changesMatch = content.match(/CHANGES MADE:\s*([\s\S]*?)$/);

    const improvedPrompt = improvedPromptMatch ? improvedPromptMatch[1].trim() : content;
    const explanation = changesMatch ? changesMatch[1].trim() : 'See improved prompt above';

    res.json({
      improvedPrompt,
      explanation,
      originalPrompt: currentPrompt,
      feedback
    });

  } catch (error) {
    console.error('Error improving prompt:', error);
    res.status(500).json({
      error: 'Failed to improve prompt',
      message: error.message
    });
  }
}

/**
 * Quick prompt analysis - Get suggestions without full improvement
 * POST /api/admin/ai-editor/analyze
 */
export async function analyzePrompt(req, res) {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: `Analyze this chatbot prompt and provide brief feedback on potential issues or improvements:

${prompt}

Provide 3-5 specific, actionable suggestions.`
      }]
    });

    res.json({
      suggestions: response.content[0].text
    });

  } catch (error) {
    console.error('Error analyzing prompt:', error);
    res.status(500).json({
      error: 'Failed to analyze prompt',
      message: error.message
    });
  }
}

/**
 * Generate prompt from description
 * POST /api/admin/ai-editor/generate
 */
export async function generatePrompt(req, res) {
  try {
    const { description, promptType, existingContext } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    const systemPrompt = `You are an expert prompt engineer. Create clear, effective system prompts for chatbots based on user requirements.`;

    const userPrompt = `Create a ${promptType || 'chatbot'} system prompt based on this description:

"${description}"

${existingContext ? `\nExisting context to maintain consistency with:\n${existingContext}` : ''}

Requirements:
- Clear and specific instructions
- Concise but complete
- Easy to understand
- Follows best practices for AI prompts

Provide only the prompt, no extra explanation.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.8,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: userPrompt
      }]
    });

    res.json({
      generatedPrompt: response.content[0].text
    });

  } catch (error) {
    console.error('Error generating prompt:', error);
    res.status(500).json({
      error: 'Failed to generate prompt',
      message: error.message
    });
  }
}

export default {
  improvePrompt,
  analyzePrompt,
  generatePrompt
};
