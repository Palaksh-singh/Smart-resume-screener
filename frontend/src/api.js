const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;
  if (!res.ok) {
    throw new Error(body?.error || `Request failed with status ${res.status}`);
  }
  return body;
}

export const api = {
  health: () => request('/api/health'),

  createJob: (title, description) =>
    request('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    }),

  listJobs: () => request('/api/jobs'),

  uploadResume: (file) => {
    const formData = new FormData();
    formData.append('resume', file);
    return request('/api/resumes', { method: 'POST', body: formData });
  },

  listCandidates: () => request('/api/resumes'),

  deleteCandidate: (id) => request(`/api/resumes/${id}`, { method: 'DELETE' }),

  runMatch: (jobId, candidateIds) =>
    request(`/api/match/${jobId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidateIds ? { candidateIds } : {}),
    }),

  getMatches: (jobId) => request(`/api/match/${jobId}`),
};
