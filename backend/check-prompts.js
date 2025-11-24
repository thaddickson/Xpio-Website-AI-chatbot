import dotenv from 'dotenv';
import Prompt from './src/models/Prompt.js';

dotenv.config();

async function checkPrompts() {
  try {
    console.log('Fetching all active prompts from database...\n');

    const sections = await Prompt.getAllActive();

    console.log(`Found ${sections.length} active prompt sections:\n`);

    sections.forEach((section, index) => {
      console.log(`${index + 1}. ${section.name} (${section.slug})`);
      console.log(`   Order: ${section.display_order}`);
      console.log(`   Length: ${section.content.length} characters`);
      console.log(`   Active: ${section.is_active}`);
      console.log(`   Last edited by: ${section.last_edited_by || 'unknown'}`);
      console.log('');
    });

    console.log('\n=== FULL COMPILED PROMPT ===\n');
    const fullPrompt = await Prompt.buildSystemPrompt();
    console.log(fullPrompt);

  } catch (error) {
    console.error('Error:', error);
  }
}

checkPrompts();
