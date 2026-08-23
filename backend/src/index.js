import express from 'express';
import cors from 'cors';
import { config, isLlmConfigured } from './config.js';
import { resumesRouter } from './routes/resumes.js';
import { jobsRouter } from './routes/jobs.js';
import { matchRouter } from './routes/match.js';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '2mb' }));

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
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
});

app.listen(config.port, () => {
  console.log(`Smart Resume Screener API listening on http://localhost:${config.port}`);
  if (!isLlmConfigured()) {
    console.warn(
      '⚠️  ANTHROPIC_API_KEY is not set - running in MOCK mode with keyword-based scoring.\n' +
      '   Add your key to backend/.env to enable real LLM extraction & scoring.'
    );
  }
});
