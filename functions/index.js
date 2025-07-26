const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// Sample documents for RAG (you can replace this with your own documents)
const sampleDocuments = [
  {
    id: 'doc1',
    content: 'TrashTrack is a waste management app that helps users track and manage their waste efficiently. The app provides tools for monitoring waste generation, setting recycling goals, and learning about sustainable practices.',
    keywords: ['waste', 'management', 'tracking', 'recycling', 'sustainability']
  },
  {
    id: 'doc2',
    content: 'The app features include: waste categorization, recycling tips, progress tracking, community challenges, and educational content about environmental impact.',
    keywords: ['features', 'categorization', 'tips', 'progress', 'community', 'education']
  },
  {
    id: 'doc3',
    content: 'Users can set personal waste reduction goals, track their daily waste generation, and receive personalized recommendations for improving their environmental footprint.',
    keywords: ['goals', 'tracking', 'recommendations', 'environmental', 'footprint']
  },
  {
    id: 'doc4',
    content: 'The app integrates with local recycling programs and provides information about proper waste disposal methods for different types of materials.',
    keywords: ['recycling', 'programs', 'disposal', 'materials', 'local']
  }
];

// Simple keyword-based document retrieval
function getRelevantDocs(query) {
  const queryLower = query.toLowerCase();
  const relevantDocs = sampleDocuments.filter(doc => {
    return doc.keywords.some(keyword => 
      queryLower.includes(keyword.toLowerCase())
    ) || doc.content.toLowerCase().includes(queryLower);
  });
  
  // Return top 2 most relevant documents
  return relevantDocs.slice(0, 2);
}

exports.chatWithRAG = functions.https.onCall(async (data, context) => {
  try {
    const { query } = data;
    
    if (!query) {
      throw new functions.https.HttpsError('invalid-argument', 'Query is required');
    }

    // Step 1: Retrieve relevant documents
    const relevantDocs = getRelevantDocs(query);
    
    // Step 2: Format context from documents
    const context = relevantDocs.length > 0 
      ? relevantDocs.map(doc => doc.content).join('\n\n')
      : 'No specific information available about this topic.';

    // Step 3: Create prompt for Groq API
    const prompt = `You are a helpful AI assistant for TrashTrack, a waste management app. Use the following context to answer the user's question. If the context doesn't contain relevant information, provide a general helpful response about waste management and sustainability.

Context:
${context}

User Question: ${query}

Please provide a helpful and informative response:`;

    // Step 4: Call Groq API (you'll need to add your GROQ_API_KEY to Firebase Functions config)
    const groqApiKey = functions.config().groq?.key;
    
    if (!groqApiKey) {
      // Fallback response if Groq API key is not configured
      return {
        reply: `I understand you're asking about: "${query}". While I'm still being configured with advanced AI capabilities, I can help you with general waste management questions. For specific features of TrashTrack, please check the app's help section or contact support.`
      };
    }

    const groqResponse = await fetch('https://api.groq.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: "You are a helpful AI assistant for TrashTrack, a waste management app. Provide informative and friendly responses about waste management, recycling, and sustainability."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!groqResponse.ok) {
      throw new Error(`Groq API error: ${groqResponse.status}`);
    }

    const groqResult = await groqResponse.json();
    const aiReply = groqResult.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';

    // Step 5: Log the interaction (optional)
    await db.collection('chat_logs').add({
      query,
      context: relevantDocs.map(doc => doc.id),
      reply: aiReply,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      reply: aiReply
    };

  } catch (error) {
    console.error('Error in chatWithRAG:', error);
    throw new functions.https.HttpsError('internal', 'Failed to process chat request');
  }
});

// Optional: Function to add documents to the knowledge base
exports.addDocument = functions.https.onCall(async (data, context) => {
  try {
    const { content, keywords } = data;
    
    if (!content) {
      throw new functions.https.HttpsError('invalid-argument', 'Content is required');
    }

    const docRef = await db.collection('documents').add({
      content,
      keywords: keywords || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      id: docRef.id,
      message: 'Document added successfully'
    };

  } catch (error) {
    console.error('Error adding document:', error);
    throw new functions.https.HttpsError('internal', 'Failed to add document');
  }
}); 