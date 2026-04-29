const { app } = require('@azure/functions');
const { AzureOpenAI } = require('openai');

app.http('ExplainTranslation', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { originalText, translatedText, sourceLanguage, targetLanguage } = body;

            if (!originalText || !translatedText || !targetLanguage) {
                return { status: 400, body: "Missing required fields." };
            }

            const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
            const apiKey = process.env.AZURE_OPENAI_KEY;
            const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

            if (!endpoint || !apiKey || !deploymentName) {
                return { status: 500, body: "Azure OpenAI configuration is missing." };
            }

            const client = new AzureOpenAI({
                apiKey: apiKey,
                endpoint: endpoint,
                apiVersion: "2024-10-21"
            });

            const prompt = `You are an expert linguist and cultural guide. The user translated the following text from ${sourceLanguage || 'an unknown language'} to ${targetLanguage}.

Original Text: "${originalText}"
Translated Text: "${translatedText}"

Explain any interesting idioms, cultural nuances, or notable grammar choices in this translation. Keep the explanation concise (2-3 short paragraphs maximum), educational, and easy to understand. Do not repeat the prompt.`;

            const result = await client.chat.completions.create({
                model: deploymentName,
                messages: [{ role: "user", content: prompt }]
            });
            const explanationText = result.choices[0].message.content.trim();

            return {
                jsonBody: {
                    explanation: explanationText
                }
            };
        } catch (error) {
            context.error('Error during AI explanation:', error.message);
            return {
                status: 500,
                body: "An error occurred during AI explanation: " + error.message
            };
        }
    }
});
