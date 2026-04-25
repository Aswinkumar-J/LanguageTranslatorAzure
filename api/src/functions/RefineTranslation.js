const { app } = require('@azure/functions');
const { GoogleGenerativeAI } = require('@google/generative-ai');

app.http('RefineTranslation', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { text, targetLanguage, tone } = body;

            if (!text || !targetLanguage || !tone) {
                return { status: 400, body: "Missing 'text', 'targetLanguage', or 'tone' field." };
            }

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                return { status: 500, body: "Gemini API key is not configured." };
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const prompt = `You are an expert translator and linguist. Rewrite the following text in ${targetLanguage} to have a ${tone} tone. Keep the core meaning exact but change the style and vocabulary to match the requested tone. Only return the rewritten text, without any conversational filler, explanations, or quotes.

Original text: ${text}`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text().trim();

            return {
                jsonBody: {
                    originalText: text,
                    refinedText: responseText,
                    tone: tone
                }
            };
        } catch (error) {
            context.error('Error during AI refinement:', error.message);
            return {
                status: 500,
                body: "An error occurred during AI refinement: " + error.message
            };
        }
    }
});
