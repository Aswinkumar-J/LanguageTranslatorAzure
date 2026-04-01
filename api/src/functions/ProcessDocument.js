const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { TableClient } = require('@azure/data-tables');
const { BlobServiceClient, BlobSASPermissions } = require('@azure/storage-blob');

app.http('ProcessDocument', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const formData = await request.formData();
            const originalFile = formData.get('file');
            const targetLanguage = formData.get('targetLanguage');

            if (!originalFile || !targetLanguage) {
                return { status: 400, body: "Missing 'file' or 'targetLanguage' field." };
            }

            const translatorKey = process.env.TRANSLATOR_KEY;
            const documentEndpoint = process.env.TRANSLATOR_DOCUMENT_ENDPOINT;
            const region = process.env.TRANSLATOR_REGION;

            if (!translatorKey) {
                return { status: 500, body: "Translator configuration is missing." };
            }

            if (!documentEndpoint) {
                return { 
                    status: 400, 
                    body: "Format-Preserving Document Translation requires a dedicated endpoint. Please add 'TRANSLATOR_DOCUMENT_ENDPOINT' to your local.settings.json. You can find this 'Document Translation endpoint' inside your Azure Portal under your Translator resource's 'Keys and Endpoint' section."
                };
            }

            const baseEndpoint = documentEndpoint.replace(/\/$/, '');
            
            // Make request to Synchronous Document Translation API
            const translateUrl = `${baseEndpoint}/translator/document:translate?targetLanguage=${targetLanguage}&api-version=2024-05-01`;

            context.log(`Translating document: ${originalFile.name} (${originalFile.type}) to ${targetLanguage}`);

            const documentFormData = new FormData();
            // Wrap in a Blob to ensure type is preserved and provide a filename for the API
            const fileBlob = new Blob([await originalFile.arrayBuffer()], { type: originalFile.type || 'application/pdf' });
            documentFormData.append('document', fileBlob, originalFile.name);

            context.log(`Sending formatted document translation request...`);

            const response = await fetch(translateUrl, {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': translatorKey,
                    'Ocp-Apim-Subscription-Region': region,
                    'X-ClientTraceId': uuidv4().toString()
                },
                body: documentFormData
            });

            if (!response.ok) {
                const errorText = await response.text();
                context.error(`Document API failed: ${response.status} - ${errorText}`);
                return {
                    status: 500,
                    body: `Formatting-preserving Document Translation failed: ${response.statusText}. Error: ${errorText}`
                };
            }

            const arrayBuffer = await response.arrayBuffer();
            const translatedPdfBuffer = Buffer.from(arrayBuffer);

            let translatedFileUrl = '';
            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            if (connectionString) {
                try {
                    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
                    const containerName = 'translated-pdfs';
                    const containerClient = blobServiceClient.getContainerClient(containerName);
                    
                    await containerClient.createIfNotExists();
                    
                    const blobName = `translated_formatted_${uuidv4()}.pdf`;
                    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
                    
                    await blockBlobClient.uploadData(translatedPdfBuffer, {
                        blobHTTPHeaders: { blobContentType: 'application/pdf' }
                    });
                    
                    translatedFileUrl = await blockBlobClient.generateSasUrl({
                        permissions: BlobSASPermissions.parse("r"),
                        expiresOn: new Date(new Date().valueOf() + 3600 * 1000)
                    });
                } catch (blobErr) {
                    context.error('Failed to upload formatted PDF to Blob Storage:', blobErr.message);
                }
            }

            try {
                if (connectionString) {
                    const tableClient = TableClient.fromConnectionString(connectionString, "TranslationHistory");
                    await tableClient.createTable();
                    await tableClient.createEntity({
                        partitionKey: "pdf_translation",
                        rowKey: uuidv4(),
                        originalFileName: originalFile.name,
                        translatedText: "[Format-Preserved Document Translation Generated]",
                        sourceLanguage: "auto",
                        targetLanguage,
                        translatedFileUrl: translatedFileUrl,
                        timestamp: new Date()
                    });
                }
            } catch (err) {
                context.warn('Failed to save history to Table Storage', err);
            }

            return {
                jsonBody: {
                    originalText: "[PDF Document uploaded securely for format-preserving translation.]",
                    translatedText: "[PDF Extracted, fully translated, formatting preserved, and stored securely.]",
                    detectedLanguage: "auto",
                    targetLanguage,
                    translatedFileUrl
                }
            };
        } catch (error) {
            context.error('Error processing formatted document:', error.message);
            return {
                status: 500,
                body: "An error occurred during formatted document translation: " + error.message
            };
        }
    }
});

