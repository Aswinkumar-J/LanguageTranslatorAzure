const { app } = require('@azure/functions');
const axios = require('axios');
const pdf = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const { TableClient } = require('@azure/data-tables');

app.http('ProcessDocument', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const formData = await request.formData();
            const file = formData.get('file');
            const targetLanguage = formData.get('targetLanguage');

            if (!file || !targetLanguage) {
                return { status: 400, body: "Missing 'file' or 'targetLanguage' field." };
            }

            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Extract text using pdf-parse
            const pdfData = await pdf(buffer);
            const extractedText = pdfData.text;

            // Translate the text
            const translatorKey = process.env.TRANSLATOR_KEY;
            const endpoint = process.env.TRANSLATOR_ENDPOINT;
            const region = process.env.TRANSLATOR_REGION;

            if (!translatorKey) {
                return { status: 500, body: "Translator configuration is missing." };
            }

            const url = `${endpoint}/translate?api-version=3.0&to=${targetLanguage}`;
            
            // Azure Translator has a limit of 50,000 characters per request.
            let translatedText = '';
            let detectedLanguage = 'unknown';

            const chunkSize = 5000;
            const chunks = [];
            for (let i = 0; i < extractedText.length; i += chunkSize) {
                chunks.push(extractedText.substring(i, i + chunkSize));
            }

            for (const chunk of chunks) {
                const response = await axios({
                    baseURL: url,
                    method: 'post',
                    headers: {
                        'Ocp-Apim-Subscription-Key': translatorKey,
                        'Ocp-Apim-Subscription-Region': region,
                        'Content-type': 'application/json',
                        'X-ClientTraceId': uuidv4().toString()
                    },
                    data: [{ 'text': chunk }],
                    responseType: 'json'
                });
                const result = response.data[0];
                translatedText += result.translations[0].text + '\n';
                if (detectedLanguage === 'unknown' && result.detectedLanguage) {
                    detectedLanguage = result.detectedLanguage.language;
                }
            }

            // Save history
            try {
                const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
                if (connectionString) {
                    const tableClient = TableClient.fromConnectionString(connectionString, "TranslationHistory");
                    await tableClient.createTable();
                    await tableClient.createEntity({
                        partitionKey: "pdf_translation",
                        rowKey: uuidv4(),
                        originalFileName: file.name,
                        translatedText: translatedText.substring(0, 30000), // Ensure we don't exceed Table Storage 32KB limit
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
                    originalText: extractedText.substring(0, 1000), // Return sample
                    translatedText,
                    detectedLanguage,
                    targetLanguage
                }
            };
        } catch (error) {
            context.error('Error processing document:', error.message);
            return {
                status: 500,
                body: "An error occurred during document translation: " + error.message
            };
        }
    }
});
