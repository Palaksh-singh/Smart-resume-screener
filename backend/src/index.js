import express from 'express';
import cors from 'cors';
import { config, isLlmConfigured } from './config.js';
import { resumesRouter } from './routes/resumes.js';
import { jobsRouter } from './routes/jobs.js';
import { matchRouter } from './routes/match.js';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '2mb' }));

// Lightweight request logging (method, path, status, duration)
app.use((req, res, next) => {
  const start = Date.now();
  res.once('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    llmConfigured: isLlmConfigured(),
    model: config.llmModel,
  });
});

app.use('/api/resumes', resumesRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/match', matchRouter);

// Central error handler (e.g. multer file-type/size errors)
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const payload = { error: err.message || 'Internal server error.' };
  // Include stack trace in non-production for easier debugging
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }
  console.error(`Error ${status} on ${req.method} ${req.originalUrl}:`, err.message);
  if (err.stack) console.error(err.stack);
  res.status(status).json(payload);
});

app.listen(config.port, () => {
  console.log(`Smart Resume Screener API listening on http://localhost:${config.port}`);
  if (!isLlmConfigured()) {
    console.warn(
          '⚠️  GROQ_API_KEY is not set - running in MOCK mode with keyword-based scoring.\n' +
          '   Add your free key to backend/.env (see .env.example) to enable real LLM extraction & scoring.'
    );
  }
});
