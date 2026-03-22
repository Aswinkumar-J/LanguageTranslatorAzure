import React, { useEffect, useState } from 'react';
import { getHistory } from '../services/api';

export default function HistorySidebar({ refreshTrigger }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const data = await getHistory();
            setHistory(data);
        } catch (err) {
            setError(err.message || 'Failed to load history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [refreshTrigger]);

    return (
        <div className="card history-sidebar glass-panel">
            <h3>Translation History</h3>
            {loading ? (
                <p>Loading history...</p>
            ) : error ? (
                <p className="error-text">No Azure credentials found. Translation history depends on Azure Table Storage to be configured.</p>
            ) : history.length === 0 ? (
                <p className="text-muted">No translation history yet.</p>
            ) : (
                <ul className="history-list">
                    {history.map((item) => (
                        <li key={item.id} className="history-item">
                            <div className="history-meta">
                                <span className="small-badge">{item.type === 'pdf_translation' ? 'PDF' : 'Text'}</span>
                                <span className="history-lang">{item.sourceLanguage} → {item.targetLanguage}</span>
                            </div>
                            <p className="history-original text-truncate">{item.originalText || item.originalFileName}</p>
                            <p className="history-translated text-truncate">{item.translatedText}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
