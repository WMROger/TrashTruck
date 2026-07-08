import ChatMessage from '@/components/ChatMessage';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { auth, db } from '@/config/firebase';
import { getN8nWebhookUrl } from '@/config/n8n';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    LogBox,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

// Suppress expo-notifications warning in Expo Go (not needed for AI chat functionality)
LogBox.ignoreLogs([
  'expo-notifications',
  'Android Push notifications',
  'Expo Go',
]);

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface AIChatModalProps {
  visible: boolean;
  onClose: () => void;
}

function isScheduleIntent(text: string): boolean {
  const t = text.toLowerCase();
  const keys = [
    'schedule', 'pickup', 'collection', 'when', 'time', 'date', 'next pickup', 'upcoming', 'today', 'tomorrow'
  ];
  return keys.some(k => t.includes(k));
}

async function buildSchedulesContextForUser(userId: string) {
  if (!db || !userId) return null;
  try {
    const toDateSafe = (val: any): Date | null => {
      try {
        if (!val) return null;
        // Firestore Timestamp
        if (typeof val?.toDate === 'function') return val.toDate();
        // { seconds, nanoseconds }
        if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000);
        // ISO/date-like string
        const asDate = new Date(val);
        if (!isNaN(asDate.getTime())) return asDate;
        return null;
      } catch {
        return null;
      }
    };

    const toIso = (d: Date | null): string | null => (d ? d.toISOString() : null);
    const toReadable = (d: Date | null, timeZone?: string): string | null => {
      if (!d) return null;
      try {
        const opts: Intl.DateTimeFormatOptions = {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        };
        return new Intl.DateTimeFormat(undefined, { ...opts, timeZone }).format(d);
      } catch {
        return d.toDateString();
      }
    };

    const ref = collection(db, 'schedules');
    const qy = query(
      ref,
      where('userId', '==', userId),
      limit(50)
    );
    const snap = await getDocs(qy);
    const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any[];
    // Sort client-side by createdAt desc if available
    items.sort((a: any, b: any) => {
      const ad = typeof a.createdAt?.toDate === 'function' ? a.createdAt.toDate() : new Date(a.createdAt);
      const bd = typeof b.createdAt?.toDate === 'function' ? b.createdAt.toDate() : new Date(b.createdAt);
      return (bd?.getTime?.() || 0) - (ad?.getTime?.() || 0);
    });

    // Create a compact summary to keep payload small
    const normalized = items.map((r) => ({
      id: r.id,
      status: r.status || 'pending',
      type: r.type || r.category || r.binType || 'general',
      address: r.address || r.location || undefined,
      // try multiple possible date fields
      dateIso: toIso(toDateSafe(r.date || r.pickupDate || r.scheduledDate || r.when)),
      createdAtIso: toIso(toDateSafe(r.createdAt)),
      displayDate: toReadable(toDateSafe(r.date || r.pickupDate || r.scheduledDate || r.when)),
      displayDateManila: toReadable(toDateSafe(r.date || r.pickupDate || r.scheduledDate || r.when), 'Asia/Manila'),
      window: r.timeWindow || r.window || undefined
    }));

    return {
      total: normalized.length,
      items: normalized.slice(0, 20)
    };
  } catch (e) {
    console.error('Failed to build schedules context:', e);
    return null;
  }
}

async function buildAnnouncementsContext(): Promise<any | null> {
  if (!db) return null;
  try {
    const ref = collection(db, 'announcements');
    const qy = query(ref, where('isPublished', '==', true), limit(10));
    const snap = await getDocs(qy);
    const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any[];
    // Sort client-side by createdAt desc
    items.sort((a: any, b: any) => {
      const ad = typeof a.createdAt?.toDate === 'function' ? a.createdAt.toDate() : new Date(a.createdAt);
      const bd = typeof b.createdAt?.toDate === 'function' ? b.createdAt.toDate() : new Date(b.createdAt);
      return (bd?.getTime?.() || 0) - (ad?.getTime?.() || 0);
    });
    const compact = items.map((a) => ({
      id: a.id,
      title: a.title || '',
      description: a.description || '',
      priority: a.priority || 'Medium',
      category: a.category || 'General',
      createdAtIso: (typeof a.createdAt?.toDate === 'function' ? a.createdAt.toDate() : new Date(a.createdAt))?.toISOString?.() || null,
    }));
    return { total: compact.length, items: compact };
  } catch (e) {
    console.error('Failed to build announcements context:', e);
    return null;
  }
}

