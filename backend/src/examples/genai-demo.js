import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: process.env.LLM_MODEL || 'gemini-3.6-flash',
    contents: [{ type: 'text', text: 'Hello from Smart Resume Screener demo' }],
  });

  // The client returns a structured response; print a readable output
  console.log(JSON.stringify(response, null, 2));
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
