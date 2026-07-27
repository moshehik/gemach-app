// Read API keys from environment variable (comma separated)
export const API_KEYS = (process.env.GEMINI_API_KEYS || process.env.NEXT_PUBLIC_GEMINI_API_KEYS || "").split(",").map(k => k.trim()).filter(Boolean);
let currentApiKeyIndex = 0;

export function getApiKey() {
  if (API_KEYS.length === 0) return "";
  const key = API_KEYS[currentApiKeyIndex];
  currentApiKeyIndex = (currentApiKeyIndex + 1) % API_KEYS.length;
  return key;
}

const FALLBACK_MODELS = [
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite"
];

export async function generateContent(prompt, requestedModel = null) {
  // Determine models to try based on fallback order
  let modelsToTry = [...FALLBACK_MODELS];
  if (requestedModel && !modelsToTry.includes(requestedModel)) {
    modelsToTry.unshift(requestedModel);
  } else if (requestedModel) {
    // If it's already in the list, move it to the front
    modelsToTry = [requestedModel, ...modelsToTry.filter(m => m !== requestedModel)];
  }
  
  const payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };

  const totalKeys = API_KEYS.length > 0 ? API_KEYS.length : 1;
  let lastError = null;

  for (const model of modelsToTry) {
    // Try all keys for the current model
    for (let keyAttempt = 1; keyAttempt <= totalKeys; keyAttempt++) {
      const apiKey = getApiKey();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const data = await response.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
        }

        const errorData = await response.json().catch(() => ({}));
        console.warn(`[Gemini API] Model ${model} failed (Key attempt ${keyAttempt}/${totalKeys}):`, response.status, errorData);

        // 429 Quota Exceeded, 403 Forbidden, 503 Service Unavailable, 402 Payment Required
        if (response.status === 429 || response.status === 403 || response.status === 503 || response.status === 402) {
          lastError = new Error(`Quota or Load issue (${response.status}) on model ${model}`);
          if (keyAttempt < totalKeys) {
            console.warn(`Rotating key and trying AGAIN with the SAME model (${model})...`);
          }
          continue; // Try next key in the inner loop
        } else {
          lastError = new Error(`API Error ${response.status} on model ${model}`);
          console.warn(`Model ${model} critically failed with status ${response.status}. Moving to NEXT model...`);
          break; // Break inner loop to try next model
        }
      } catch (error) {
        lastError = error;
        console.error(`[Gemini API] Exception during call to ${model}:`, error.message);
        break; // Network exception or other critical error, move to next model
      }
    }
    
    console.warn(`Exhausted all keys (or encountered critical error) for model: ${model}. Moving to next fallback model...`);
  }

  throw new Error(`All fallback models and keys failed. Last error: ${lastError?.message}`);
}
