import { config, isLlmConfigured } from '../config.js';

const GEMINI_ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

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
 * Low-level call to the Gemini API. Sends a system instruction + one user
 * message, and asks for JSON-only output via responseMimeType.
 */
async function callGemini(systemPrompt, userContent) {
  const maxRetries = 5;
  const baseMs = 400;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(`${GEMINI_ENDPOINT(config.llmModel)}?key=${config.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini API returned no text content.');
      }
      return text;
    }

    const errBody = await res.text();
    const status = res.status;

    // Retry on transient server errors (5xx) or 429 rate-limits when attempts remain
    const shouldRetry = (status >= 500 && status < 600) || status === 429;
    if (!shouldRetry || attempt === maxRetries) {
      throw new Error(`Gemini API error (${status}): ${errBody}`);
    }

    // Prefer honoring server-provided retry hints
    let retryDelayMs = null;
    const retryAfter = res.headers.get('retry-after') || res.headers.get('Retry-After');
    if (retryAfter) {
      // header may be seconds or HTTP-date
      const secs = Number(retryAfter);
      if (!Number.isNaN(secs)) retryDelayMs = Math.max(1000, Math.floor(secs * 1000));
      else {
        const date = Date.parse(retryAfter);
        if (!Number.isNaN(date)) retryDelayMs = Math.max(1000, date - Date.now());
      }
    }

    // Fallback: try to parse retry info from JSON body (Gemini includes RetryInfo in details)
    if (retryDelayMs == null) {
      try {
        const parsed = JSON.parse(errBody || '{}');
        const details = parsed?.error?.details || parsed?.details || [];
        for (const d of details) {
          if (d?.retryDelay) {
            // retryDelay may be like '22s' or '00:00:22'
            const m = String(d.retryDelay).match(/(\d+(?:\.\d+)?)s$/i);
            if (m) retryDelayMs = Math.max(1000, Math.round(parseFloat(m[1]) * 1000));
            else {
              // attempt ISO-8601 or numeric parse
              const n = Number(d.retryDelay);
              if (!Number.isNaN(n)) retryDelayMs = Math.max(1000, Math.round(n * 1000));
            }
            if (retryDelayMs != null) break;
          }
        }
      } catch (e) {
        // ignore JSON parse errors
      }
    }

    if (retryDelayMs == null) {
      // Exponential backoff with jitter as a final fallback
      retryDelayMs = Math.round(baseMs * 2 ** attempt * (0.5 + Math.random() * 0.5));
    }

    console.warn(`Gemini request failed (status ${status}), retrying in ${retryDelayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
    await new Promise((r) => setTimeout(r, retryDelayMs));
  }

  throw new Error('Gemini API: retries exhausted');
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

  const text = await callGemini(
    EXTRACTION_SYSTEM_PROMPT,
    `Resume text:\n"""\n${resumeText.slice(0, 12000)}\n"""`
  );

  try {
    return safeParseJson(text);
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

  const text = await callGemini(
    SCORING_SYSTEM_PROMPT,
    `Resume:\n"""\n${resumeText.slice(0, 8000)}\n"""\n\n` +
      `Job description:\n"""\n${jobDescriptionText.slice(0, 4000)}\n"""`
  );

  try {
    return safeParseJson(text);
  } catch (err) {
    throw new Error(`LLM returned non-JSON scoring output: ${err.message}`);
  }
}

/* ------------------------------------------------------------------ *
 * Mock fallbacks so the app is fully demoable with zero API key set. *
 * These are keyword-based heuristics, NOT a substitute for the LLM   *
 * path above - they exist purely so `npm run dev` works out of the   *
 * box before you plug in GEMINI_API_KEY.                             *
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
      `[MOCK MODE - no GEMINI_API_KEY set] Matched ${matched.length} of ${jdSkills.length} ` +
      `keyword skills detected in the job description. Set GEMINI_API_KEY in .env for real semantic scoring.`,
    matchedSkills: matched.map(titleCase),
    missingSkills: missing.map(titleCase),
    recommendation: score >= 7 ? 'Shortlist' : score >= 4 ? 'Maybe' : 'Reject',
    _mock: true,
  };
}

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}