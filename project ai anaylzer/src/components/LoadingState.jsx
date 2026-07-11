import './LoadingState.css';

export default function LoadingState() {
  return (
    <div className="loading-section">
      <div className="spinner" />
      <h3>Analyzing your document<span className="loading-dots" /></h3>
      <p>Extracting text and processing with GPT-5.4. This may take up to a minute for large documents.</p>
    </div>
  );
}
