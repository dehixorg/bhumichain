import React, { useState } from 'react';
import { 
  FileText, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Download, 
  Search, 
  Table as TableIcon, 
  Grid, 
  Code,
  Check,
  ChevronRight,
  Info
} from 'lucide-react';

export default function App() {
  // Config state
  const [modelId, setModelId] = useState('prebuilt-layout');

  // File Upload State
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Processing States
  const [status, setStatus] = useState('idle'); // idle, submitting, polling, succeeded, failed
  const [currentStep, setCurrentStep] = useState(0); // 0: Select, 1: Submit, 2: Poll, 3: Success
  const [pollStatusText, setPollStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Analysis Results State
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [activeTab, setActiveTab] = useState('text'); // text, kv, tables, raw
  const [selectedTableIndex, setSelectedTableIndex] = useState(0);
  const [kvSearchQuery, setKvSearchQuery] = useState('');

  // Alert/Notifications
  const [copiedStates, setCopiedStates] = useState({}); // { tabName: boolean }

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'image/bmp'];
    if (validTypes.includes(selectedFile.type)) {
      setFile(selectedFile);
      setStatus('idle');
      setAnalyzeResult(null);
      setErrorMessage('');
    } else {
      alert('Unsupported file format. Please upload PDF, JPEG, PNG, TIFF, or BMP files.');
    }
  };

  // Submit and Analyze Document via Backend Server
  const handleAnalyze = async () => {
    if (!file) return;

    setStatus('submitting');
    setCurrentStep(1);
    setErrorMessage('');
    setPollStatusText('Uploading document to server...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Perform analysis query
      const response = await fetch(`http://localhost:3001/api/analyze?modelId=${modelId}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errorMsg = 'Failed to analyze document';
        try {
          const errJson = await response.json();
          if (errJson.error && errJson.error.message) {
            errorMsg = errJson.error.message;
          }
        } catch (e) {
          errorMsg = `${response.status} ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      setStatus('polling');
      setCurrentStep(2);
      setPollStatusText('Server is running Azure processing and polling...');

      const data = await response.json();
      
      // Process Success
      setAnalyzeResult(data.analyzeResult);
      setStatus('succeeded');
      setCurrentStep(3);
      setPollStatusText('');

      // Automatically focus on relevant tab
      const result = data.analyzeResult;
      if (result.tables && result.tables.length > 0) {
        setActiveTab('tables');
        setSelectedTableIndex(0);
      } else if (result.keyValuePairs && result.keyValuePairs.length > 0) {
        setActiveTab('kv');
      } else {
        setActiveTab('text');
      }

    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'An error occurred during analysis.');
      setStatus('failed');
    }
  };

  // Copy helper
  const handleCopyToClipboard = (text, tabName) => {
    navigator.clipboard.writeText(text);
    setCopiedStates(prev => ({ ...prev, [tabName]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [tabName]: false }));
    }, 2000);
  };

  // Download raw text as markdown file
  const handleDownloadMarkdown = () => {
    if (!analyzeResult || !analyzeResult.content) return;
    const blob = new Blob([analyzeResult.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${file.name.split('.')[0]}_extracted.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download a Table as CSV
  const handleDownloadTableCSV = (table, index) => {
    if (!table) return;
    
    // Construct 2D grid
    const grid = [];
    for (let r = 0; r < table.rowCount; r++) {
      grid.push(new Array(table.columnCount).fill(''));
    }
    
    table.cells.forEach(cell => {
      let content = cell.content || '';
      if (content.includes(',') || content.includes('"') || content.includes('\n')) {
        content = `"${content.replace(/"/g, '""')}"`;
      }
      
      const rSpan = cell.rowSpan || 1;
      const cSpan = cell.columnSpan || 1;
      for (let r = cell.rowIndex; r < cell.rowIndex + rSpan; r++) {
        for (let c = cell.columnIndex; c < cell.columnIndex + cSpan; c++) {
          if (r < table.rowCount && c < table.columnCount) {
            grid[r][c] = content;
          }
        }
      }
    });

    const csvContent = grid.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${file.name.split('.')[0]}_table_${index + 1}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Renders a grid-based preview of extracted table
  const renderTableGrid = (table) => {
    if (!table) return null;
    
    const grid = [];
    for (let r = 0; r < table.rowCount; r++) {
      grid.push(new Array(table.columnCount).fill(null));
    }
    
    const renderedSpans = new Set();

    table.cells.forEach(cell => {
      const rSpan = cell.rowSpan || 1;
      const cSpan = cell.columnSpan || 1;

      for (let r = cell.rowIndex; r < cell.rowIndex + rSpan; r++) {
        for (let c = cell.columnIndex; c < cell.columnIndex + cSpan; c++) {
          if (r !== cell.rowIndex || c !== cell.columnIndex) {
            renderedSpans.add(`${r}-${c}`);
          }
        }
      }
      
      if (cell.rowIndex < table.rowCount && cell.columnIndex < table.columnCount) {
        grid[cell.rowIndex][cell.columnIndex] = cell;
      }
    });

    return (
      <table className="data-table">
        <thead>
          <tr>
            {Array.from({ length: table.columnCount }).map((_, colIdx) => (
              <th key={`th-${colIdx}`}>Col {colIdx + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, rowIdx) => (
            <tr key={`tr-${rowIdx}`}>
              {row.map((cell, colIdx) => {
                if (renderedSpans.has(`${rowIdx}-${colIdx}`)) return null;
                
                if (!cell) {
                  return <td key={`cell-${rowIdx}-${colIdx}`} className="empty-cell"></td>;
                }

                const isHeader = cell.role === 'columnHeader' || cell.role === 'rowHeader';
                
                return (
                  <td 
                    key={`cell-${rowIdx}-${colIdx}`}
                    rowSpan={cell.rowSpan || 1}
                    colSpan={cell.columnSpan || 1}
                    style={{ 
                      fontWeight: isHeader ? 'bold' : 'normal',
                      background: isHeader ? 'rgba(255, 255, 255, 0.02)' : 'transparent' 
                    }}
                  >
                    {cell.content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // Simple Markdown Parsed Display for Document Text
  const renderParsedMarkdown = (markdownText) => {
    if (!markdownText) return <p className="text-muted">No text content found.</p>;

    const items = markdownText.split('\n');
    return (
      <div className="markdown-container">
        {items.map((line, idx) => {
          const trimmed = line.trim();
          
          if (!trimmed) {
            return <div key={idx} style={{ height: '0.75rem' }} />;
          }
          
          if (trimmed.startsWith('### ')) {
            return <h3 key={idx}>{trimmed.substring(4)}</h3>;
          }
          if (trimmed.startsWith('## ')) {
            return <h2 key={idx}>{trimmed.substring(3)}</h2>;
          }
          if (trimmed.startsWith('# ')) {
            return <h1 key={idx}>{trimmed.substring(2)}</h1>;
          }
          
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <ul key={idx} style={{ paddingLeft: '1.5rem', marginBottom: '0.5rem' }}>
                <li>{trimmed.substring(2)}</li>
              </ul>
            );
          }
          
          if (trimmed.startsWith('> ')) {
            return <blockquote key={idx}>{trimmed.substring(2)}</blockquote>;
          }
          
          let content = line;
          const boldRegex = /\*\*(.*?)\*\*/g;
          const parts = [];
          let lastIndex = 0;
          let match;
          
          while ((match = boldRegex.exec(line)) !== null) {
            if (match.index > lastIndex) {
              parts.push(line.substring(lastIndex, match.index));
            }
            parts.push(<strong key={match.index}>{match[1]}</strong>);
            lastIndex = boldRegex.lastIndex;
          }
          
          if (lastIndex < line.length) {
            parts.push(line.substring(lastIndex));
          }

          return (
            <p key={idx} className="markdown-section">
              {parts.length > 0 ? parts : line}
            </p>
          );
        })}
      </div>
    );
  };

  // Filter Key-Value Pairs
  const filteredKVs = analyzeResult?.keyValuePairs?.filter(pair => {
    if (!kvSearchQuery) return true;
    const keyText = pair.key?.content?.toLowerCase() || '';
    const valText = pair.value?.content?.toLowerCase() || '';
    return keyText.includes(kvSearchQuery.toLowerCase()) || valText.includes(kvSearchQuery.toLowerCase());
  }) || [];

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo-container">
          <FileText className="logo-icon" size={26} />
          <span className="logo-text">LegalDoc Analyzer</span>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="main-content">
        
        {/* Left Side: Upload & Control Panel */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* File Selection Box */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }} className="gradient-text">
              1. Document Upload
            </h3>
            
            <div 
              className={`dropzone ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input').click()}
            >
              <UploadCloud size={40} className="dropzone-icon" />
              <div>
                <p style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  Drag & drop file here
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  or click to select from files
                </p>
              </div>
              <input 
                id="file-input" 
                type="file" 
                style={{ display: 'none' }} 
                accept=".pdf,image/jpeg,image/png,image/tiff,image/bmp"
                onChange={handleFileChange}
              />
            </div>

            {/* Display Selected File Info */}
            {file && (
              <div style={{ 
                marginTop: '1.25rem', 
                padding: '0.85rem', 
                borderRadius: 'var(--radius-md)', 
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <FileText size={28} style={{ color: 'var(--primary)' }} />
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type.split('/')[1].toUpperCase()}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Model Options / Settings Panel */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }} className="gradient-text">
              2. Analysis Settings
            </h3>
            
            <div className="form-group">
              <label className="form-label">Analysis Model</label>
              <select 
                className="form-input" 
                style={{ background: '#090d16' }}
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
              >
                <option value="prebuilt-layout">Layout (Tables, Structure, Text)</option>
                <option value="prebuilt-read">Read (Optimized OCR, Text Only)</option>
              </select>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Info size={12} />
                Layout is recommended for property/legal documents.
              </p>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={!file || status === 'submitting' || status === 'polling'}
              onClick={handleAnalyze}
            >
              Start Analysis
            </button>
          </div>

          {/* Status Tracker */}
          {(status !== 'idle' || errorMessage) && (
            <div className="glass-panel">
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }} className="gradient-text">
                3. Operations Log
              </h3>
              
              <div className="progress-steps">
                <div className={`progress-step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
                  <div className="progress-step-icon">
                    {currentStep > 1 ? <CheckCircle2 size={16} /> : <ChevronRight size={16} />}
                  </div>
                  <span>Upload to backend server</span>
                </div>
                
                <div className={`progress-step ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
                  <div className="progress-step-icon">
                    {currentStep > 2 ? <CheckCircle2 size={16} /> : currentStep === 2 ? <div className="spinner-outer" style={{ width: '12px', height: '12px', borderWidth: '1.5px' }} /> : <ChevronRight size={16} />}
                  </div>
                  <span>Azure processing & analysis</span>
                </div>

                <div className={`progress-step ${currentStep >= 3 ? 'active' : ''}`}>
                  <div className="progress-step-icon">
                    {currentStep >= 3 ? <CheckCircle2 size={16} /> : <ChevronRight size={16} />}
                  </div>
                  <span>Done</span>
                </div>
              </div>

              {pollStatusText && status !== 'succeeded' && status !== 'failed' && (
                <div style={{ 
                  marginTop: '1rem', 
                  fontSize: '0.8rem', 
                  color: 'var(--text-secondary)',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)'
                }}>
                  {pollStatusText}
                </div>
              )}

              {status === 'failed' && (
                <div style={{ 
                  marginTop: '1rem', 
                  padding: '0.85rem', 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  color: '#f87171',
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'start'
                }}>
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>Error Occurred</p>
                    <p style={{ fontSize: '0.75rem', wordBreak: 'break-word', marginTop: '0.15rem' }}>{errorMessage}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Side: Results Workspace Panel */}
        <section className="glass-panel" style={{ minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
          
          {/* Empty State */}
          {status === 'idle' && !analyzeResult && (
            <div className="empty-state" style={{ flex: 1 }}>
              <UploadCloud size={60} className="empty-state-icon" />
              <h2 style={{ fontSize: '1.5rem', color: 'white', marginBottom: '0.5rem' }}>
                Legal Workspace Ready
              </h2>
              <p style={{ fontSize: '0.9rem', maxWidth: '420px', lineHeight: 1.5, margin: '0 auto 1.5rem' }}>
                Upload a property deed, mortgage, lease, or legal document, then click "Start Analysis" to extract key details.
              </p>
            </div>
          )}

          {/* Loading Panel */}
          {(status === 'submitting' || status === 'polling') && (
            <div className="loading-workspace" style={{ flex: 1 }}>
              <div className="spinner-container">
                <div className="spinner-outer"></div>
                <div className="spinner-inner"></div>
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Analyzing Document Structure</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                This might take a few seconds depending on document size and complexity.
              </p>
            </div>
          )}

          {/* Succeeded Result View */}
          {status === 'succeeded' && analyzeResult && (
            <div className="workspace-grid" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              
              {/* Tab Header Bar */}
              <div className="tabs-header">
                <button 
                  className={`tab-btn ${activeTab === 'text' ? 'active' : ''}`}
                  onClick={() => setActiveTab('text')}
                >
                  <FileText size={16} />
                  Document Text
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'kv' ? 'active' : ''}`}
                  onClick={() => setActiveTab('kv')}
                >
                  <Grid size={16} />
                  Key-Value Pairs ({analyzeResult.keyValuePairs?.length || 0})
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'tables' ? 'active' : ''}`}
                  onClick={() => setActiveTab('tables')}
                >
                  <TableIcon size={16} />
                  Tables ({analyzeResult.tables?.length || 0})
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'raw' ? 'active' : ''}`}
                  onClick={() => setActiveTab('raw')}
                >
                  <Code size={16} />
                  Raw Response
                </button>
              </div>

              {/* Dynamic Tab Body */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                
                {/* 1. DOCUMENT TEXT TAB */}
                {activeTab === 'text' && (
                  <div>
                    <div className="action-bar">
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Extracted text structures parsed to Markdown format.
                      </span>
                      <div className="actions-group">
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          onClick={() => handleCopyToClipboard(analyzeResult.content, 'text')}
                        >
                          {copiedStates['text'] ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                          {copiedStates['text'] ? 'Copied' : 'Copy'}
                        </button>
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          onClick={handleDownloadMarkdown}
                        >
                          <Download size={14} />
                          Download
                        </button>
                      </div>
                    </div>

                    <div style={{ 
                      background: 'rgba(0, 0, 0, 0.15)',
                      padding: '1.5rem', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border-color)',
                      maxHeight: '600px',
                      overflowY: 'auto'
                    }}>
                      {renderParsedMarkdown(analyzeResult.content)}
                    </div>
                  </div>
                )}

                {/* 2. KEY VALUE PAIRS TAB */}
                {activeTab === 'kv' && (
                  <div>
                    <div className="action-bar" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                      <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '240px' }}>
                        <div style={{ position: 'relative' }}>
                          <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                          <input 
                            type="text" 
                            className="form-input" 
                            style={{ paddingLeft: '2.3rem' }} 
                            placeholder="Filter key-value pairs (e.g. date, seller, price)..."
                            value={kvSearchQuery}
                            onChange={(e) => setKvSearchQuery(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => {
                          const kvString = filteredKVs.map(p => `${p.key?.content || ''}: ${p.value?.content || ''}`).join('\n');
                          handleCopyToClipboard(kvString, 'kv');
                        }}
                      >
                        {copiedStates['kv'] ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                        {copiedStates['kv'] ? 'Copy Filtered' : 'Copy All'}
                      </button>
                    </div>

                    {filteredKVs.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <Info size={32} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
                        <p style={{ fontSize: '0.9rem' }}>No matching key-value pairs found.</p>
                      </div>
                    ) : (
                      <div className="kv-grid" style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                        {filteredKVs.map((pair, index) => (
                          <div className="kv-card" key={`kv-${index}`}>
                            <div className="kv-key">{pair.key?.content || 'Unlabeled Key'}</div>
                            <div className="kv-val">{pair.value?.content || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. TABLES TAB */}
                {activeTab === 'tables' && (
                  <div>
                    {!analyzeResult.tables || analyzeResult.tables.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)' }}>
                        <Info size={40} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.5 }} />
                        <p style={{ fontSize: '0.95rem' }}>No structured data tables were detected in this document.</p>
                      </div>
                    ) : (
                      <div>
                        {/* Table Selector Row */}
                        <div className="action-bar" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                          <div className="table-selector-container">
                            {analyzeResult.tables.map((_, index) => (
                              <button
                                key={`table-sel-${index}`}
                                className={`table-select-btn ${selectedTableIndex === index ? 'active' : ''}`}
                                onClick={() => setSelectedTableIndex(index)}
                              >
                                Table {index + 1}
                              </button>
                            ))}
                          </div>

                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                            onClick={() => handleDownloadTableCSV(analyzeResult.tables[selectedTableIndex], selectedTableIndex)}
                          >
                            <Download size={14} />
                            Export Table {selectedTableIndex + 1} to CSV
                          </button>
                        </div>

                        {/* Selected Table Grid Display */}
                        <div className="table-wrapper" style={{ maxHeight: '550px' }}>
                          {renderTableGrid(analyzeResult.tables[selectedTableIndex])}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. RAW JSON RESPONSE TAB */}
                {activeTab === 'raw' && (
                  <div>
                    <div className="action-bar">
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Inspect the full, structural API payload returned by Azure Document Intelligence.
                      </span>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => handleCopyToClipboard(JSON.stringify(analyzeResult, null, 2), 'raw')}
                      >
                        {copiedStates['raw'] ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                        {copiedStates['raw'] ? 'Copied JSON' : 'Copy JSON'}
                      </button>
                    </div>

                    <div className="code-block-wrapper">
                      <pre className="code-block">
                        {JSON.stringify(analyzeResult, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
