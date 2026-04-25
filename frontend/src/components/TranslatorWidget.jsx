import React, { useState } from 'react';
import { translateText, refineTranslation, explainTranslation, generateConversationStarters, optimizeSourceText } from '../services/api';
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
    const [optimizing, setOptimizing] = useState(false);
    
    // AI Refinement State
    const [tone, setTone] = useState('Professional');
    const [refinedResult, setRefinedResult] = useState(null);
    const [refining, setRefining] = useState(false);
    
    // AI Explanation State
    const [explanation, setExplanation] = useState(null);
    const [explaining, setExplaining] = useState(false);

    // AI Starters State
    const [starters, setStarters] = useState([]);
    const [generatingStarters, setGeneratingStarters] = useState(false);

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

    const handleOptimize = async () => {
        if (!text.trim()) return;
        setOptimizing(true);
        setError(null);
        try {
            const data = await optimizeSourceText(text);
            if (data.optimizedText) {
                setText(data.optimizedText);
            }
        } catch (err) {
            setError(err.response?.data || err.message);
        } finally {
            setOptimizing(false);
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

    const handleExplain = async () => {
        if (!result || !result.translatedText) return;
        setExplaining(true);
        setError(null);
        try {
            const data = await explainTranslation(
                result.originalText, 
                result.translatedText, 
                result.detectedLanguage, 
                result.targetLanguage
            );
            setExplanation(data.explanation);
        } catch (err) {
            setError(err.response?.data || err.message);
        } finally {
            setExplaining(false);
        }
    };

    const handleGenerateStarters = async () => {
        if (!result || !result.translatedText) return;
        setGeneratingStarters(true);
        setError(null);
        try {
            const data = await generateConversationStarters(result.translatedText, result.targetLanguage);
            setStarters(data.starters || []);
        } catch (err) {
            setError(err.response?.data || err.message);
        } finally {
            setGeneratingStarters(false);
        }
    };

    const handleStarterClick = (targetPhrase) => {
        setText(targetPhrase);
        // We set the target lang back to English to translate the follow up? 
        // Actually, let's just populate the input. The user can switch languages if they want.
    };

    return (
        <div className="card widget-container glass-panel">
            <h2>Text Translation</h2>
            <div className="input-group" style={{ position: 'relative' }}>
                <textarea 
                    placeholder="Enter text to translate..." 
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={4}
                    className="modern-input"
                />
                {text.trim() && (
                    <button 
                        onClick={handleOptimize} 
                        disabled={optimizing}
                        className="btn-ai-optimize"
                        title="Fix grammar and improve clarity"
                    >
                        {optimizing ? '✨' : 'Optimize ✨'}
                    </button>
                )}
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
                            <button 
                                onClick={handleExplain} 
                                disabled={explaining}
                                className="btn-ai-explain"
                                title="Explain idioms or cultural nuances"
                            >
                                {explaining ? 'Explaining...' : 'Explain Nuance 💡'}
                            </button>
                            <button 
                                onClick={handleGenerateStarters} 
                                disabled={generatingStarters}
                                className="btn-ai-starter"
                                title="Suggest follow-up phrases"
                            >
                                {generatingStarters ? 'Thinking...' : 'Suggest Follow-ups 💬'}
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

                        {explanation && (
                            <div className="explanation-box fade-in mt-3">
                                <div className="result-header">
                                    <span className="badge explain-badge">💡 Nuance Explained</span>
                                </div>
                                <div className="explanation-text">{explanation}</div>
                            </div>
                        )}

                        {starters && starters.length > 0 && (
                            <div className="starters-container fade-in mt-3">
                                <div className="result-header">
                                    <span className="badge starter-badge">💬 Suggested Follow-ups</span>
                                </div>
                                <div className="starters-list">
                                    {starters.map((starter, idx) => (
                                        <div 
                                            key={idx} 
                                            className="starter-chip"
                                            onClick={() => handleStarterClick(starter.targetPhrase)}
                                            title="Click to use this phrase"
                                        >
                                            <div className="starter-target">{starter.targetPhrase}</div>
                                            <div className="starter-source">{starter.sourceTranslation}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