async function buildNotificationsContext(userId: string): Promise<any | null> {
  if (!db || !userId) return null;
  try {
    const ref = collection(db, 'userNotifications');
    const qy = query(ref, where('userId', '==', userId), limit(20));
    const snap = await getDocs(qy);
    const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any[];
    // Sort client-side by createdAt desc
    items.sort((a: any, b: any) => {
      const ad = typeof a.createdAt?.toDate === 'function' ? a.createdAt.toDate() : new Date(a.createdAt);
      const bd = typeof b.createdAt?.toDate === 'function' ? b.createdAt.toDate() : new Date(b.createdAt);
      return (bd?.getTime?.() || 0) - (ad?.getTime?.() || 0);
    });
    const compact = items.map((n) => ({
      id: n.id,
      title: n.title || 'Notification',
      body: n.body || '',
      type: n.type || 'general',
      read: !!n.read,
      createdAtIso: (typeof n.createdAt?.toDate === 'function' ? n.createdAt.toDate() : new Date(n.createdAt))?.toISOString?.() || null,
    }));
    return { total: compact.length, items: compact };
  } catch (e) {
    console.error('Failed to build notifications context:', e);
    return null;
  }
}

async function buildProfileContext(userId: string): Promise<any | null> {
  if (!db || !userId) return null;
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return null;
    const u: any = snap.data();
    return {
      displayName: u.displayName || null,
      role: u.role || null,
      photoURL: u.photoURL || null,
    };
  } catch (e) {
    console.error('Failed to build profile context:', e);
    return null;
  }
}

async function buildPickupsContext(userId: string): Promise<any | null> {
  // Optional: best-effort from a likely collection name; ignore if missing
  if (!db || !userId) return null;
  try {
    const ref = collection(db, 'pickupHistory');
    const qy = query(ref, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(5));
    const snap = await getDocs(qy);
    const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any[];
    const compact = items.map((p) => ({
      id: p.id,
      status: p.status || 'completed',
      type: p.type || p.category || 'general',
      completedAtIso: (typeof p.createdAt?.toDate === 'function' ? p.createdAt.toDate() : new Date(p.createdAt))?.toISOString?.() || null,
    }));
    return { total: compact.length, items: compact };
  } catch {
    return null;
  }
}

