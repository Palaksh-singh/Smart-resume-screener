import { useEffect, useState } from 'react';
import IntakePanel from './components/IntakePanel.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import { api } from './api.js';

export default function App() {
  const [health, setHealth] = useState(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [results, setResults] = useState([]);
  const [scoredJobTitle, setScoredJobTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch(() => setHealth({ status: 'down' }));
  }, []);

  const handleUpload = async (file) => {
    setError('');
    setIsUploading(true);
    try {
      const candidate = await api.uploadResume(file);
      setCandidates((prev) => [...prev, candidate]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveCandidate = (id) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    setResults((prev) => prev.filter((r) => r.candidateId !== id));
  };

  const handleRunMatch = async () => {
    setError('');
    setIsMatching(true);
    try {
      const job = await api.createJob(jobTitle, jobDescription);
      const { results: scored } = await api.runMatch(
        job.id,
        candidates.map((c) => c.id)
      );
      setResults(scored);
      setScoredJobTitle(job.title);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="mark">Smart Resume Screener</span>
          <h1>LLM-Powered Candidate Shortlisting</h1>
        </div>
        <div className="topbar-status">
          <span className={`status-dot ${health?.llmConfigured ? 'online' : ''}`} />
          {health === null
            ? 'Checking API…'
            : health.status !== 'ok'
              ? 'Backend unreachable'
              : health.llmConfigured
                ? `LLM live (${health.model})`
                : 'Mock scoring (no API key set)'}
        </div>
      </header>

      {health && !health.llmConfigured && (
        <div className="mock-banner">Running in MOCK mode — set <strong>GROQ_API_KEY</strong> to enable real LLM scoring.</div>
      )}

      <div className="workspace">
        <IntakePanel
          jobTitle={jobTitle}
          jobDescription={jobDescription}
          onJobTitleChange={setJobTitle}
          onJobDescriptionChange={setJobDescription}
          candidates={candidates}
          onUpload={handleUpload}
          onRemoveCandidate={handleRemoveCandidate}
          onRunMatch={handleRunMatch}
          isUploading={isUploading}
          isMatching={isMatching}
          error={error}
        />
        <ResultsPanel
          jobTitle={scoredJobTitle}
          results={results}
          hasCandidates={candidates.length > 0}
        />
      </div>

      {isMatching && (
        <div className="global-overlay">
          <div className="overlay-inner">
            <span className="spinner" />
            <div style={{ marginTop: 8 }}>Scoring candidates…</div>
          </div>
        </div>
      )}
    </div>
  );
}
