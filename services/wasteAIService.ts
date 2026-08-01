/**
 * Waste AI Analysis Service
 * Uses Google Gemini Vision API to analyze waste images
 * and detect waste type + estimated weight.
 * 
 * OPTIMIZED: Single API call instead of two (guardrail + analysis merged).
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
 * 
 * OPTIMIZED: Uses a single API call that combines the guardrail check
 * and full analysis into one prompt, cutting response time ~50%.
 * 
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

    // Initialize the Gemini SDK — single model, single call
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    // ── SINGLE COMBINED PROMPT: Guardrail + Full Analysis ──
    const prompt = `You are a waste classification AI for a municipal waste management app.

STEP 1: First, determine if this image actually contains waste, trash, garbage, litter, recycling, or discarded materials (including trash bags, bins, dumpsters, piles of waste, food waste, recyclables, broken items, etc).

If this is NOT an image of waste (e.g., a selfie, a landscape, food on a plate, an animal, a document), respond with ONLY this JSON:
{"wasteType": "Not waste", "estimatedWeight": "—", "confidence": "none", "details": "Brief reason why this is not waste."}

STEP 2: If the image IS waste-related, classify it:

1. **Waste Type**: Classify into ONE of these categories:
   - "Solid Waste" (glass, plastics, metals, styrofoam, rubber, ceramics)
   - "Liquid Waste" (wastewater, oils, grease, sludge, spilled liquids)
   - "Organic Waste" (food scraps, yard waste, garden waste, plant matter, animal waste)
   - "Recyclable Waste" (paper, cardboard, clean bottles, aluminum cans, scrap metal)
   - "Hazardous Waste" (batteries, chemicals, electronics, paint, medical waste)
   - "Cannot determine (enclosed in bag)" (if contents are hidden inside an opaque bag)

2. **Estimated Weight**: Based on visual size, estimate in kg (e.g., "2.5 kg"). A single trash bag is usually 3-8 kg, a small pile 10-30 kg.

3. **Confidence**: "high", "medium", or "low". Use "low" if the image is blurry or unclear.

4. **Details**: One brief sentence about what you see.

Respond ONLY with valid JSON, no markdown, no code fences:
{"wasteType": "...", "estimatedWeight": "... kg", "confidence": "high|medium|low|none", "details": "..."}`;

    console.log('🌐 Sending analysis request to Gemini API...');
    const startTime = Date.now();

    // Single API call
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType,
          data: base64,
        },
      },
    ]);

    const elapsed = Date.now() - startTime;
    console.log(`⚡ AI response received in ${elapsed}ms`);

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
