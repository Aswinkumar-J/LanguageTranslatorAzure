import React, { useState, useEffect } from 'react';
import { synthesizeSpeech } from '../services/api';

export default function AudioPlayer({ text, language }) {
    const [loading, setLoading] = useState(false);
    const [audioUrl, setAudioUrl] = useState(null);
    const [error, setError] = useState(null);

    // Reset state when text or language changes
    useEffect(() => {
        setAudioUrl(null);
        setError(null);
    }, [text, language]);

    // Cleanup audio URL when component unmounts or text/language changes
    useEffect(() => {
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    const handlePlay = async () => {
        if (audioUrl) {
            return;
        }
        
        setLoading(true);
        setError(null);
        try {
            const url = await synthesizeSpeech(text, language);
            setAudioUrl(url);
            // We don't call audio.play() manually here to avoid double-playing.
            // The <audio autoPlay> tag below will handle it once the URL is set.
        } catch (err) {
            setError('Failed to load audio');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="audio-player">
            {!audioUrl ? (
                <button className="btn-secondary play-btn" onClick={handlePlay} disabled={loading}>
                    {loading ? 'Generating audio...' : '🔊 Play Audio'}
                </button>
            ) : (
                <audio controls src={audioUrl} autoPlay>
                    Your browser does not support the audio element.
                </audio>
            )}
            {error && <span className="error-text">{error}</span>}
        </div>
    );
}
