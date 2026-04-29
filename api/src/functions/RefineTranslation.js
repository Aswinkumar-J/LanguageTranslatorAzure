const { app } = require('@azure/functions');
const { AzureOpenAI } = require('openai');

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

            const prompt = `You are an expert translator and linguist. Rewrite the following text in ${targetLanguage} to have a ${tone} tone. Keep the core meaning exact but change the style and vocabulary to match the requested tone. Only return the rewritten text, without any conversational filler, explanations, or quotes.

Original text: ${text}`;

            const result = await client.chat.completions.create({
                model: deploymentName,
                messages: [{ role: "user", content: prompt }]
            });
            const responseText = result.choices[0].message.content.trim();

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
