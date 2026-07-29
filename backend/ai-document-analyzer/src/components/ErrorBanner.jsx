import './ErrorBanner.css';

export default function ErrorBanner({ message }) {
  return (
    <div className="error-banner">
      <div className="error-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <div className="error-text">
        <h4>Analysis Failed</h4>
        <p>{message}</p>
      </div>
    </div>
  );
}