// Call n8n webhook for AI processing
async function callN8nWebhook(query: string, options?: { context?: any; userId?: string }): Promise<string> {
  try {
    const webhookUrl = getN8nWebhookUrl();
    console.log('🔗 Calling n8n webhook:', webhookUrl);
    
    // Enhanced system prompt for TrashTrack app
    const systemPrompt = `You are an AI assistant for TrashTrack, a waste management app that helps users track and manage their waste efficiently. You are friendly, helpful, and knowledgeable about many topics, but you have a special focus on waste management, recycling, sustainability, and the TrashTrack app features.

🚨 CRITICAL INSTRUCTION: You have access to the user's actual data through the context object. You MUST use this data to provide personalized responses. Do NOT give generic responses like "I don't have access" or "I need more information". 

For the user's question about schedules, check context.schedules.items. If it's empty, say "I can see you don't have any pickup schedules assigned yet in TrashTrack. Schedules are set up by administrators and will appear in your Schedule tab when available." If it has data, list the actual schedules.

IMPORTANT: You have access to the user's actual data through the context. Use this data to provide personalized responses. Don't give generic advice when you have specific user data available.

CRITICAL: Always check the context data first:
- context.schedules.items - for pickup schedules
- context.announcements.items - for announcements  
- context.notifications.items - for notifications
- context.profile - for user information

If the data exists, use it. If it's empty, explain what that means in the context of TrashTrack.

MANDATORY: You MUST use the provided context data. Do NOT give generic responses about "I don't have access" or "I need more information". Use the actual data from the context or explain what empty data means in TrashTrack.

## TrashTrack App Features:

### Schedule Screen:
- Calendar view with color-coded waste categories
- Pickup dates, times, and locations
- Street/barangay information
- Collection frequencies: Daily, Weekly, Monthly, One-time

### Report Screen:
- Report uncollected trash or illegal dumping
- Upload photos of trash piles
- Specify location (Barangay, Street, Landmark)
- Currently serves Barangay Sambag 2

### Announcements Screen:
- View important updates from waste management team
- Categories: General, Schedule Change, Service Update, Emergency, Maintenance, Holiday Notice, Policy Update
- Priority levels: Low, Medium, High, Urgent
- Comment on announcements

### Home Screen:
- Dashboard with recent announcements
- Notification center
- Quick access to features

### Notifications:
- Pickup reminders
- Announcement alerts
- Pickup completion notifications

## Waste Categories in TrashTrack:
- 🟢 **Biodegradable**: Food waste, plant materials
- 🔵 **Non-Biodegradable**: Plastics, packaging
- 🟡 **Recyclable**: Paper, glass, metal
- ⚫ **Residual**: Mixed/non-recyclable waste
- 🔴 **Hazardous**: Batteries, chemicals
- 🟣 **Special/Bulk**: Large items, special collections

## Your Role:
- ALWAYS use the provided context data to give personalized, app-specific responses
- When users ask about schedules, check their actual schedule data from the context
- When users ask about announcements, reference their actual announcements from the context
- When users ask about notifications, reference their actual notifications from the context
- Be helpful and engaging with all topics, but subtly guide conversations toward TrashTrack and waste management
- When users ask about non-waste topics, provide brief helpful answers but gently mention how TrashTrack can help with waste management
- Reference actual TrashTrack features when relevant
- Provide general waste management tips that align with the app's waste categories
- Help users navigate and use the app (e.g., "Go to the Schedule tab to see your pickup dates")
- Mention the waste categories when discussing recycling/sorting tips
- Guide users on reporting trash, viewing schedules, checking announcements
- Use phrases like "Speaking of sustainability..." or "That reminds me of waste management..." to naturally transition topics

## Context Usage:
- If user asks about schedules and context.schedules.items is empty, explain that schedules are set by administrators and will appear when available
- If user asks about schedules and context.schedules.items has data, list their actual pickup schedules with dates, times, waste categories, and locations
- If user asks about announcements and context.announcements.items exists, reference their actual announcements with titles, descriptions, priorities, and categories
- If user asks about notifications and context.notifications.items exists, reference their actual notifications with titles, bodies, and types
- Always mention specific TrashTrack features that can help with their request
- Use the actual data from context instead of giving generic advice

## Example Responses:
- User: "Can you tell me the schedules for trash collecting?"
- If context.schedules.items is empty: "I can see you don't have any pickup schedules assigned yet in TrashTrack. Schedules are set up by administrators and will appear in your Schedule tab when available. You can check the Schedule tab to see if any new schedules have been added."
- If context.schedules.items has data: "Here are your current pickup schedules: [list actual schedules from context with dates, times, waste categories, and locations]"

- User: "What announcements do I have?"
- Reference context.announcements.items: "You have [X] announcements. Here are the latest: [list actual announcements with titles, descriptions, priorities, and categories]"

- User: "What notifications do I have?"
- Reference context.notifications.items: "You have [X] notifications. Here are the latest: [list actual notifications with titles, bodies, and types]"

## SPECIFIC INSTRUCTION FOR SCHEDULE QUESTIONS:
When user asks "Can you tell me the schedules for trash collecting?" or similar:
1. Check context.schedules.items
2. If empty: "I can see you don't have any pickup schedules assigned yet in TrashTrack. Schedules are set up by administrators and will appear in your Schedule tab when available."
3. If has data: List the actual schedules with details
4. NEVER say "I don't have access" or "I need more information"

## Conversation Style:
- Be warm, friendly, and conversational
- Answer questions helpfully, but look for opportunities to mention TrashTrack features
- Use subtle transitions like "By the way, did you know TrashTrack can help with..." or "Speaking of [topic], TrashTrack has features for..."
- Never be pushy or overly promotional
- Make connections between user interests and waste management naturally

## Guardrails:
1) Never provide advice about illegal, dangerous, or harmful waste disposal methods
2) Always promote safe, legal, and environmentally-friendly practices
3) Focus on positive environmental impact and sustainability
4) If asked about inappropriate topics, redirect to waste management and TrashTrack features
5) Always encourage users to explore TrashTrack features when relevant`;

    const requestBody = {
      messageInput: query,
      timestamp: new Date().toISOString(),
      source: 'TrashTrack App',
      userId: options?.userId || null,
      context: options?.context || null,
      systemPrompt: systemPrompt
    };
    
    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));
    
    // Add a timeout to avoid long hangs
    const controller = new AbortController();
    const timeoutMs = 15000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: (controller as any).signal,
    });
    clearTimeout(timer);

    console.log('📥 n8n response status:', response.status);
    console.log('📥 n8n response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ n8n error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    // Read as text first, then try JSON parse with fallback to raw string
    const raw = await response.text();
    let data: any = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { reply: (raw || '').trim() };
    }
    try {
      console.log('✅ n8n response data:', JSON.stringify(data, null, 2));
    } catch {}
    
    // Persist suggested location if provided by backend and user is known
    try {
      const userId = options?.userId;
      const locationCandidate = data?.suggestedLocation || data?.location || data?.address || data?.meta?.suggestedLocation || data?.context?.selectedLocation;
      if (db && userId && typeof locationCandidate === 'string' && locationCandidate.trim().length > 0) {
        const settingsRef = doc(db, 'user_settings', userId);
        await setDoc(settingsRef, {
          preferredLocation: locationCandidate.trim(),
          preferredLocationUpdatedAt: serverTimestamp(),
        }, { merge: true });
        console.log('💾 Saved preferredLocation for user_settings:', userId, locationCandidate);
      }
    } catch (persistErr) {
      console.warn('Could not persist suggested location:', persistErr);
    }

    // Handle different possible response formats
    let aiResponse = data.reply || data.response || data.answer || data.message || data.output || data.text || data.content || 'Sorry, I couldn\'t process your request.';
    
    // Check if the response contains the literal expression (n8n webhook issue)
    if (aiResponse === '{{$json.output}}' || aiResponse.includes('{{$json.output}}') || aiResponse === '{{ $json.output }}' || aiResponse.includes('{{ $json.output }}')) {
      console.warn('⚠️ Received literal expression from webhook, trying to extract actual content');
      console.log('🔍 Full response data:', JSON.stringify(data, null, 2));
      
      // Try to get the actual content from various possible fields
      if (data.output && typeof data.output === 'string' && data.output !== '{{$json.output}}' && data.output !== '{{ $json.output }}') {
        aiResponse = data.output;
        console.log('✅ Extracted actual content from data.output');
      } else if (data.response && typeof data.response === 'string' && data.response !== '{{$json.output}}' && data.response !== '{{ $json.output }}') {
        aiResponse = data.response;
        console.log('✅ Extracted actual content from data.response');
      } else if (data.answer && typeof data.answer === 'string' && data.answer !== '{{$json.output}}' && data.answer !== '{{ $json.output }}') {
        aiResponse = data.answer;
        console.log('✅ Extracted actual content from data.answer');
      } else if (data.message && typeof data.message === 'string' && data.message !== '{{$json.output}}' && data.message !== '{{ $json.output }}') {
        aiResponse = data.message;
        console.log('✅ Extracted actual content from data.message');
      } else if (data.text && typeof data.text === 'string' && data.text !== '{{$json.output}}' && data.text !== '{{ $json.output }}') {
        aiResponse = data.text;
        console.log('✅ Extracted actual content from data.text');
      } else if (data.content && typeof data.content === 'string' && data.content !== '{{$json.output}}' && data.content !== '{{ $json.output }}') {
        aiResponse = data.content;
        console.log('✅ Extracted actual content from data.content');
      } else {
        // Try to find any string field that's not the literal expression
        const findValidString = (obj: any, path: string = ''): string | null => {
          if (typeof obj === 'string' && obj !== '{{$json.output}}' && obj !== '{{ $json.output }}' && obj.length > 10) {
            return obj;
          }
          if (typeof obj === 'object' && obj !== null) {
            for (const key in obj) {
              const result = findValidString(obj[key], `${path}.${key}`);
              if (result) return result;
            }
          }
          return null;
        };
        
        const validString = findValidString(data);
        if (validString) {
          aiResponse = validString;
          console.log('✅ Found valid string content:', validString.substring(0, 100) + '...');
        } else {
          // Enhanced fallback with more helpful message
          aiResponse = 'I apologize, but I\'m experiencing a technical issue with my response system. This appears to be a configuration problem with the AI service. Please try asking your question again, or contact support if the issue persists.';
          console.error('❌ Could not extract actual content from webhook response. Available fields:', Object.keys(data));
        }
      }
    }
    
    // Check if the response is still JSON (common n8n issue)
    if (typeof aiResponse === 'object' && aiResponse !== null) {
      console.warn('⚠️ Response is still an object, trying to extract text content');
      // Try to find text content in nested objects
      const findTextContent = (obj: any): string | null => {
        if (typeof obj === 'string') return obj;
        if (typeof obj === 'object' && obj !== null) {
          // Check common AI response fields
          const textFields = ['text', 'content', 'message', 'response', 'answer', 'output', 'reply'];
          for (const field of textFields) {
            if (obj[field] && typeof obj[field] === 'string') {
              return obj[field];
            }
          }
          // Recursively search nested objects
          for (const key in obj) {
            const result = findTextContent(obj[key]);
            if (result) return result;
          }
        }
        return null;
      };
      
      const textContent = findTextContent(aiResponse);
      if (textContent) {
        aiResponse = textContent;
        console.log('✅ Extracted text content from nested object');
      } else {
        aiResponse = 'I apologize, but I\'m experiencing a technical issue with my response system. The AI service returned an unexpected format. Please try asking your question again.';
        console.error('❌ Could not extract text content from object response:', aiResponse);
      }
    }
    
    // Final check for the specific literal expression that's appearing
    if (aiResponse === '{{ $json.output }}' || aiResponse === '{{$json.output}}') {
      console.warn('⚠️ Final response is still the literal expression, providing fallback');
      aiResponse = 'I apologize, but I\'m experiencing a technical issue with my response system. The AI service is not returning the expected format. Please try asking your question again, or contact support if the issue persists.';
    }
    
    // Ensure the response is a string
    if (typeof aiResponse !== 'string') {
      console.warn('⚠️ Final response is not a string, converting:', typeof aiResponse);
      aiResponse = String(aiResponse);
    }
    
    // Clean the response by removing <think> tags and other internal processing
    aiResponse = cleanAiResponse(aiResponse);
    
    // Add guardrails for trash-related content
    aiResponse = applyGuardrails(aiResponse, query);
    
    return aiResponse;
  } catch (error) {
    console.error('❌ n8n webhook error:', error);
    throw error;
  }
}

