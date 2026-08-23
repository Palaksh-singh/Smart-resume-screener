import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';

export const jobsRouter = Router();

/** POST /api/jobs - create a job description (plain text, pasted or typed) */
jobsRouter.post('/', async (req, res) => {
  const { title, description } = req.body || {};
  if (!description || description.trim().length < 20) {
    return res.status(400).json({ error: 'A job description of at least 20 characters is required.' });
  }

  const db = await getDb();
  const job = {
    id: nanoid(10),
    title: title?.trim() || 'Untitled Role',
    rawText: description.trim(),
    createdAt: new Date().toISOString(),
  };
  db.data.jobs.push(job);
  await db.write();

  res.status(201).json(job);
});

/** GET /api/jobs */
jobsRouter.get('/', async (req, res) => {
  const db = await getDb();
  res.json(db.data.jobs);
});

/** GET /api/jobs/:id */
jobsRouter.get('/:id', async (req, res) => {
  const db = await getDb();
  const job = db.data.jobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  res.json(job);
});
