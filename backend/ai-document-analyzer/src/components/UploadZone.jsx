import { useRef } from 'react';
import './UploadZone.css';

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function UploadZone({ file, onFileSelect, onRemoveFile }) {
  const inputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) onFileSelect(droppedFile);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e) => {
    if (e.target.files[0]) onFileSelect(e.target.files[0]);
  };

  return (
    <div
      className="upload-zone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <div className="upload-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <h3>Drag & drop your PDF here</h3>
      <p>or <span className="browse-link">browse files</span> — Max 50 MB</p>

      {file && (
        <div className="file-info" onClick={(e) => e.stopPropagation()}>
          <div className="file-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div className="file-details">
            <div className="file-name">{file.name}</div>
            <div className="file-size">{formatBytes(file.size)}</div>
          </div>
          <button className="remove-file" onClick={onRemoveFile} title="Remove file">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <input
        type="file"
        ref={inputRef}
        accept=".pdf,application/pdf"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
