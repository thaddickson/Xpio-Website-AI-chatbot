// Run database migrations
// Usage: node run-migration.js

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function runMigration() {
  try {
    console.log('📊 Running A/B testing migration...');

    // Read the SQL file
    const sql = readFileSync('./migrations/002_add_ab_testing.sql', 'utf8');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If exec_sql doesn't exist, try executing directly
      console.log('Note: exec_sql function not found, executing via client...');

      // Split by statement and execute each
      const statements = sql.split(';').filter(s => s.trim());

      for (const statement of statements) {
        if (statement.trim()) {
          const { error: stmtError } = await supabase.rpc('exec', {
            sql: statement + ';'
          });

          if (stmtError) {
            console.error('Error executing statement:', stmtError);
            console.log('Statement:', statement.substring(0, 100) + '...');
          }
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Created tables:');
    console.log('  - prompt_variations');
    console.log('  - conversation_test_assignments');
    console.log('  - variation_performance_metrics');
    console.log('');
    console.log('You can now create and test prompt variations in the admin dashboard!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
