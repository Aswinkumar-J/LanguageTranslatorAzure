import React, { useState } from 'react';
import { translateText, refineTranslation } from '../services/api';
import AudioPlayer from './AudioPlayer';

const LANGUAGES = [
    { code: 'en', name: 'English' },
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

export default function TranslatorWidget({ onTranslationSaved }) {
    const [text, setText] = useState('');
    const [targetLang, setTargetLang] = useState('es');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // AI Refinement State
    const [tone, setTone] = useState('Professional');
    const [refinedResult, setRefinedResult] = useState(null);
    const [refining, setRefining] = useState(false);

    const TONES = ['Professional', 'Casual', 'Poetic', 'Humorous', 'Empathetic'];

    const handleTranslate = async () => {
        if (!text.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const data = await translateText(text, targetLang);
            setResult(data);
            if (onTranslationSaved) onTranslationSaved();
        } catch (err) {
            setError(err.response?.data || err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRefine = async () => {
        if (!result || !result.translatedText) return;
        setRefining(true);
        setError(null);
        try {
            const data = await refineTranslation(result.translatedText, result.targetLanguage, tone);
            setRefinedResult(data);
        } catch (err) {
            setError(err.response?.data || err.message);
        } finally {
            setRefining(false);
        }
    };

    return (
        <div className="card widget-container glass-panel">
            <h2>Text Translation</h2>
            <div className="input-group">
                <textarea 
                    placeholder="Enter text to translate..." 
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={4}
                    className="modern-input"
                />
            </div>
            
            <div className="controls-group">
                <select className="modern-select" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                    {LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                </select>
                <button 
                    onClick={handleTranslate} 
                    disabled={loading || !text.trim()}
                    className="btn-primary"
                >
                    {loading ? 'Translating...' : 'Translate'}
                </button>
            </div>

            {error && <div className="error-box">{error}</div>}

            {result && (
                <div className="result-box fade-in">
                    <div className="result-header">
                        <span className="badge success">Detected: {result.detectedLanguage}</span>
                    </div>
                    <p className="translated-text">{result.translatedText}</p>
                    <AudioPlayer text={result.translatedText} language={result.targetLanguage} />
                    
                    {/* AI Refinement Section */}
                    <div className="ai-refinement-section mt-4">
                        <div className="controls-group">
                            <select 
                                className="modern-select ai-tone-select" 
                                value={tone} 
                                onChange={(e) => setTone(e.target.value)}
                            >
                                {TONES.map(t => (
                                    <option key={t} value={t}>{t} Tone</option>
                                ))}
                            </select>
                            <button 
                                onClick={handleRefine} 
                                disabled={refining}
                                className="btn-ai-magic"
                            >
                                {refining ? 'Refining...' : 'Refine with AI ✨'}
                            </button>
                        </div>
                        
                        {refinedResult && (
                            <div className="refined-box fade-in mt-3">
                                <div className="result-header">
                                    <span className="badge ai-badge">✨ AI {refinedResult.tone} Tone</span>
                                </div>
                                <p className="translated-text ai-text">{refinedResult.refinedText}</p>
                                <AudioPlayer text={refinedResult.refinedText} language={result.targetLanguage} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
