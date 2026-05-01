const appInsights = require('applicationinsights');
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
    appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
        .setAutoDependencyCorrelation(true)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true, true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .setAutoCollectConsole(true)
        .setUseDiskRetryCaching(true)
        .setSendLiveMetrics(true)
        .start();
    console.log('Application Insights initialized');
}

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { TableClient } = require('@azure/data-tables');
const pdf = require('pdf-parse');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const { AzureOpenAI } = require('openai');
const path = require('path');
const fs = require('fs');

// Load environment variables for local development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
    
    // Fallback: also try loading from local.settings.json
    const settingsPath = path.join(__dirname, 'local.settings.json');
    if (fs.existsSync(settingsPath)) {
        try {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            if (settings.Values) {
                Object.keys(settings.Values).forEach(key => {
                    if (!process.env[key]) {
                        process.env[key] = settings.Values[key];
                    }
                });
            }
        } catch (err) {
            console.error('Error loading local.settings.json:', err);
        }
    }
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
        console.log('Storage connection string loaded successfully');
    } else {
        console.warn('Storage connection string is missing from environment');
    }
}
const passport = require('passport');
const BearerStrategy = require('passport-azure-ad').BearerStrategy;


const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Public config endpoint for frontend to get Entra ID settings at runtime
app.get('/api/config', (req, res) => {
    res.json({
        clientId: process.env.ENTRA_ID_CLIENT_ID,
        tenantId: process.env.ENTRA_ID_TENANT_ID
    });
});

// --- Microsoft Entra ID Authentication ---
if (process.env.ENTRA_ID_CLIENT_ID && process.env.ENTRA_ID_TENANT_ID) {
    const options = {
        identityMetadata: "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
        clientID: process.env.ENTRA_ID_CLIENT_ID,
        validateIssuer: false,
        passReqToCallback: false,
        loggingLevel: 'info',
        audience: [process.env.ENTRA_ID_CLIENT_ID, `api://${process.env.ENTRA_ID_CLIENT_ID}`],
        allowMultiAudiencesInToken: true
    };

    const bearerStrategy = new BearerStrategy(options, (token, done) => {
        return done(null, token, token);
    });

    app.use(passport.initialize());
    passport.use(bearerStrategy);
    console.log('Microsoft Entra ID Authentication configured');
} else {
    console.warn('ENTRA_ID_CLIENT_ID or ENTRA_ID_TENANT_ID not found. API is running without authentication.');
}

const authenticate = (req, res, next) => {
    if (process.env.ENTRA_ID_CLIENT_ID && process.env.ENTRA_ID_TENANT_ID) {
        return passport.authenticate('oauth-bearer', { session: false })(req, res, next);
    }
    next();
};

const upload = multer({ storage: multer.memoryStorage() });