function cleanAiResponse(response: string): string {
  // Remove <think> tags and their content
  response = response.replace(/<think>.*?<\/think>/gs, '');
  
  // Remove any remaining XML-like tags
  response = response.replace(/<[^>]*>/g, '');
  
  // Clean up extra whitespace
  response = response.replace(/\n\s*\n/g, '\n').trim();
  
  return response;
}

// Enhanced domain filter that allows general topics but encourages waste-related discussions
function isTrashRelatedQuery(query: string): boolean {
  const q = query.toLowerCase();
  
  // Always allow these general conversation starters
  const generalTerms = [
    'hello', 'hi', 'hey', 'how are you', 'what', 'who', 'when', 'where', 'why', 'how',
    'help', 'thanks', 'thank you', 'please', 'can you', 'could you', 'would you',
    'tell me', 'explain', 'describe', 'show me', 'give me', 'i need', 'i want',
    'weather', 'time', 'date', 'today', 'tomorrow', 'yesterday', 'week', 'month',
    'food', 'cooking', 'recipe', 'health', 'exercise', 'work', 'school', 'study',
    'travel', 'vacation', 'hobby', 'music', 'movie', 'book', 'game', 'sport',
    'family', 'friend', 'love', 'happy', 'sad', 'tired', 'busy', 'free'
  ];
  
  // Waste management and app-specific terms (higher priority)
  const wasteTerms = [
    'trash','waste','recycle','recycling','compost','garbage','bin','landfill','plastic','paper','glass','metal',
    'e-waste','organic','hazardous','disposal','segregation','collection','pickup','schedule','litter','pollution',
    'sustainability','environment','eco','composting','reuse','reduce','sorting','incineration','municipal',
    'trashtrack','trash track','app','driver','route','dump','junk','debris','scrap','rubbish','refuse',
    'schedule','report','announcement','notification','pickup','barangay','sambag',
    'biodegradable','non-biodegradable','recyclable','residual','special','bulk',
    'upload','photo','image','location','street','landmark','comment','filter',
    'reminder','alert','update','change','maintenance','emergency','holiday','policy'
  ];
  
  // Allow general conversation but give priority to waste-related topics
  return generalTerms.some(k => q.includes(k)) || wasteTerms.some(k => q.includes(k));
}

