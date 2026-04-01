import React, { useEffect, useState } from 'react';
import { getHistory } from '../services/api';

export default function HistorySidebar({ refreshTrigger }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

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
        setCurrentPage(1); // Reset to first page when new translation is added
    }, [refreshTrigger]);

    const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE);
    const paginatedHistory = history.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    return (
        <>
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
                        {paginatedHistory.map((item) => (
                            <li key={item.id} className="history-item" onClick={() => setSelectedItem(item)}>
                                <div className="history-meta">
                                    <span className="small-badge">{item.type === 'pdf_translation' ? 'PDF' : 'Text'}</span>
                                    <span className="history-lang">{item.sourceLanguage} → {item.targetLanguage}</span>
                                </div>
                                <p className="history-original">{item.originalText || item.originalFileName}</p>
                                <p className="history-translated">{item.translatedText}</p>
                            </li>
                        ))}
                    </ul>
                )}

                {history.length > ITEMS_PER_PAGE && (
                    <div className="pagination-container">
                        <button 
                            className="pagination-btn pagination-arrow" 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                        >
                            Prev
                        </button>
                        
                        {[...Array(totalPages)].map((_, index) => (
                            <button 
                                key={index + 1}
                                className={`pagination-btn ${currentPage === index + 1 ? 'active' : ''}`}
                                onClick={() => setCurrentPage(index + 1)}
                            >
                                {index + 1}
                            </button>
                        ))}

                        <button 
                            className="pagination-btn pagination-arrow" 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {selectedItem && (
                <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Translation Detail</h3>
                            <button className="modal-close" onClick={() => setSelectedItem(null)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="modal-section">
                                <div className="modal-section-header">
                                    <span className="modal-label">Original ({selectedItem.sourceLanguage})</span>
                                    <button 
                                        className="copy-btn" 
                                        onClick={() => copyToClipboard(selectedItem.originalText || selectedItem.originalFileName)}
                                    >
                                        Copy
                                    </button>
                                </div>
                                <div className="modal-text-box">
                                    {selectedItem.originalText || selectedItem.originalFileName}
                                </div>
                            </div>

                            <div className="modal-section">
                                <div className="modal-section-header">
                                    <span className="modal-label">Translated ({selectedItem.targetLanguage})</span>
                                    <button 
                                        className="copy-btn" 
                                        onClick={() => copyToClipboard(selectedItem.translatedText)}
                                    >
                                        Copy
                                    </button>
                                </div>
                                <div className="modal-text-box">
                                    {selectedItem.translatedText}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
