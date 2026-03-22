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