// --- TranslateText ---
app.post('/api/TranslateText', authenticate, async (req, res) => {
    try {
        const { text, targetLanguage } = req.body;
        if (!text || !targetLanguage) {
            return res.status(400).send("Missing 'text' or 'targetLanguage' field.");
        }

        const translatorKey = process.env.TRANSLATOR_KEY;
        const endpoint = process.env.TRANSLATOR_ENDPOINT;
        const region = process.env.TRANSLATOR_REGION;

        if (!translatorKey) return res.status(500).send("Translator configuration is missing.");

        const url = `${endpoint}/translate?api-version=3.0&to=${targetLanguage}`;
        const response = await axios.post(url, [{ 'text': text }], {
            headers: {
                'Ocp-Apim-Subscription-Key': translatorKey,
                'Ocp-Apim-Subscription-Region': region,
                'Content-type': 'application/json',
                'X-ClientTraceId': uuidv4().toString()
            }
        });

        const translationResult = response.data[0];
        const translatedText = translationResult.translations[0].text;
        const detectedLanguage = translationResult.detectedLanguage?.language || 'unknown';

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
            console.warn('Failed to save history to Table Storage', err);
        }

        res.json({
            originalText: text,
            translatedText,
            detectedLanguage,
            targetLanguage
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred during translation: " + error.message);
    }
});

// --- GetHistory ---
app.get('/api/GetHistory', authenticate, async (req, res) => {
    try {
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (!connectionString) return res.status(500).send("Storage connection string is missing.");

        const tableClient = TableClient.fromConnectionString(connectionString, "TranslationHistory");
        await tableClient.createTable();
        
        const entities = tableClient.listEntities();
        const history = [];
        
        for await (const entity of entities) {
            history.push({
                id: entity.rowKey,
                type: entity.partitionKey,
                originalText: entity.originalText || entity.originalFileName,
                originalFileName: entity.originalFileName,
                translatedText: entity.translatedText,
                translatedFileUrl: entity.translatedFileUrl,
                sourceLanguage: entity.sourceLanguage,
                targetLanguage: entity.targetLanguage,
                timestamp: entity.timestamp
            });
        }

        history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        res.json(history);
    } catch (error) {
        res.status(500).send("An error occurred while retrieving history: " + error.message);
    }
});

// --- ProcessDocument ---
app.post('/api/ProcessDocument', authenticate, upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        const targetLanguage = req.body.targetLanguage;

        if (!file || !targetLanguage) {
            return res.status(400).send("Missing 'file' or 'targetLanguage' field.");
        }

        const pdfData = await pdf(file.buffer);
        const extractedText = pdfData.text;

        const translatorKey = process.env.TRANSLATOR_KEY;
        const endpoint = process.env.TRANSLATOR_ENDPOINT;
        const region = process.env.TRANSLATOR_REGION;

        if (!translatorKey) return res.status(500).send("Translator configuration is missing.");

        const url = `${endpoint}/translate?api-version=3.0&to=${targetLanguage}`;
        
        let translatedText = '';
        let detectedLanguage = 'unknown';
        const chunkSize = 5000;
        const chunks = [];
        for (let i = 0; i < extractedText.length; i += chunkSize) {
            chunks.push(extractedText.substring(i, i + chunkSize));
        }

        for (const chunk of chunks) {
            const response = await axios.post(url, [{ 'text': chunk }], {
                headers: {
                    'Ocp-Apim-Subscription-Key': translatorKey,
                    'Ocp-Apim-Subscription-Region': region,
                    'Content-type': 'application/json',
                    'X-ClientTraceId': uuidv4().toString()
                }
            });
            const result = response.data[0];
            translatedText += result.translations[0].text + '\n';
            if (detectedLanguage === 'unknown' && result.detectedLanguage) {
                detectedLanguage = result.detectedLanguage.language;
            }
        }

        try {
            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            if (connectionString) {
                const tableClient = TableClient.fromConnectionString(connectionString, "TranslationHistory");
                await tableClient.createTable();
                await tableClient.createEntity({
                    partitionKey: "pdf_translation",
                    rowKey: uuidv4(),
                    originalFileName: file.originalname,
                    originalText: extractedText.substring(0, 30000),
                    translatedText: translatedText.substring(0, 30000),
                    sourceLanguage: detectedLanguage,
                    targetLanguage,
                    timestamp: new Date()
                });
            }
        } catch (err) {
            console.warn('Failed to save history', err);
        }

        res.json({
            originalText: extractedText.substring(0, 1000),
            translatedText,
            detectedLanguage,
            targetLanguage
        });
    } catch (error) {
        res.status(500).send("Error processing document: " + error.message);
    }
});

