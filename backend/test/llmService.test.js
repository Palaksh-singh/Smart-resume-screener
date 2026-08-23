process.env.GROQ_API_KEY = '';
import { strict as assert } from 'assert';
import { describe, it } from 'node:test';
import { config } from '../src/config.js';

describe('llmService mock fallbacks when GROQ_API_KEY unset', () => {
  it('extractStructuredResume returns mock extraction object', async () => {
    // Ensure config reflects no API key before loading the service
    config.groqApiKey = '';
    const { extractStructuredResume } = await import('../src/services/llmService.js');

    const resume = 'Jane Smith\njane@example.com\nExperienced developer with JavaScript and Node.js.';
    const res = await extractStructuredResume(resume);
    assert.equal(res._mock, true);
    assert.ok(Array.isArray(res.skills));
  });

  it('scoreCandidateAgainstJob returns mock scoring object', async () => {
    config.groqApiKey = '';
    const { scoreCandidateAgainstJob } = await import('../src/services/llmService.js');

    const resume = 'Developer with JavaScript, Node.js, React.';
    const jd = 'Looking for a JavaScript/React developer.';
    const s = await scoreCandidateAgainstJob(resume, jd);
    assert.equal(s._mock, true);
    assert.ok(typeof s.score === 'number');
    assert.ok(Array.isArray(s.matchedSkills));
  });
});
