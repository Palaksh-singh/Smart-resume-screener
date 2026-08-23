import 'dotenv/config';

const required = (name, fallback = undefined) => {
  const value = process.env[name] ?? fallback;
  return value;
};

export const config = {
  port: Number(process.env.PORT) || 5000,
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  geminiApiKey: required('GEMINI_API_KEY', ''),
  llmModel: required('LLM_MODEL', 'gemini-2.5-flash'),
};

export const isLlmConfigured = () => Boolean(config.geminiApiKey);