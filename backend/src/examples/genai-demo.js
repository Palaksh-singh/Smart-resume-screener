import 'dotenv/config';

async function main() {
  let mod;
  try {
    mod = await import('@google/genai');
  } catch (e) {
    console.error(
      'Missing @google/genai package. Install it with `npm install @google/genai` to run this demo.'
    );
    process.exit(1);
  }

  const { GoogleGenAI } = mod;
  if (!GoogleGenAI) {
    console.error('Unexpected @google/genai export shape.');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: process.env.LLM_MODEL || 'gemini-3.6-flash',
    contents: [{ type: 'text', text: 'Hello from Smart Resume Screener demo' }],
  });

  console.log(JSON.stringify(response, null, 2));
}

main().catch((err) => {
  try {
    const status = err?.status || err?.code || null;
    const msg = err?.message || String(err);
    if (status === 429 || /RESOURCE_EXHAUSTED/i.test(msg) || /quota/i.test(msg)) {
      // Try to extract a RetryInfo seconds hint from the error message
      let secs = null;
      try {
        const m = msg.match(/retry in (\d+(?:\.\d+)?)s/i) || msg.match(/retryDelay"?:"?(\d+)s/i);
        if (m) secs = Number(m[1]);
      } catch (e) {
        /* ignore */
      }

      console.error('Gemini quota exceeded. Please retry' + (secs ? ` after ~${secs}s.` : '.'));
      console.error('Falling back to a simple mock response for demo purposes.');
      console.log(JSON.stringify({ mock: true, text: 'Hello (mock response due to quota)' }, null, 2));
      process.exit(0);
    }
  } catch (e) {
    // ignore parse errors
  }

  console.error('Demo failed:', err);
  process.exit(1);
});
