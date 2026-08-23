# Smart Resume Screener

An LLM-powered tool that parses resumes (PDF/Text), extracts structured candidate
data, and scores each candidate against a job description — returning a ranked,
justified shortlist.

Built for the **Unthinkable** take-home assignment (Project 1: Smart Resume Screener).

> 🎥 **Demo video:** _add your 2–3 min Loom/YouTube link here before submitting_

---

## Table of contents

- [What it does](#1-what-it-does)
- [Architecture](#2-architecture)
- [LLM usage & prompts](#3-llm-usage--prompts)
- [Setup & running locally](#4-setup--running-locally)
- [Running tests & CI](#running-tests--ci)
- [Design notes / trade-offs](#5-design-notes--trade-offs)
- [Possible next steps](#6-possible-next-steps)

---

## 1. What it does

1. **Intake** — upload one or more resumes (PDF or `.txt`) and paste a job description.
2. **Extraction** — each resume is parsed and sent to an LLM, which returns structured
   JSON: name, contact info, skills, work experience, and education.
3. **Scoring** — every candidate is compared against the job description by the LLM,
   which returns a **1–10 fit score**, a written **justification**, matched/missing
   skills, and a Shortlist / Maybe / Reject recommendation.
4. **Shortlist view** — the React dashboard renders candidates ranked best-fit first,
   with the score, reasoning, and skill gaps visible at a glance.

The app runs **fully offline in "mock mode"** with zero configuration (keyword-based
heuristic scoring), and automatically switches to **real LLM scoring** the moment you
add a `GROQ_API_KEY` — so it's demoable immediately and upgradeable in one step.
Groq was chosen for the LLM calls because it has a genuine free tier (no credit card
required), keeping the project runnable end-to-end at zero cost.

---

## 2. Architecture

```
                        ┌────────────────────────┐
                        │   React Dashboard        │
                        │   (Vite, port 5173)      │
                        │                          │
                        │  IntakePanel → uploads   │
                        │  ResultsPanel → shortlist │
                        └───────────┬──────────────┘
                                    │ REST (fetch, JSON)
                                    ▼
                        ┌────────────────────────┐
                        │  Express API (Node.js)  │
                        │      (port 5000)        │
                        │                          │
                        │  /api/resumes  (POST/GET/DELETE)
                        │  /api/jobs     (POST/GET)
                        │  /api/match/:jobId (POST/GET)
                        └───┬────────────┬─────────┘
                            │            │
             ┌──────────────┘            └───────────────┐
             ▼                                            ▼
   ┌───────────────────┐                       ┌────────────────────────┐
   │  pdf-parse         │                       │  Groq API               │
   │  (text extraction) │                       │  (extraction + scoring) │
   └───────────────────┘                       └────────────────────────┘
             │                                            │
             └───────────────────┬────────────────────────┘
                                  ▼
                        ┌────────────────────────┐
                        │  lowdb (JSON file)      │
                        │  candidates / jobs /     │
                        │  matches collections     │
                        └────────────────────────┘
```

**Why this stack:**

- **Node.js + Express** — matches the "Backend API (Node.js/Python/Java)" requirement,
  and Express keeps the route layer thin and easy to review.
- **lowdb (JSON file storage)** — satisfies the "database storage for parsed resumes"
  requirement with zero setup (no DB server to install for the reviewer). The data
  access is isolated behind `src/db.js`, so swapping in Postgres/MongoDB later only
  touches one file — the routes and services don't change.
- **Groq API** (OpenAI-compatible `chat/completions` endpoint) — used for both
  structured extraction and semantic match scoring (see prompts below), called
  directly from the backend so the API key never reaches the browser. Chosen over
  other providers specifically because it has a genuine free tier.
- **React + Vite** — the optional frontend dashboard, kept dependency-light (no
  component library) so the UI code is easy to read end-to-end.

### Project layout

```
smart-resume-screener/
├── .github/workflows/nodejs.yml  # CI: runs backend tests on push/PR
├── backend/
│   ├── src/
│   │   ├── index.js              # Express app + route wiring
│   │   ├── config.js             # env/config loader
│   │   ├── db.js                 # lowdb JSON-file database
│   │   ├── middleware/upload.js  # multer file-upload handling
│   │   ├── routes/
│   │   │   ├── resumes.js        # upload/list/delete candidates
│   │   │   ├── jobs.js           # create/list job descriptions
│   │   │   └── match.js          # run + fetch LLM scoring
│   │   └── services/
│   │       ├── pdfParser.js      # PDF/TXT → plain text
│   │       ├── llmService.js     # Groq API calls + prompts (+ mock fallback)
│   │       └── __tests__/        # unit tests (Node's built-in test runner)
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js                # fetch client for the backend
│   │   ├── components/
│   │   │   ├── IntakePanel.jsx   # job form + resume upload
│   │   │   └── ResultsPanel.jsx  # ranked shortlist cards
│   │   └── styles.css
│   └── package.json
└── README.md
```

---

## 3. LLM usage & prompts

Two distinct LLM calls, both in `backend/src/services/llmService.js`, both constrained
to return **only JSON** (no prose) so the backend can consume the output directly.

### 3.1 Structured extraction

Turns raw resume text into a consistent schema (skills, experience, education).

```
System prompt (abridged):
"You are a resume parsing engine used inside an ATS. Extract structured
information from the given resume text. Respond with ONLY a valid JSON
object: { name, email, phone, skills[], experience[], education[],
totalYearsExperience }. If a field can't be found, use null — never invent data."
```

### 3.2 Match scoring — the assignment's example prompt, implemented directly

```
System prompt:
"Compare the following resume with this job description and rate fit on
1-10 with justification.

Score guide:
1-3 Poor fit · 4-6 Partial fit · 7-8 Strong fit · 9-10 Excellent fit

Respond with ONLY a valid JSON object:
{ score, justification, matchedSkills[], missingSkills[], recommendation }"
```

The user message that follows supplies the resume text and job description text,
each truncated to a safe token budget so long resumes don't blow the context window.

### 3.3 Mock mode

If `GROQ_API_KEY` is not set, both functions fall back to a keyword-overlap
heuristic (see `mockExtraction` / `mockScore` in `llmService.js`) so the app is fully
functional and demoable without any API key. Every mock result is tagged `"_mock": true`
and the UI surfaces a visible **"MOCK SCORE"** badge — nothing is silently faked.

---

## 4. Setup & running locally

### Prerequisites
- Node.js ≥ 18

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Optional: get a free key at https://console.groq.com/keys
# and paste it into .env → GROQ_API_KEY=gsk_...
npm start          # http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev         # http://localhost:5173
```

Open `http://localhost:5173`, paste a job description, upload one or more resumes
(PDF or `.txt`), and click **Score candidates**.

### API reference

| Method | Route              | Description                                   |
|--------|--------------------|------------------------------------------------|
| GET    | `/api/health`       | Server + LLM-configuration status              |
| POST   | `/api/resumes`       | Upload a resume (`multipart/form-data`, field `resume`) |
| GET    | `/api/resumes`       | List parsed candidates                         |
| DELETE | `/api/resumes/:id`   | Remove a candidate                              |
| POST   | `/api/jobs`           | Create a job description `{ title, description }` |
| GET    | `/api/jobs`           | List job descriptions                           |
| POST   | `/api/match/:jobId`   | Score candidates against a job (optional `{ candidateIds }`) |
| GET    | `/api/match/:jobId`   | Fetch stored match results for a job, ranked    |

**Example: score candidates via curl** (create a job and upload a candidate first):

```bash
curl -X POST http://localhost:5000/api/match/<JOB_ID> \
  -H 'Content-Type: application/json' \
  -d '{"candidateIds": ["<CANDIDATE_ID>"]}'
```

---

## Running tests & CI

Unit tests cover the mock-mode extraction/scoring logic and the text-normalization
helper, using Node's built-in test runner (no extra test framework dependency):

```bash
cd backend
npm test
```

A GitHub Actions workflow at `.github/workflows/nodejs.yml` runs these tests
automatically on every push and pull request.

---

## 5. Design notes / trade-offs

- **File support** is PDF + plain text, matching the brief's "Input: PDF/Text resumes."
  DOCX was left out deliberately to keep parsing reliable rather than bolting on a
  second, flakier extraction path.
- **lowdb** was chosen over a full SQL/NoSQL server so the project runs with `npm install`
  and nothing else — a reviewer shouldn't need to stand up a database to try it. The
  data-access layer is isolated in `db.js` specifically so this is a one-file swap later.
- **Idempotent scoring** — re-running the match for a job replaces that candidate's
  previous score rather than duplicating it, so the shortlist always reflects the
  latest JD.
- **Mock mode** exists purely so the grader can run this with zero setup; it's clearly
  labeled everywhere it appears (API response, README, UI badge) and is not a
  substitute for the real LLM path.

## 6. Possible next steps

- Batch upload with a queue + progress bar for large resume sets
- DOCX support via `mammoth`
- Auth + multi-recruiter workspaces
- Swap lowdb → Postgres with Prisma for concurrent multi-user use
