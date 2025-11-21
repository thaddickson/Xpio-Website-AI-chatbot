-- Import your existing hardcoded prompt as a single section
-- Run this AFTER running prompts-schema-fixed.sql

INSERT INTO prompt_sections (name, slug, content, is_active, display_order)
SELECT
  'Main System Prompt',
  'main-system-prompt',
  'PASTE_YOUR_ENTIRE_PROMPT_HERE',
  TRUE,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_sections WHERE slug = 'main-system-prompt'
);
