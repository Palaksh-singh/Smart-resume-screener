process.env.GEMINI_API_KEY = '';
import { strict as assert } from 'assert';
import { extractStructuredResume, scoreCandidateAgainstJob } from '../src/services/llmService.js';

describe('llmService mock fallbacks when GEMINI_API_KEY unset', () => {
  it('extractStructuredResume returns mock extraction object', async () => {
    const resume = 'Jane Smith\njane@example.com\nExperienced developer with JavaScript and Node.js.';
    const res = await extractStructuredResume(resume);
    assert.equal(res._mock, true);
    assert.ok(Array.isArray(res.skills));
  });

  it('scoreCandidateAgainstJob returns mock scoring object', async () => {
    const resume = 'Developer with JavaScript, Node.js, React.';
    const jd = 'Looking for a JavaScript/React developer.';
    const s = await scoreCandidateAgainstJob(resume, jd);
    assert.equal(s._mock, true);
    assert.ok(typeof s.score === 'number');
    assert.ok(Array.isArray(s.matchedSkills));
  });
});
