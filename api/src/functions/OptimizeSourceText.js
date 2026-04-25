const { app } = require('@azure/functions');
const { GoogleGenerativeAI } = require('@google/generative-ai');

app.http('OptimizeSourceText', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { text } = body;

            if (!text) {
                return { status: 400, body: "Missing 'text' field." };
            }

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                return { status: 500, body: "Gemini API key is not configured." };
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const prompt = `You are an expert copyeditor. Rewrite the following text to fix any grammar errors, improve punctuation, and enhance clarity. 
Keep the core meaning exactly the same. Do not translate the text. Do not add any conversational filler. Return ONLY the improved text.

Original text:
"${text}"`;

            const result = await model.generateContent(prompt);
            const optimizedText = result.response.text().trim();

            return {
                jsonBody: {
                    originalText: text,
                    optimizedText: optimizedText
                }
            };
        } catch (error) {
            context.error('Error during AI source optimization:', error.message);
            return {
                status: 500,
                body: "An error occurred during AI source optimization: " + error.message
            };
        }
    }
});
