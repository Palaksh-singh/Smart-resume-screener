import Anthropic from '@anthropic-ai/sdk';
import { config, isLlmConfigured } from '../config.js';

let client = null;
function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

/**
 * Strips markdown code fences etc. in case the model wraps its JSON.
 */
function safeParseJson(text) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

/**
 * PROMPT 1 - Structured extraction.
 * Pulls skills, experience, and education out of raw resume text
 * into a consistent JSON shape the rest of the app can rely on.
 */
const EXTRACTION_SYSTEM_PROMPT = `You are a resume parsing engine used inside an ATS (applicant tracking system).
You will be given the raw text of a resume. Extract structured information from it.

Respond with ONLY a valid JSON object (no markdown, no commentary, no preamble) matching exactly this shape:
{
  "name": string | null,
  "email": string | null,
  "phone": string | null,
  "skills": string[],          // technical + soft skills, deduplicated, title-cased
  "experience": [
    { "title": string, "company": string | null, "duration": string | null, "summary": string }
  ],
  "education": [
    { "degree": string, "institution": string | null, "year": string | null }
  ],
  "totalYearsExperience": number | null
}

Rules:
- If a field cannot be found, use null (or an empty array for list fields). Never invent data.
- Keep "summary" for each experience entry to one concise sentence.
- Infer totalYearsExperience from the dates/durations listed if possible, otherwise null.`;

export async function extractStructuredResume(resumeText) {
  if (!isLlmConfigured()) {
    return mockExtraction(resumeText);
  }

  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: config.llmModel,
    max_tokens: 1500,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Resume text:\n"""\n${resumeText.slice(0, 12000)}\n"""`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  try {
    return safeParseJson(textBlock.text);
  } catch (err) {
    throw new Error(`LLM returned non-JSON extraction output: ${err.message}`);
  }
}

/**
 * PROMPT 2 - Match scoring.
 * This directly implements the example prompt from the brief:
 * "Compare the following resume with this job description and rate fit on 1-10 with justification."
 */
const SCORING_SYSTEM_PROMPT = `You are a semantic resume-to-job matching engine used to shortlist candidates.
Compare the following resume with this job description and rate fit on 1-10 with justification.

Score guide:
- 1-3: Poor fit. Missing most required skills/experience.
- 4-6: Partial fit. Some overlap but notable gaps.
- 7-8: Strong fit. Meets most requirements with minor gaps.
- 9-10: Excellent fit. Meets or exceeds all key requirements.

Respond with ONLY a valid JSON object (no markdown, no commentary) matching exactly this shape:
{
  "score": number,                // integer 1-10
  "justification": string,        // 2-4 sentences explaining the score
  "matchedSkills": string[],      // skills/requirements the candidate satisfies
  "missingSkills": string[],      // skills/requirements the candidate is missing or weak on
  "recommendation": "Shortlist" | "Maybe" | "Reject"
}`;

export async function scoreCandidateAgainstJob(resumeText, jobDescriptionText) {
  if (!isLlmConfigured()) {
    return mockScore(resumeText, jobDescriptionText);
  }

  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: config.llmModel,
    max_tokens: 1000,
    system: SCORING_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content:
          `Resume:\n"""\n${resumeText.slice(0, 8000)}\n"""\n\n` +
          `Job description:\n"""\n${jobDescriptionText.slice(0, 4000)}\n"""`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  try {
    return safeParseJson(textBlock.text);
  } catch (err) {
    throw new Error(`LLM returned non-JSON scoring output: ${err.message}`);
  }
}

/* ------------------------------------------------------------------ *
 * Mock fallbacks so the app is fully demoable with zero API key set. *
 * These are keyword-based heuristics, NOT a substitute for the LLM   *
 * path above - they exist purely so `npm run dev` works out of the   *
 * box before you plug in ANTHROPIC_API_KEY.                         *
 * ------------------------------------------------------------------ */

const SKILL_VOCAB = [
  'javascript', 'typescript', 'node.js', 'node', 'react', 'python', 'java',
  'express', 'sql', 'mongodb', 'postgresql', 'aws', 'docker', 'kubernetes',
  'git', 'rest api', 'graphql', 'machine learning', 'communication',
  'leadership', 'project management', 'html', 'css',
];

function mockExtraction(resumeText) {
  const lower = resumeText.toLowerCase();
  const skills = SKILL_VOCAB.filter((s) => lower.includes(s)).map(titleCase);
  const emailMatch = resumeText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const nameGuess = resumeText.split('\n').find((l) => l.trim().length > 0) || null;

  return {
    name: nameGuess ? nameGuess.trim().slice(0, 60) : null,
    email: emailMatch ? emailMatch[0] : null,
    phone: null,
    skills,
    experience: [],
    education: [],
    totalYearsExperience: null,
    _mock: true,
  };
}

function mockScore(resumeText, jobDescriptionText) {
  const resumeLower = resumeText.toLowerCase();
  const jdSkills = SKILL_VOCAB.filter((s) => jobDescriptionText.toLowerCase().includes(s));
  const matched = jdSkills.filter((s) => resumeLower.includes(s));
  const missing = jdSkills.filter((s) => !resumeLower.includes(s));
  const ratio = jdSkills.length ? matched.length / jdSkills.length : 0.5;
  const score = Math.max(1, Math.min(10, Math.round(ratio * 10)));

  return {
    score,
    justification:
      `[MOCK MODE - no ANTHROPIC_API_KEY set] Matched ${matched.length} of ${jdSkills.length} ` +
      `keyword skills detected in the job description. Set ANTHROPIC_API_KEY in .env for real semantic scoring.`,
    matchedSkills: matched.map(titleCase),
    missingSkills: missing.map(titleCase),
    recommendation: score >= 7 ? 'Shortlist' : score >= 4 ? 'Maybe' : 'Reject',
    _mock: true,
  };
}

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
