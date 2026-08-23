import { strict as assert } from 'assert';
import { describe, it } from 'node:test';
import { extractResumeText } from '../src/services/pdfParser.js';

describe('pdfParser.extractResumeText (text fallback)', () => {
  it('normalizes whitespace and returns plain text for text/plain buffers', async () => {
    const raw = `John Doe\r\n\r\nSummary:\r\nExperienced developer\r\n\r\n\r\nSkills:\r\nJavaScript, Node.js\r\n`;
    const buf = Buffer.from(raw, 'utf-8');

    const out = await extractResumeText(buf, 'text/plain', 'resume.txt');

    // should contain key phrases and not have excessive blank lines
    assert.ok(out.includes('John Doe'));
    assert.ok(out.includes('Summary:'));
    // no more than two consecutive newlines should remain
    assert.equal(!/\n{3,}/.test(out), true);
  });
});
