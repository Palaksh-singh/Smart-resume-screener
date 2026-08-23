import pdfParse from 'pdf-parse/lib/pdf-parse.js';

/**
 * Extracts plain text from an uploaded resume file buffer.
 * Supports PDF (.pdf) and plain text (.txt) uploads, since the
 * assignment scope is "PDF/Text resumes".
 */
export async function extractResumeText(fileBuffer, mimeType, originalName) {
  const isPdf =
    mimeType === 'application/pdf' || originalName?.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    const parsed = await pdfParse(fileBuffer);
    return normalizeWhitespace(parsed.text);
  }

  // Fallback: treat as plain text (.txt, .md, etc.)
  return normalizeWhitespace(fileBuffer.toString('utf-8'));
}

function normalizeWhitespace(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
