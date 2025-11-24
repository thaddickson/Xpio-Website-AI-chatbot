const fs = require('fs');

const content = fs.readFileSync('new-prompt.txt', 'utf8');

const data = {
  content: content,
  name: 'Main System Prompt',
  description: 'Optimized conversation-focused prompt'
};

fetch('https://xpio-website-ai-chatbot-production.up.railway.app/api/admin/prompts/bc726f4d-1ad0-4ae0-895b-06bbe5acfc0c', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
.then(res => res.json())
.then(data => {
  console.log('✅ Prompt updated successfully!');
  console.log('New version:', data.prompt.version);
})
.catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
