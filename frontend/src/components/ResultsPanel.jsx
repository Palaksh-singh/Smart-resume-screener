export default function ResultsPanel({ jobTitle, results, hasCandidates }) {
  return (
    <main className="results-panel">
      <div className="results-header">
        <div>
          <h2>{jobTitle ? `Shortlist — ${jobTitle}` : 'Shortlist'}</h2>
          <p className="results-sub">
            {results.length > 0
              ? `${results.length} candidate${results.length === 1 ? '' : 's'} scored, ranked by fit`
              : 'Ranked results will appear here once you score candidates.'}
          </p>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="empty-state">
          <strong>{hasCandidates ? 'Ready when you are' : 'No candidates yet'}</strong>
          {hasCandidates
            ? 'Add a job description and hit "Score candidates" to see the ranked shortlist.'
            : 'Upload resumes and paste a job description on the left to get started.'}
        </div>
      ) : (
        <div className="candidate-list">
          {results.map((r, i) => (
            <article className="dossier-card" key={r.id}>
              <div className="rank-index">{String(i + 1).padStart(2, '0')}</div>

              <div className="dossier-main">
                <p className="cand-name">{r.candidateName}</p>
                <p className="cand-file">CANDIDATE_ID · {r.candidateId}</p>

                {(r.matchedSkills?.length > 0 || r.missingSkills?.length > 0) && (
                  <div className="tag-row">
                    {r.matchedSkills?.map((s) => (
                      <span className="tag matched" key={`m-${s}`}>
                        ✓ {s}
                      </span>
                    ))}
                    {r.missingSkills?.map((s) => (
                      <span className="tag missing" key={`x-${s}`}>
                        ✕ {s}
                      </span>
                    ))}
                  </div>
                )}

                <p className="justification">{r.justification}</p>
                {r._mock && <span className="mock-flag">MOCK SCORE — add ANTHROPIC_API_KEY for real LLM scoring</span>}
              </div>

              <div className="score-block">
                <span className={`recommendation ${r.recommendation}`}>{r.recommendation}</span>
                <div className="score-num">
                  {r.score}
                  <small>/10</small>
                </div>
                <div className="meter">
                  <div className="meter-fill" style={{ width: `${r.score * 10}%` }} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
