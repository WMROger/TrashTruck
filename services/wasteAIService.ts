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
    const response = await fetch(uri);
    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64' as any,
    });
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

const FAST_PROMPT = `You are an ultra-fast waste classification AI for a municipal waste management app in the Philippines.
Analyze this photo quickly:

STEP 1: Determine if this image contains waste, garbage, trash, litter, recyclables, dump piles, or discarded materials.
If NOT waste (e.g. selfie, landscape, clean indoor room, live animal, plate of served food, document), return:
{"wasteType": "Not waste", "estimatedWeight": "—", "confidence": "none", "details": "Brief reason why this is not waste."}

STEP 2: If it IS waste, classify it accurately:
1. "wasteType": Pick exactly ONE of:
   - "Solid Waste"
   - "Liquid Waste"
   - "Organic Waste"
   - "Recyclable Waste"
   - "Hazardous Waste"
   - "Cannot determine (enclosed in bag)"
2. "estimatedWeight": Estimated weight in kilograms (e.g. "3.5 kg", "15.0 kg") or metric tons if >=1000kg (e.g. "1.2 t").
3. "confidence": "high", "medium", or "low".
4. "details": One concise sentence summarizing the waste.

Return ONLY valid JSON matching this schema:
{"wasteType": "...", "estimatedWeight": "...", "confidence": "high|medium|low|none", "details": "..."}`;

/**
 * Analyze a waste image using Gemini 2.0 Flash with structured JSON.
 * Returns the detected waste type and estimated weight in sub-second to low-second latency.
 * 
 * @param imageUri The local URI of the image
 * @param precomputedBase64 Optional pre-computed base64 string (from ImagePicker) to avoid re-reading
 */
export async function analyzeWasteImage(
  imageUri: string,
  precomputedBase64?: string | null
): Promise<WasteAnalysisResult> {
  try {
    console.log('🤖 Starting fast AI waste analysis...');

    if (!GEMINI_API_KEY) {
      console.error('❌ Gemini API key is not set');
      return {
        ...FALLBACK_RESULT,
        details: 'Gemini API key is not set. Please restart the Expo server to load .env.',
      };
    }

    let base64 = precomputedBase64;
    let mimeType = 'image/jpeg';

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
      const converted = await imageUriToBase64(imageUri);
      base64 = converted.base64;
      mimeType = converted.mimeType;
    }

    console.log('📸 Fast image payload ready, mime:', mimeType, 'size:', Math.round(base64.length / 1024), 'KB');

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    // Primary model: gemini-2.0-flash with structured JSON output for lowest latency
    const callGemini = async (modelName: string) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 150,
          temperature: 0.1,
        },
      });

      return await model.generateContent([
        FAST_PROMPT,
        {
          inlineData: {
            mimeType: mimeType,
            data: base64!,
          },
        },
      ]);
    };

    const startTime = Date.now();
    let result: any;

    try {
      result = await callGemini('gemini-2.0-flash');
    } catch (primaryErr: any) {
      console.warn('⚠️ gemini-2.0-flash request failed, trying gemini-1.5-flash fallback:', primaryErr?.message);
      // Fallback model: gemini-1.5-flash
      result = await callGemini('gemini-1.5-flash');
    }

    const elapsed = Date.now() - startTime;
    console.log(`⚡ AI response received in ${elapsed}ms`);

    const response = result.response;
    const textContent = response.text();

    if (!textContent) {
      console.error('❌ No text content in Gemini response');
      return FALLBACK_RESULT;
    }

    let cleanJson = textContent
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanJson = jsonMatch[0];
    }

    let parsed: WasteAnalysisResult;
    try {
      parsed = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('❌ Failed to parse JSON from AI:', parseError, cleanJson);
      return {
        ...FALLBACK_RESULT,
        details: 'AI returned an unreadable response format. Please try again.',
      };
    }

    const validTypes = [
      'Solid Waste',
      'Liquid Waste',
      'Organic Waste',
      'Recyclable Waste',
      'Hazardous Waste',
      'Cannot determine (enclosed in bag)',
      'Not waste',
    ];

    if (!validTypes.some((t) => parsed.wasteType?.includes(t))) {
      console.warn('⚠️ Unexpected waste type from AI:', parsed.wasteType);
    }

    console.log('🤖 AI Analysis complete:', parsed);
    return parsed;
  } catch (error: any) {
    console.error('❌ Waste AI analysis failed:', error);

    if (isRateLimitError(error)) {
      console.warn('⏳ Gemini API rate limited / high demand');
      return {
        ...FALLBACK_RESULT,
        wasteType: 'Temporarily unavailable',
        details: 'The AI model is experiencing high demand right now. Please try again in a minute.',
      };
    }

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
