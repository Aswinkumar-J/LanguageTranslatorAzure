const { app } = require('@azure/functions');
const { AzureOpenAI } = require('openai');

app.http('GenerateConversationStarters', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { translatedText, targetLanguage } = body;

            if (!translatedText || !targetLanguage) {
                return { status: 400, body: "Missing 'translatedText' or 'targetLanguage' field." };
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

            const prompt = `Based on the following statement translated into ${targetLanguage}: "${translatedText}"

Suggest 3 natural follow-up phrases or questions that someone might say next in a conversation. 
Output MUST be valid JSON in the following format:
[
  { "targetPhrase": "...", "sourceTranslation": "..." },
  { "targetPhrase": "...", "sourceTranslation": "..." },
  { "targetPhrase": "...", "sourceTranslation": "..." }
]
Do not include any Markdown formatting or text outside the JSON array.`;

            const result = await client.chat.completions.create({
                model: deploymentName,
                messages: [{ role: "user", content: prompt }]
            });
            let responseText = result.choices[0].message.content.trim();
            
            // Clean up any potential markdown code blocks
            if (responseText.startsWith('```json')) {
                responseText = responseText.replace(/^```json/, '').replace(/```$/, '').trim();
            } else if (responseText.startsWith('```')) {
                responseText = responseText.replace(/^```/, '').replace(/```$/, '').trim();
            }

            let starters = [];
            try {
                starters = JSON.parse(responseText);
            } catch (e) {
                context.error('Failed to parse AI response as JSON:', responseText);
                return { status: 500, body: "Failed to parse AI response." };
            }

            return {
                jsonBody: {
                    starters
                }
            };
        } catch (error) {
            context.error('Error during generating conversation starters:', error.message);
            return {
                status: 500,
                body: "An error occurred during generating conversation starters: " + error.message
            };
        }
    }
});
