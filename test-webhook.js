// Simple test script for n8n webhook
const fetch = require('node-fetch');

async function testWebhook() {
  const webhookUrl = 'https://vijay123eniola123.app.n8n.cloud/webhook/a8735df2-a775-4ac0-b57f-6182ba0fedff';
  
  const requestBody = {
    messageInput: 'Test message from Node.js script',
    timestamp: new Date().toISOString(),
    source: 'Test Script'
  };

  console.log('🔗 Testing webhook:', webhookUrl);
  console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ Response data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
testWebhook(); 