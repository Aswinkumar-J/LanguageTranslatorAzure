import axios from 'axios';

const API_BASE = '/api';

export const translateText = async (text, targetLanguage) => {
    const response = await axios.post(`${API_BASE}/TranslateText`, { text, targetLanguage });
    return response.data;
};

export const processDocument = async (file, targetLanguage) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    
    const response = await axios.post(`${API_BASE}/ProcessDocument`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const synthesizeSpeech = async (text, language) => {
    const response = await axios.post(`${API_BASE}/SynthesizeSpeech`, { text, language }, {
        responseType: 'blob'
    });
    // Create a local object URL for the audio blob
    return URL.createObjectURL(response.data);
};

export const getHistory = async () => {
    const response = await axios.get(`${API_BASE}/GetHistory`);
    return response.data;
};

export const deleteHistoryEntry = async (id, type) => {
    const response = await axios.delete(`${API_BASE}/DeleteHistoryEntry`, {
        params: { rowKey: id, partitionKey: type }
    });
    return response.data;
};

export const refineTranslation = async (text, targetLanguage, tone) => {
    const response = await axios.post(`${API_BASE}/RefineTranslation`, { text, targetLanguage, tone });
    return response.data;
};

export const explainTranslation = async (originalText, translatedText, sourceLanguage, targetLanguage) => {
    const response = await axios.post(`${API_BASE}/ExplainTranslation`, { originalText, translatedText, sourceLanguage, targetLanguage });
    return response.data;
};

export const generateConversationStarters = async (translatedText, targetLanguage) => {
    const response = await axios.post(`${API_BASE}/GenerateConversationStarters`, { translatedText, targetLanguage });
    return response.data;
};
