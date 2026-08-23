import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';
import { uploadResume } from '../middleware/upload.js';
import { extractResumeText } from '../services/pdfParser.js';
import { extractStructuredResume } from '../services/llmService.js';

export const resumesRouter = Router();

/**
 * POST /api/resumes
 * Upload a resume (PDF or TXT). Extracts text, then asks the LLM to
 * pull out structured skills/experience/education, and stores it all.
 */
resumesRouter.post('/', uploadResume.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file uploaded (field name: "resume").' });
    }

    const rawText = await extractResumeText(req.file.buffer, req.file.mimetype, req.file.originalname);
    if (!rawText || rawText.length < 20) {
      return res.status(422).json({ error: 'Could not extract readable text from this file.' });
    }

    const structured = await extractStructuredResume(rawText);

    const db = await getDb();
    const candidate = {
      id: nanoid(10),
      fileName: req.file.originalname,
      rawText,
      ...structured,
      createdAt: new Date().toISOString(),
    };
    db.data.candidates.push(candidate);
    await db.write();

    res.status(201).json(candidate);
  } catch (err) {
    console.error('POST /api/resumes failed:', err);
    res.status(500).json({ error: err.message || 'Failed to process resume.' });
  }
});

/** GET /api/resumes - list all parsed candidates */
resumesRouter.get('/', async (req, res) => {
  const db = await getDb();
  // Don't ship full raw resume text in the list view - keep it light.
  const list = db.data.candidates.map(({ rawText, ...rest }) => rest);
  res.json(list);
});

/** GET /api/resumes/:id - full candidate detail including raw text */
resumesRouter.get('/:id', async (req, res) => {
  const db = await getDb();
  const candidate = db.data.candidates.find((c) => c.id === req.params.id);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });
  res.json(candidate);
});

/** DELETE /api/resumes/:id */
resumesRouter.delete('/:id', async (req, res) => {
  const db = await getDb();
  const before = db.data.candidates.length;
  db.data.candidates = db.data.candidates.filter((c) => c.id !== req.params.id);
  db.data.matches = db.data.matches.filter((m) => m.candidateId !== req.params.id);
  await db.write();
  if (db.data.candidates.length === before) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }
  res.status(204).end();
});
