import { JSONFilePreset } from 'lowdb/node';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, 'data', 'db.json');

const defaultData = {
  candidates: [], // parsed resumes: { id, fileName, rawText, name, email, skills, experience, education, createdAt }
  jobs: [],       // job descriptions: { id, title, rawText, createdAt }
  matches: [],    // { id, candidateId, jobId, score, justification, matchedSkills, missingSkills, createdAt }
};

let dbInstance = null;

export async function getDb() {
  if (!dbInstance) {
    dbInstance = await JSONFilePreset(DB_FILE, defaultData);
  }
  return dbInstance;
}
