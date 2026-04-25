const { app } = require('@azure/functions');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                return { status: 500, body: "Gemini API key is not configured." };
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            // using the model identifier we established works
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const prompt = `You are an expert linguist and cultural guide. The user translated the following text from ${sourceLanguage || 'an unknown language'} to ${targetLanguage}.

Original Text: "${originalText}"
Translated Text: "${translatedText}"

Explain any interesting idioms, cultural nuances, or notable grammar choices in this translation. Keep the explanation concise (2-3 short paragraphs maximum), educational, and easy to understand. Do not repeat the prompt.`;

            const result = await model.generateContent(prompt);
            const explanationText = result.response.text().trim();

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
