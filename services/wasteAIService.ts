/**
 * Waste AI Analysis Service
 * Uses Google Gemini Vision API to analyze waste images
 * and detect waste type + estimated weight.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

export interface WasteAnalysisResult {
  wasteType: string;
  estimatedWeight: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  details: string;
}

const FALLBACK_RESULT: WasteAnalysisResult = {
  wasteType: 'Unable to determine',
  estimatedWeight: '—',
  confidence: 'none',
  details: 'Could not analyze the image. Please ensure the waste is clearly visible.',
};

const NOT_TRASH_RESULT: WasteAnalysisResult = {
  wasteType: 'Not waste',
  estimatedWeight: '—',
  confidence: 'none',
  details: 'This image does not appear to contain waste or trash. Please take a photo of the waste you want to report.',
};

/**
 * Convert a local image URI to a base64 string.
 * Works on both native (Expo FileSystem) and web (fetch + blob).
 */
async function imageUriToBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
  if (Platform.OS === 'web') {
    // Web: fetch the blob and convert
    const response = await fetch(uri);
    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        // Strip the data:mime;base64, prefix
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    // Native: use expo-file-system
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64' as any,
    });
    // Detect mime type from extension
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const mimeType = mimeMap[ext] || 'image/jpeg';
    return { base64, mimeType };
  }
}

/**
 * Quick guardrail check: Is this image trash/waste related?
 * Uses a lightweight prompt to quickly reject non-trash images
 * before running the full expensive analysis.
 */
async function isTrashRelatedImage(
  model: any,
  mimeType: string,
  base64: string
): Promise<{ isTrash: boolean; reason: string }> {
  try {
    console.log('🛡️ Running guardrail check...');

    const guardrailPrompt = `Look at this image and answer with ONLY "YES" or "NO" followed by a short reason.

Is this image related to waste, trash, garbage, litter, recycling, or any discarded materials? 
This includes: trash bags, bins, dumpsters, piles of waste, single pieces of litter, food waste, recyclables, broken items, etc.

Format: YES|NO - reason
Example: YES - shows a pile of plastic bottles
Example: NO - this is a selfie of a person`;

    const result = await model.generateContent([
      guardrailPrompt,
      {
        inlineData: {
          mimeType: mimeType,
          data: base64,
        },
      },
    ]);

    const text = result.response.text().trim();
    console.log('🛡️ Guardrail response:', text);

    const isTrash = text.toUpperCase().startsWith('YES');
    const reason = text.replace(/^(YES|NO)\s*[-–—:.]?\s*/i, '').trim();

    return { isTrash, reason };
  } catch (error) {
    // If the guardrail itself fails, let the image through
    // (better to attempt analysis than block a valid image)
    console.warn('⚠️ Guardrail check failed, allowing image through:', error);
    return { isTrash: true, reason: 'Guardrail check failed, proceeding with analysis.' };
  }
}

/**
 * Check if an error is a rate limit / high demand error.
 */
function isRateLimitError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  const statusCode = error?.status || error?.statusCode || 0;
  return (
    statusCode === 429 ||
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('quota') ||
    message.includes('resource exhausted') ||
    message.includes('too many requests') ||
    message.includes('overloaded') ||
    message.includes('high demand') ||
    message.includes('capacity')
  );
}

/**
 * Analyze a waste image using Gemini Vision API.
 * Returns the detected waste type and estimated weight.
 * @param imageUri The local URI of the image
 * @param precomputedBase64 Optional pre-computed base64 string (from ImagePicker) to avoid using FileSystem
 */