// --- SynthesizeSpeech ---
app.post('/api/SynthesizeSpeech', authenticate, async (req, res) => {
    try {
        const { text, language } = req.body;
        if (!text) return res.status(400).send("Missing 'text' field.");

        const speechKey = process.env.SPEECH_KEY;
        const speechRegion = process.env.SPEECH_REGION;

        if (!speechKey || !speechRegion) return res.status(500).send("Speech Service configuration missing.");

        const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
        
        if (language && language.length === 2) {
            const langMap = {
                'en': 'en-US', 'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE',
                'hi': 'hi-IN', 'ta': 'ta-IN', 'it': 'it-IT', 'ja': 'ja-JP',
                'ko': 'ko-KR', 'ar': 'ar-SA'
            };
            speechConfig.speechSynthesisLanguage = langMap[language] || 'en-US';
        } else if (language) {
            speechConfig.speechSynthesisLanguage = language;
        }

        const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);

        synthesizer.speakTextAsync(
            text,
            result => {
                synthesizer.close();
                if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                    res.set('Content-Type', 'audio/wav');
                    res.send(Buffer.from(result.audioData));
                } else {
                    res.status(500).send(`Speech synthesis canceled: ${result.errorDetails}`);
                }
            },
            error => {
                synthesizer.close();
                res.status(500).send(error.toString());
            }
        );
    } catch (error) {
        res.status(500).send("Error synthesizing speech: " + error.message);
    }
});

// --- DeleteHistoryEntry ---
app.delete('/api/DeleteHistoryEntry', authenticate, async (req, res) => {
    try {
        const { partitionKey, rowKey } = req.query;
        if (!partitionKey || !rowKey) return res.status(400).send("Missing query parameters.");

        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (!connectionString) return res.status(500).send("Storage connection string missing.");

        const tableClient = TableClient.fromConnectionString(connectionString, "TranslationHistory");
        await tableClient.deleteEntity(partitionKey, rowKey);

        res.status(204).send();
    } catch (error) {
        res.status(500).send("Error deleting history entry: " + error.message);
    }
});

// --- Azure OpenAI client helper ---
const getOpenAIClient = () => {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_KEY;
    if (!endpoint || !apiKey) throw new Error("Azure OpenAI endpoint or key is not configured.");
    return new AzureOpenAI({
        apiKey: apiKey,
        endpoint: endpoint,
        apiVersion: "2024-10-21"
    });
};

const getDeploymentName = () => {
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    if (!deploymentName) throw new Error("Azure OpenAI deployment name is not configured.");
    return deploymentName;
};

// --- RefineTranslation ---
app.post('/api/RefineTranslation', authenticate, async (req, res) => {
    try {
        const { text, targetLanguage, tone } = req.body;
        if (!text || !targetLanguage || !tone) return res.status(400).send("Missing fields.");

        const client = getOpenAIClient();
        const deploymentName = getDeploymentName();
        const prompt = `You are an expert translator and linguist. Rewrite the following text in ${targetLanguage} to have a ${tone} tone. Keep the core meaning exact but change the style and vocabulary to match the requested tone. Only return the rewritten text, without any conversational filler, explanations, or quotes.\n\nOriginal text: ${text}`;
        
        const result = await client.chat.completions.create({
            model: deploymentName,
            messages: [{ role: "user", content: prompt }]
        });
        const responseText = result.choices[0].message.content.trim();
        res.json({ originalText: text, refinedText: responseText, tone });
    } catch (error) {
        res.status(500).send("Error during AI refinement: " + error.message);
    }
});

// --- ExplainTranslation ---
app.post('/api/ExplainTranslation', authenticate, async (req, res) => {
    try {
        const { originalText, translatedText, sourceLanguage, targetLanguage } = req.body;
        if (!originalText || !translatedText || !targetLanguage) return res.status(400).send("Missing fields.");

        const client = getOpenAIClient();
        const deploymentName = getDeploymentName();
        const prompt = `You are an expert linguist and cultural guide. The user translated the following text from ${sourceLanguage || 'an unknown language'} to ${targetLanguage}.\n\nOriginal Text: "${originalText}"\nTranslated Text: "${translatedText}"\n\nExplain any interesting idioms, cultural nuances, or notable grammar choices in this translation. Keep the explanation concise (2-3 short paragraphs maximum), educational, and easy to understand. Do not repeat the prompt.`;
        
        const result = await client.chat.completions.create({
            model: deploymentName,
            messages: [{ role: "user", content: prompt }]
        });
        const responseText = result.choices[0].message.content.trim();
        res.json({ explanation: responseText });
    } catch (error) {
        res.status(500).send("Error during AI explanation: " + error.message);
    }
});

