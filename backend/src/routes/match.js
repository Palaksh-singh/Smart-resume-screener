import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';
import { scoreCandidateAgainstJob } from '../services/llmService.js';

export const matchRouter = Router();

/**
 * POST /api/match/:jobId
 * Scores every stored candidate (or a specific subset) against a job
 * description using the LLM, and persists the results.
 * Body (optional): { candidateIds: string[] } to limit which candidates run.
 */
matchRouter.post('/:jobId', async (req, res) => {
  try {
    const db = await getDb();
    const job = db.data.jobs.find((j) => j.id === req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const { candidateIds } = req.body || {};
    const candidates = candidateIds?.length
      ? db.data.candidates.filter((c) => candidateIds.includes(c.id))
      : db.data.candidates;

    if (candidates.length === 0) {
      return res.status(400).json({ error: 'No candidates available to score.' });
    }

    const results = [];
    for (const candidate of candidates) {
      const result = await scoreCandidateAgainstJob(candidate.rawText, job.rawText);
      const matchRecord = {
        id: nanoid(10),
        candidateId: candidate.id,
        candidateName: candidate.name || candidate.fileName,
        jobId: job.id,
        ...result,
        createdAt: new Date().toISOString(),
      };
      // Replace any previous match for this candidate+job pair so re-running is idempotent.
      db.data.matches = db.data.matches.filter(
        (m) => !(m.candidateId === candidate.id && m.jobId === job.id)
      );
      db.data.matches.push(matchRecord);
      results.push(matchRecord);
    }
    await db.write();

    results.sort((a, b) => b.score - a.score);
    res.json({ jobId: job.id, jobTitle: job.title, results });
  } catch (err) {
    console.error(`POST /api/match/${req.params.jobId} failed:`, err);
    res.status(500).json({ error: err.message || 'Failed to score candidates.' });
  }
});

/** GET /api/match/:jobId - shortlisted results for a job, best score first */
matchRouter.get('/:jobId', async (req, res) => {
  const db = await getDb();
  const job = db.data.jobs.find((j) => j.id === req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  const results = db.data.matches
    .filter((m) => m.jobId === req.params.jobId)
    .sort((a, b) => b.score - a.score);

  res.json({ jobId: job.id, jobTitle: job.title, results });
});