function applyGuardrails(response: string, originalQuery: string): string {
  // Basic content filtering for inappropriate responses
  const inappropriateKeywords = ['illegal', 'dangerous', 'harmful', 'toxic'];
  const hasInappropriateContent = inappropriateKeywords.some(keyword => 
    response.toLowerCase().includes(keyword)
  );
  
  if (hasInappropriateContent) {
    return 'I apologize, but I cannot provide advice about that. Please focus on safe and legal waste management practices. How can I help you with proper waste disposal and recycling?';
  }
  
  // Check if the query is clearly off-topic and needs gentle redirection
  const isOffTopic = !isTrashRelatedQuery(originalQuery);
  
  if (isOffTopic) {
    // Don't block the response, but let the AI handle it with the new system prompt
    // The AI will now provide helpful answers while subtly mentioning TrashTrack
    return response;
  }

  return response;
}

export default function AIChatModal({ visible, onClose }: AIChatModalProps) {
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      text: 'Hello! I\'m your AI assistant for TrashTrack. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = () => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const keyboardDidShow = () => {
      setTimeout(scrollToBottom, 100);
    };

    const keyboardDidHide = () => {
      setTimeout(scrollToBottom, 100);
    };

    const showSubscription = Keyboard.addListener('keyboardDidShow', keyboardDidShow);
    const hideSubscription = Keyboard.addListener('keyboardDidHide', keyboardDidHide);

    return () => {
      showSubscription?.remove();
      hideSubscription?.remove();
    };
  }, []);

  // Add escape key handling for web
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (event: any) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (Platform.OS === 'web') {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [visible, onClose]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // Front-end domain check before sending to backend/webhook
    if (!isTrashRelatedQuery(input.trim())) {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: 'I’m specialized in TrashTrack and waste-related topics (recycling, disposal, composting, pickup schedules). Ask me something in that area.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: input.trim(), timestamp: new Date() }, aiMessage]);
      setInput('');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      console.log('🚀 Using n8n webhook for AI response');
      const userId = auth?.currentUser?.uid || null;
      // Build expanded context (profile, announcements, schedules, notifications, pickups, theme)
      let context: any = null;
      if (userId) {
        const [profile, announcements, schedules, notifications, pickups] = await Promise.all([
          buildProfileContext(userId),
          buildAnnouncementsContext(),
          buildSchedulesContextForUser(userId),
          buildNotificationsContext(userId),
          buildPickupsContext(userId),
        ]);
        context = { profile, announcements, schedules, notifications, pickups };
      }
      // Include app/theme metadata and client timezone
      const clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      context = {
        ...(context || {}),
        app: { 
          name: 'TrashTrack', 
          platform: Platform.OS,
          features: {
            schedule: {
              description: 'Calendar view with color-coded waste categories',
              wasteCategories: {
                'Biodegradable': { color: '#22C55E', description: 'Food waste, plant materials' },
                'Non-Biodegradable': { color: '#2563EB', description: 'Plastics, packaging' },
                'Recyclable': { color: '#EAB308', description: 'Paper, glass, metal' },
                'Residual': { color: '#6B7280', description: 'Mixed/non-recyclable waste' },
                'Hazardous': { color: '#EF4444', description: 'Batteries, chemicals' },
                'Special/Bulk': { color: '#A855F7', description: 'Large items, special collections' }
              },
              frequencies: ['Daily', 'Weekly', 'Monthly', 'One-time']
            },
            report: {
              description: 'Report uncollected trash or illegal dumping',
              features: ['Photo upload', 'Location specification', 'Barangay selection'],
              currentBarangay: 'Sambag 2'
            },
            announcements: {
              description: 'View important updates from waste management team',
              categories: ['General', 'Schedule Change', 'Service Update', 'Emergency', 'Maintenance', 'Holiday Notice', 'Policy Update'],
              priorities: ['Low', 'Medium', 'High', 'Urgent'],
              features: ['Comments', 'Filtering']
            },
            notifications: {
              types: ['Pickup reminders', 'Announcement alerts', 'Pickup completion notifications']
            }
          },
          screens: {
            home: 'Dashboard with recent announcements and notifications',
            schedule: 'Calendar view with pickup dates and waste categories',
            report: 'Report uncollected trash with photo upload',
            announcements: 'View and comment on important updates'
          }
        },
        ui: { theme },
        clientTimeZone,
      };
      const aiResponse = await callN8nWebhook(userMessage.text, { context, userId });
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: aiResponse,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);

      // Persist lightweight continuity to user_settings
      try {
        if (db && userId) {
          const settingsRef = doc(db, 'user_settings', userId);
          const existing = await getDoc(settingsRef);
          const prevHistory: any[] = Array.isArray(existing.data()?.chatHistory) ? existing.data()!.chatHistory : [];
          // Firestore doesn't support serverTimestamp inside array values; use client ISO time for entries
          const nowIso = new Date().toISOString();
          const newEntry = { tIso: nowIso, q: userMessage.text, a: aiResponse };
          const trimmed = [...prevHistory, newEntry].slice(-30);
          await setDoc(settingsRef, {
            lastPrompt: userMessage.text,
            lastReply: aiResponse,
            lastSeenAt: serverTimestamp(),
            chatHistory: trimmed,
          }, { merge: true });
        }
      } catch (persistErr) {
        console.warn('Continuity persistence failed:', persistErr);
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <ChatMessage message={item} />
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      transparent={Platform.OS === 'web'}
    >
      {Platform.OS === 'web' ? (
        // Web version with click-outside-to-close
        <Pressable onPress={onClose} style={styles.webOverlay}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <View style={[styles.webContainer, { backgroundColor: colors.background }]}>
                <View style={[styles.container, { backgroundColor: colors.background }]}>
                  <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                      TrashTrack AI Assistant
                    </Text>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                      <Ionicons name="close" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    style={styles.messagesList}
                    contentContainerStyle={styles.messagesContainer}
                    showsVerticalScrollIndicator={false}
                  />

                  {isLoading && (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                        AI is thinking...
                      </Text>
                    </View>
                  )}

                  <KeyboardAvoidingView
                    behavior={'position'}
                    keyboardVerticalOffset={0}
                    style={[styles.inputContainer, { borderTopColor: colors.border }]}
                  >
                    <View style={[styles.inputWrapper, { borderColor: colors.border }]}>
                      <TextInput
                        style={[styles.input, { color: colors.textPrimary }]}
                        value={input}
                        onChangeText={setInput}
                        placeholder="Ask me about waste management..."
                        placeholderTextColor={colors.textTertiary}
                        multiline
                        maxLength={500}
                        onSubmitEditing={sendMessage}
                      />
                      <TouchableOpacity
                        style={[styles.sendButton, { backgroundColor: colors.primary }]}
                        onPress={sendMessage}
                        disabled={!input.trim() || isLoading}
                      >
                        <IconSymbol 
                          name="paperplane.fill" 
                          size={20} 
                          color={colors.surface} 
                        />
                      </TouchableOpacity>
                    </View>
                  </KeyboardAvoidingView>
                </View>
            </View>
          </Pressable>
        </Pressable>
      ) : (
        // Native version
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              TrashTrack AI Assistant
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContainer}
            showsVerticalScrollIndicator={false}
          />

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                AI is thinking...
              </Text>
            </View>
          )}

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 55 : 0}
            style={[styles.inputContainer, { borderTopColor: colors.border }]}
          >
            <View style={[styles.inputWrapper, { borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                value={input}
                onChangeText={setInput}
                placeholder="Ask me about waste management..."
                placeholderTextColor={colors.textTertiary}
                multiline
                maxLength={500}
                onSubmitEditing={sendMessage}
              />
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: colors.primary }]}
                onPress={sendMessage}
                disabled={!input.trim() || isLoading}
              >
                <IconSymbol 
                  name="paperplane.fill" 
                  size={20} 
                  color={colors.surface} 
                />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    bottom: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  // Web-specific styles
  webOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  webContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
});
