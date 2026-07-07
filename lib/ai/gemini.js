export const API_KEYS = process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',') : [];

let currentApiKeyIndex = 0;

export function getApiKey() {
  const key = API_KEYS[currentApiKeyIndex];
  currentApiKeyIndex = (currentApiKeyIndex + 1) % API_KEYS.length;
  return key;
}

export async function generateContent(prompt, model = "gemini-2.5-flash") {
  const apiKey = getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Gemini API Error:", response.status, errorData);
      
      // If error is 429 Too Many Requests, try the next key
      if (response.status === 429) {
          console.log("Quota exceeded, trying next key...");
          return generateContent(prompt, model); // Recursive call with new key
      }
      
      throw new Error(`Gemini API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
  } catch (error) {
    console.error("Failed to generate content:", error);
    throw error;
  }
}