export async function analyzeWasteImage(imageUri: string, precomputedBase64?: string | null): Promise<WasteAnalysisResult> {
  try {
    console.log('🤖 Starting AI waste analysis...');

    // Check API key
    if (!GEMINI_API_KEY) {
      console.error('❌ Gemini API key is not set');
      return {
        ...FALLBACK_RESULT,
        details: 'Gemini API key is not set. Please restart the Expo server (npx expo start -c) to load the .env file.',
      };
    }

    // Use pre-computed base64 if available, otherwise fallback to reading the file
    let base64 = precomputedBase64;
    let mimeType = 'image/jpeg';
    
    // Detect mime type from extension
    const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    mimeType = mimeMap[ext] || 'image/jpeg';

    if (!base64) {
      console.log('⚠️ No pre-computed base64 provided, attempting to convert URI...');
      const converted = await imageUriToBase64(imageUri);
      base64 = converted.base64;
      mimeType = converted.mimeType;
    }

    console.log('📸 Image ready, mime:', mimeType, 'size:', Math.round(base64.length / 1024), 'KB');

    // Initialize the Gemini SDK
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    // ── GUARDRAIL: Quick check if image is trash-related ──
    const guardrail = await isTrashRelatedImage(model, mimeType, base64);
    if (!guardrail.isTrash) {
      console.log('🚫 Image rejected by guardrail:', guardrail.reason);
      return {
        ...NOT_TRASH_RESULT,
        details: guardrail.reason
          ? `This doesn't look like waste — ${guardrail.reason}. Please take a photo of the trash you want to report.`
          : NOT_TRASH_RESULT.details,
      };
    }
    console.log('✅ Guardrail passed:', guardrail.reason);

    // ── FULL ANALYSIS: Classify waste type and estimate weight ──
    const prompt = `You are a waste classification AI for a municipal waste management app. Analyze this image and determine:

1. **Waste Type**: Classify into ONE of these 5 main categories:
   - "Solid Waste" (glass, plastics, metals, styrofoam, rubber, ceramics)
   - "Liquid Waste" (wastewater, oils, grease, sludge, spilled liquids)
   - "Organic Waste" (food scraps, yard waste, garden waste, plant matter, animal waste)
   - "Recyclable Waste" (paper, cardboard, clean bottles, aluminum cans, scrap metal)
   - "Hazardous Waste" (batteries, chemicals, electronics, paint, medical waste, biomedical materials)

2. **Estimated Weight**: Based on visual size and apparent volume, estimate the weight in kilograms (e.g., "2.5 kg", "0.5 kg", "15 kg"). Be reasonable — a single trash bag is usually 3-8 kg, a small pile 10-30 kg.

3. **Confidence**: Rate your confidence as "high", "medium", or "low".

4. **Details**: A brief 1-sentence explanation of what you see.

IMPORTANT RULES:
- If the waste is inside an opaque trash bag and you CANNOT see the contents, set wasteType to "Cannot determine (enclosed in bag)" and confidence to "none".
- If the image is blurry or unclear, set confidence to "low".

Respond ONLY with valid JSON in this exact format (no markdown, no code fences):
{"wasteType": "...", "estimatedWeight": "... kg", "confidence": "high|medium|low|none", "details": "..."}`;

    console.log('🌐 Sending analysis request to Gemini API...');

    // Use the SDK to generate content with an image
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType,
          data: base64,
        },
      },
    ]);

    const response = result.response;
    const textContent = response.text();

    if (!textContent) {
      console.error('❌ No text content in Gemini response');
      return FALLBACK_RESULT;
    }

    console.log('📝 Raw AI response:', textContent);

    // Parse the JSON response (strip any markdown code fences if present)
    let cleanJson = textContent
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();
      
    // If the AI includes conversational text, extract just the JSON object
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanJson = jsonMatch[0];
    }

    let parsed: WasteAnalysisResult;
    try {
      parsed = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('❌ Failed to parse JSON from AI:', parseError);
      console.log('📝 Raw failed text:', cleanJson);
      return {
        ...FALLBACK_RESULT,
        details: 'AI returned an unreadable response format. Please try again.',
      };
    }

    // Validate the result
    const validTypes = [
      'Solid Waste',
      'Liquid Waste',
      'Organic Waste',
      'Recyclable Waste',
      'Hazardous Waste',
      'Cannot determine (enclosed in bag)',
      'Not waste',
    ];

    if (!validTypes.some((t) => parsed.wasteType.includes(t))) {
      console.warn('⚠️ Unexpected waste type from AI:', parsed.wasteType);
    }

    console.log('🤖 AI Analysis complete:', parsed);
    return parsed;
  } catch (error: any) {
    console.error('❌ Waste AI analysis failed:', error);

    // ── GRACEFUL HANDLING: Rate limit / high demand errors ──
    if (isRateLimitError(error)) {
      console.warn('⏳ Gemini API rate limited / high demand');
      return {
        ...FALLBACK_RESULT,
        wasteType: 'Temporarily unavailable',
        details: 'The AI model is experiencing high demand right now. Please try again in a minute.',
      };
    }

    // Generic network / timeout errors
    const msg = error?.message?.toLowerCase() || '';
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('fetch')) {
      return {
        ...FALLBACK_RESULT,
        details: 'Network error — please check your internet connection and try again.',
      };
    }

    return {
      ...FALLBACK_RESULT,
      details: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
