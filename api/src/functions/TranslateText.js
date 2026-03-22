const { app } = require('@azure/functions');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { TableClient } = require('@azure/data-tables');

app.http('TranslateText', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { text, targetLanguage } = body;

            if (!text || !targetLanguage) {
                return { status: 400, body: "Missing 'text' or 'targetLanguage' field." };
            }

            const translatorKey = process.env.TRANSLATOR_KEY;
            const endpoint = process.env.TRANSLATOR_ENDPOINT;
            const region = process.env.TRANSLATOR_REGION;

            if (!translatorKey) {
                return { status: 500, body: "Translator configuration is missing." };
            }

            const url = `${endpoint}/translate?api-version=3.0&to=${targetLanguage}`;
            
            const response = await axios({
                baseURL: url,
                method: 'post',
                headers: {
                    'Ocp-Apim-Subscription-Key': translatorKey,
                    'Ocp-Apim-Subscription-Region': region,
                    'Content-type': 'application/json',
                    'X-ClientTraceId': uuidv4().toString()
                },
                data: [{ 'text': text }],
                responseType: 'json'
            });

            const translationResult = response.data[0];
            const translatedText = translationResult.translations[0].text;
            const detectedLanguage = translationResult.detectedLanguage?.language || 'unknown';

            // Save history
            try {
                const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
                if (connectionString) {
                    const tableClient = TableClient.fromConnectionString(connectionString, "TranslationHistory");
                    await tableClient.createTable();
                    await tableClient.createEntity({
                        partitionKey: "text_translation",
                        rowKey: uuidv4(),
                        originalText: text,
                        translatedText,
                        sourceLanguage: detectedLanguage,
                        targetLanguage,
                        timestamp: new Date()
                    });
                }
            } catch (err) {
                context.warn('Failed to save history to Table Storage', err);
            }

            return {
                jsonBody: {
                    originalText: text,
                    translatedText,
                    detectedLanguage,
                    targetLanguage
                }
            };
        } catch (error) {
            context.error('Error during translation:', error.message);
            return {
                status: 500,
                body: "An error occurred during translation: " + error.message
            };
        }
    }
});
