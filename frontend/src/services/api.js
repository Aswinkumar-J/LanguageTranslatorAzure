import axios from 'axios';

const API_BASE = '/api';

let authToken = null;

export const setAuthToken = (token) => {
    authToken = token;
    if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        delete api.defaults.headers.common['Authorization'];
    }
};

const api = axios.create({
    baseURL: API_BASE
});

export const translateText = async (text, targetLanguage) => {
    const response = await api.post('/TranslateText', { text, targetLanguage });
    return response.data;
};

export const processDocument = async (file, targetLanguage) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    
    const response = await api.post('/ProcessDocument', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const synthesizeSpeech = async (text, language) => {
    const response = await api.post('/SynthesizeSpeech', { text, language }, {
        responseType: 'blob'
    });
    return URL.createObjectURL(response.data);
};

export const getHistory = async () => {
    const response = await api.get('/GetHistory');
    return response.data;
};

export const deleteHistoryEntry = async (id, type) => {
    const response = await api.delete('/DeleteHistoryEntry', {
        params: { rowKey: id, partitionKey: type }
    });
    return response.data;
};

export const refineTranslation = async (text, targetLanguage, tone) => {
    const response = await api.post('/RefineTranslation', { text, targetLanguage, tone });
    return response.data;
};

export const explainTranslation = async (originalText, translatedText, sourceLanguage, targetLanguage) => {
    const response = await api.post('/ExplainTranslation', { originalText, translatedText, sourceLanguage, targetLanguage });
    return response.data;
};

export const generateConversationStarters = async (translatedText, targetLanguage) => {
    const response = await api.post('/GenerateConversationStarters', { translatedText, targetLanguage });
    return response.data;
};

export const optimizeSourceText = async (text) => {
    const response = await api.post('/OptimizeSourceText', { text });
    return response.data;
};

export const getTopicLinks = async (text, language) => {
    const response = await api.post('/GetTopicLinks', { text, language });
    return response.data;
};
