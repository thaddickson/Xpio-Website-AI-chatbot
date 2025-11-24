const fs = require('fs');

const newContent = fs.readFileSync('new-prompt.txt', 'utf8');

const requestBody = JSON.stringify({
  content: newContent
});

fetch('https://xpio-website-ai-chatbot-production.up.railway.app/api/admin/prompts/bc726f4d-1ad0-4ae0-895b-06bbe5acfc0c', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json'
  },
  body: requestBody
})
.then(async res => {
  const text = await res.text();
  console.log('Response:', text);
  try {
    const json = JSON.parse(text);
    console.log('\n✅ SUCCESS! Prompt updated to version:', json.prompt?.version || 'unknown');
    console.log('Content length:', json.prompt?.content?.length || 0, 'characters');
  } catch (e) {
    console.log('Could not parse JSON response');
  }
})
.catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
