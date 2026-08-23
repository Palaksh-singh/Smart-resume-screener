import 'dotenv/config';

const required = (name, fallback = undefined) => {
  const value = process.env[name] ?? fallback;
  return value;
};

export const config = {
  port: Number(process.env.PORT) || 5000,
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  geminiApiKey: required('GEMINI_API_KEY', ''),
  // Optional: an OAuth2 access token (Bearer) to authenticate Gemini requests.
  // Useful for service-account or ADC-based authentication flows.
  geminiAccessToken: required('GEMINI_ACCESS_TOKEN', ''),
  llmModel: required('LLM_MODEL', 'gemini-2.5-flash'),
};
export const isLlmConfigured = () => Boolean(config.geminiApiKey || config.geminiAccessToken);