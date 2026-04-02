import React, { useState, useRef } from 'react';
import { processDocument } from '../services/api';
import AudioPlayer from './AudioPlayer';

const LANGUAGES = [
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'zh-Hans', name: 'Chinese Simplified' },
    { code: 'hi', name: 'Hindi' },
    { code: 'ta', name: 'Tamil' },
    { code: 'ar', name: 'Arabic' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'it', name: 'Italian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' }
];

export default function FileUploadDropzone({ onTranslationSaved }) {
    const [file, setFile] = useState(null);
    const [targetLang, setTargetLang] = useState('es');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleDrop = (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const uploadedFile = e.dataTransfer.files[0];
            if (uploadedFile.type === 'application/pdf') {
                setFile(uploadedFile);
            } else {
                setError('Please upload a valid PDF document.');
            }
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);
        try {
            const data = await processDocument(file, targetLang);
            setResult(data);
            if (onTranslationSaved) onTranslationSaved();
        } catch (err) {
            setError(err.response?.data || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card file-upload-container glass-panel">
            <h2>Document Translation</h2>
            <div 
                className="dropzone" 
                onDragOver={handleDragOver} 
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="dropzone-content">
                    <span className="upload-icon">📄</span>
                    {file ? <p className="file-name">{file.name}</p> : <p>Drag & drop a PDF here, or click to browse</p>}
                </div>
                <input 
                    type="file" 
                    accept="application/pdf" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    style={{display: 'none'}} 
                />
            </div>
            
            <div className="controls-group mt-4">
                <select className="modern-select" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                    {LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                </select>
                <button 
                    onClick={handleUpload} 
                    disabled={loading || !file}
                    className="btn-primary"
                >
                    {loading ? 'Processing Document...' : 'Translate PDF'}
                </button>
            </div>

            {error && <div className="error-box">{error}</div>}

            {result && (
                <div className="result-box document-result fade-in">
                    <div className="result-header">
                        <span className="badge success">Detected: {result.detectedLanguage}</span>
                    </div>
                    <h4>Translated Text Snippet:</h4>
                    <p className="translated-text scrollable-text">{result.translatedText}</p>
                    
                    <div className="mt-3 action-buttons">
                        <AudioPlayer text={result.translatedText.substring(0, 500)} language={result.targetLanguage} />
                        
                        {result.translatedFileUrl && (
                            <a 
                                href={result.translatedFileUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="btn-primary download-btn"
                                style={{textDecoration: 'none', marginLeft: '10px'}}
                            >
                                📥 Download Translated PDF
                            </a>
                        )}
                        <span className="text-muted text-small ml-2" style={{display: 'block', marginTop: '10px'}}>
                            (Audio restricted to first 500 chars)
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
