import 'dotenv/config';

const required = (name, fallback = undefined) => {
  const value = process.env[name] ?? fallback;
  return value;
};

export const config = {
  port: Number(process.env.PORT) || 5000,
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  groqApiKey: required('GROQ_API_KEY', ''),
  llmModel: required('LLM_MODEL', 'openai/gpt-oss-20b'),
};

export const isLlmConfigured = () => Boolean(config.groqApiKey);