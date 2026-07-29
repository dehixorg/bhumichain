import { useState } from 'react';
import BackgroundOrbs from './components/BackgroundOrbs';
import Hero from './components/Hero';
import UploadZone from './components/UploadZone';
import LoadingState from './components/LoadingState';
import ErrorBanner from './components/ErrorBanner';
import ResultsView from './components/ResultsView';
import './App.css';

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [meta, setMeta] = useState(null);

  const handleFileSelect = (selectedFile) => {
    if (selectedFile.type !== 'application/pdf') {
      setError('Invalid file type. Please upload a PDF file.');
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File too large. Maximum size is 50 MB.');
      return;
    }
    setFile(selectedFile);
    setError(null);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResults(null);
    setMeta(null);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Analysis failed. Please try again.');
      }

      setResults({
        original: json.data,
        english: json.englishData,
        hindi: json.hindiData
      });
      setMeta(json.meta);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewAnalysis = () => {
    setFile(null);
    setResults(null);
    setMeta(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <BackgroundOrbs />
      <div className="container">
        <Hero />

        {!results && (
          <>
            <UploadZone
              file={file}
              onFileSelect={handleFileSelect}
              onRemoveFile={handleRemoveFile}
            />

            {file && !loading && (
              <button className="analyze-btn" onClick={handleAnalyze}>
                Analyze Document
              </button>
            )}
          </>
        )}

        {error && <ErrorBanner message={error} />}
        {loading && <LoadingState />}

        {results && meta && (
          <ResultsView
            data={results}
            meta={meta}
            onNewAnalysis={handleNewAnalysis}
          />
        )}
      </div>
    </>
  );
}
