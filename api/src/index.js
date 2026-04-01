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
