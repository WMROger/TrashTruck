// Test script for Docker n8n webhook
const fetch = require('node-fetch');

// Common Docker n8n webhook URL patterns
const possibleUrls = [
  'http://localhost:5678/webhook/test',
  'http://localhost:5678/webhook/webhook-test',
  'http://localhost:5678/webhook/chat',
  'http://localhost:5678/webhook/trashtrack',
  'http://127.0.0.1:5678/webhook/test',
  'http://127.0.0.1:5678/webhook/webhook-test',
  'http://127.0.0.1:5678/webhook/chat',
  'http://127.0.0.1:5678/webhook/trashtrack'
];

async function testWebhook(url) {
  const requestBody = {
    messageInput: 'Test message from Docker setup',
    timestamp: new Date().toISOString(),
    source: 'Docker Test'
  };

  console.log(`🔗 Testing: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`📥 Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Success! Response: ${JSON.stringify(data, null, 2)}`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`❌ Error: ${errorText}`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    return false;
  }
}

async function findWorkingWebhook() {
  console.log('🔍 Searching for working Docker n8n webhook...\n');
  
  for (const url of possibleUrls) {
    const success = await testWebhook(url);
    if (success) {
      console.log(`\n🎉 Found working webhook: ${url}`);
      console.log(`\n📝 Update your config/n8n.ts file with:`);
      console.log(`WEBHOOK_URL: '${url}'`);
      return url;
    }
    console.log(''); // Empty line for readability
  }
  
  console.log('\n❌ No working webhook found.');
  console.log('\n📋 Manual steps:');
  console.log('1. Open your Docker n8n instance at http://localhost:5678');
  console.log('2. Go to your workflow and find the webhook node');
  console.log('3. Copy the webhook URL from the node settings');
  console.log('4. Update config/n8n.ts with the correct URL');
}

// Run the test
findWorkingWebhook().catch(console.error); 