const { app } = require('@azure/functions');
const { AzureOpenAI } = require('openai');

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

            const prompt = `You are an expert copyeditor. Rewrite the following text to fix any grammar errors, improve punctuation, and enhance clarity. 
Keep the core meaning exactly the same. Do not translate the text. Do not add any conversational filler. Return ONLY the improved text.

Original text:
"${text}"`;

            const result = await client.chat.completions.create({
                model: deploymentName,
                messages: [{ role: "user", content: prompt }]
            });
            const optimizedText = result.choices[0].message.content.trim();

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
