const { app } = require('@azure/functions');

app.setup({
    enableHttpStream: true,
});

// Register functions
require('./functions/TranslateText');
require('./functions/GetHistory');
require('./functions/ProcessDocument');
require('./functions/SynthesizeSpeech');
require('./functions/DeleteHistoryEntry');
require('./functions/RefineTranslation');
require('./functions/ExplainTranslation');
require('./functions/GenerateConversationStarters');
require('./functions/OptimizeSourceText');
