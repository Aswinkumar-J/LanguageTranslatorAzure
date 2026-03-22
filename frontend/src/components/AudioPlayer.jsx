import React, { useState } from 'react';
import { synthesizeSpeech } from '../services/api';

export default function AudioPlayer({ text, language }) {
    const [loading, setLoading] = useState(false);
    const [audioUrl, setAudioUrl] = useState(null);
    const [error, setError] = useState(null);

    const handlePlay = async () => {
        if (audioUrl) {
            return;
        }
        
        setLoading(true);
        setError(null);
        try {
            const url = await synthesizeSpeech(text, language);
            setAudioUrl(url);
            
            const audio = new Audio(url);
            audio.play();
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
                <audio controls src={audioUrl}>
                    Your browser does not support the audio element.
                </audio>
            )}
            {error && <span className="error-text">{error}</span>}
        </div>
    );
}
