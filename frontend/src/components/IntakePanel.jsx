import { useRef, useState } from 'react';

export default function IntakePanel({
  jobTitle,
  jobDescription,
  onJobTitleChange,
  onJobDescriptionChange,
  candidates,
  onUpload,
  onRemoveCandidate,
  onRunMatch,
  isUploading,
  isMatching,
  error,
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (fileList) => {
    const files = Array.from(fileList);
    files.forEach((file) => onUpload(file));
  };

  return (
    <aside className="intake-panel">
      <div>
        <p className="panel-eyebrow">01 · Role</p>
        <h2 className="panel-title">Job description</h2>
        <div className="field-group">
          <label className="field-label" htmlFor="job-title">
            Role title
          </label>
          <input
            id="job-title"
            className="text-input"
            placeholder="e.g. Backend Engineer"
            value={jobTitle}
            onChange={(e) => onJobTitleChange(e.target.value)}
          />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="job-desc">
            Paste the job description
          </label>
          <textarea
            id="job-desc"
            className="textarea-input"
            placeholder="Paste requirements, responsibilities, must-have skills..."
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
          />
        </div>
      </div>

      <div>
        <p className="panel-eyebrow">02 · Candidates</p>
        <h2 className="panel-title">Upload resumes</h2>

        <div
          className="dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          style={isDragging ? { borderColor: 'var(--amber)' } : undefined}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt"
            multiple
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <div className="dropzone-label">
            <strong>Click to upload</strong> or drag resumes here
            <div style={{ marginTop: 4, fontSize: 11 }}>PDF or TXT · one file per candidate</div>
          </div>
        </div>

        {isUploading && (
          <p style={{ fontSize: 12, color: 'var(--ink-text-dim)', marginTop: 8 }}>
            <span className="spinner" style={{ borderTopColor: 'var(--amber)' }} /> Parsing resume…
          </p>
        )}

        {candidates.length > 0 && (
          <div className="candidate-chip-list" style={{ marginTop: 14 }}>
            {candidates.map((c) => (
              <div className="candidate-chip" key={c.id}>
                <div>
                  <div className="name">{c.name || 'Unnamed candidate'}</div>
                  <div className="file">{c.fileName}</div>
                </div>
                <button
                  className="chip-remove"
                  title="Remove candidate"
                  onClick={() => onRemoveCandidate(c.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <button
        className="btn btn-primary btn-block"
        disabled={isMatching || candidates.length === 0 || jobDescription.trim().length < 20}
        onClick={onRunMatch}
      >
        {isMatching ? 'Scoring candidates…' : `Score ${candidates.length || ''} candidate${candidates.length === 1 ? '' : 's'}`}
      </button>
    </aside>
  );
}