// --- GenerateConversationStarters ---
app.post('/api/GenerateConversationStarters', authenticate, async (req, res) => {
    try {
        const { translatedText, targetLanguage } = req.body;
        if (!translatedText || !targetLanguage) return res.status(400).send("Missing fields.");

        const client = getOpenAIClient();
        const deploymentName = getDeploymentName();
        const prompt = `Based on the following statement translated into ${targetLanguage}: "${translatedText}"\n\nSuggest 3 natural follow-up phrases or questions that someone might say next in a conversation. \nOutput MUST be valid JSON in the following format:\n[\n  { "targetPhrase": "...", "sourceTranslation": "..." },\n  { "targetPhrase": "...", "sourceTranslation": "..." },\n  { "targetPhrase": "...", "sourceTranslation": "..." }\n]\nDo not include any Markdown formatting or text outside the JSON array.`;
        
        const result = await client.chat.completions.create({
            model: deploymentName,
            messages: [{ role: "user", content: prompt }]
        });
        let responseText = result.choices[0].message.content.trim().replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
        
        const starters = JSON.parse(responseText);
        res.json({ starters });
    } catch (error) {
        res.status(500).send("Error generating conversation starters: " + error.message);
    }
});

// --- OptimizeSourceText ---
app.post('/api/OptimizeSourceText', authenticate, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).send("Missing 'text' field.");

        const client = getOpenAIClient();
        const deploymentName = getDeploymentName();
        const prompt = `You are an expert copyeditor. Rewrite the following text to fix any grammar errors, improve punctuation, and enhance clarity. \nKeep the core meaning exactly the same. Do not translate the text. Do not add any conversational filler. Return ONLY the improved text.\n\nOriginal text:\n"${text}"`;
        
        const result = await client.chat.completions.create({
            model: deploymentName,
            messages: [{ role: "user", content: prompt }]
        });
        const responseText = result.choices[0].message.content.trim();
        res.json({ originalText: text, optimizedText: responseText });
    } catch (error) {
        res.status(500).send("Error during AI source optimization: " + error.message);
    }
});

// --- GetTopicLinks ---
app.post('/api/GetTopicLinks', authenticate, async (req, res) => {
    try {
        const { text, language } = req.body;
        if (!text) return res.status(400).send("Missing 'text' field.");

        const client = getOpenAIClient();
        const deploymentName = getDeploymentName();
        const prompt = `Analyze the following text (written in ${language || 'unknown language'}): "${text}"\n\nIdentify the primary entities, locations, or topics mentioned in the text.\nGenerate 4 to 6 highly relevant Wikipedia links related to these topics. \n\nOutput MUST be valid JSON in the following format:\n[\n  { "title": "...", "url": "...", "description": "..." },\n  { "title": "...", "url": "...", "description": "..." }\n]\nEnsure the URLs are valid Wikipedia links and correctly formatted.\nDo not include any Markdown formatting or text outside the JSON array.`;
        
        const result = await client.chat.completions.create({
            model: deploymentName,
            messages: [{ role: "user", content: prompt }]
        });
        let responseText = result.choices[0].message.content.trim().replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
        
        const links = JSON.parse(responseText);
        res.json({ links });
    } catch (error) {
        res.status(500).send("Error generating topic links: " + error.message);
    }
});

// --- Serve Frontend React Build ---
// Serve static files from the React build directory
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Catch-all to serve index.html for React Router
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Express server listening on port ${port}`);
});
