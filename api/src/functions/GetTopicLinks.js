const { app } = require('@azure/functions');
const { AzureOpenAI } = require('openai');

app.http('GetTopicLinks', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { text, language } = body;

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

            const prompt = `Analyze the following text (written in ${language || 'unknown language'}): "${text}"

Identify the primary entities, locations, or topics mentioned in the text.
Generate 4 to 6 highly relevant, diverse web links related to these topics. 
CRITICAL: Do NOT just return Wikipedia links. Provide a rich variety of sources similar to a search engine results page. Include official websites, major news outlets, travel/tourism boards, or educational resources.

Output MUST be valid JSON in the following format:
[
  { "title": "...", "url": "...", "description": "..." },
  { "title": "...", "url": "...", "description": "..." }
]
Ensure the URLs are realistic, diverse, and correctly formatted.
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

            let links = [];
            try {
                links = JSON.parse(responseText);
            } catch (e) {
                context.error('Failed to parse AI response as JSON:', responseText);
                return { status: 500, body: "Failed to parse AI response." };
            }

            return {
                jsonBody: {
                    links
                }
            };
        } catch (error) {
            context.error('Error during generating topic links:', error.message);
            return {
                status: 500,
                body: "An error occurred during generating topic links: " + error.message
            };
        }
    }
});
