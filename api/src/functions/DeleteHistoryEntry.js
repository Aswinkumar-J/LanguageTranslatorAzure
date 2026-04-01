const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');

app.http('DeleteHistoryEntry', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const partitionKey = request.query.get('partitionKey');
            const rowKey = request.query.get('rowKey');

            if (!partitionKey || !rowKey) {
                return { status: 400, body: "Missing 'partitionKey' or 'rowKey' query parameters." };
            }

            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            if (!connectionString) {
                return { status: 500, body: "Storage connection string is missing." };
            }

            const tableClient = TableClient.fromConnectionString(connectionString, "TranslationHistory");
            
            context.log(`Deleting entity: PartitionKey=${partitionKey}, RowKey=${rowKey}`);
            await tableClient.deleteEntity(partitionKey, rowKey);

            return {
                status: 204
            };
        } catch (error) {
            context.error('Error deleting history entry:', error.message);
            return {
                status: 500,
                body: "An error occurred while deleting history entry: " + error.message
            };
        }
    }
});
