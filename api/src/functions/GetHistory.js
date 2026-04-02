const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');

app.http('GetHistory', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            if (!connectionString) {
                return { status: 500, body: "Storage connection string is missing." };
            }

            const tableClient = TableClient.fromConnectionString(connectionString, "TranslationHistory");
            await tableClient.createTable();
            
            const entities = tableClient.listEntities();
            const history = [];
            
            for await (const entity of entities) {
                history.push({
                    id: entity.rowKey,
                    type: entity.partitionKey,
                    originalText: entity.originalText || entity.originalFileName, // Keep fallback for existing entries
                    originalFileName: entity.originalFileName, // Added this
                    translatedText: entity.translatedText,
                    translatedFileUrl: entity.translatedFileUrl,
                    sourceLanguage: entity.sourceLanguage,
                    targetLanguage: entity.targetLanguage,
                    timestamp: entity.timestamp
                });
            }

            // Sort by descending timestamp
            history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            return {
                jsonBody: history
            };
        } catch (error) {
            context.error('Error retrieving history:', error.message);
            return {
                status: 500,
                body: "An error occurred while retrieving history: " + error.message
            };
        }
    }
});
