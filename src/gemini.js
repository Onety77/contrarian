// ---- API KEY ----
const apiKey = (() => {
  try { if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_GEMINI) return import.meta.env.VITE_APP_GEMINI; } catch (e) {}
  try { if (typeof process !== 'undefined' && process.env?.VITE_APP_GEMINI) return process.env.VITE_APP_GEMINI; } catch (e) {}
  try { if (typeof window !== 'undefined' && window.VITE_APP_GEMINI) return window.VITE_APP_GEMINI; } catch (e) {}
  return typeof __apiKey !== 'undefined' ? __apiKey : "";
})();

export async function askGemini(prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }
  )
  const data = await response.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
}
