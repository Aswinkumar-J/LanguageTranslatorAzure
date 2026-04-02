const { app } = require('@azure/functions');
const sdk = require("microsoft-cognitiveservices-speech-sdk");

app.http('SynthesizeSpeech', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { text, language } = body;

            if (!text) {
                return { status: 400, body: "Missing 'text' field." };
            }

            const speechKey = process.env.SPEECH_KEY;
            const speechRegion = process.env.SPEECH_REGION;

            if (!speechKey || !speechRegion) {
                context.error('Speech Service configuration is missing.');
                return { status: 500, body: "Speech Service configuration is missing." };
            }

            const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
            
            // Azure Speech Language mapping (simple fallback)
            // Ideally should be xx-XX format (e.g. es-ES)
            if (language && language.length === 2) {
                // Common mappings
                const langMap = {
                    'es': 'es-ES',
                    'fr': 'fr-FR',
                    'de': 'de-DE',
                    'hi': 'hi-IN',
                    'ta': 'ta-IN',
                    'it': 'it-IT',
                    'ja': 'ja-JP',
                    'ko': 'ko-KR',
                    'ar': 'ar-SA'
                };
                speechConfig.speechSynthesisLanguage = langMap[language] || 'en-US';
            } else if (language) {
                speechConfig.speechSynthesisLanguage = language;
            }

            context.log(`Synthesizing speech for text: "${text.substring(0, 50)}..." with lang: ${speechConfig.speechSynthesisLanguage}`);

            const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);

            return new Promise((resolve, reject) => {
                synthesizer.speakTextAsync(
                    text,
                    result => {
                        synthesizer.close();
                        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                            context.log('Speech synthesis completed successfully.');
                            resolve({
                                status: 200,
                                headers: {
                                    'Content-Type': 'audio/wav',
                                },
                                body: result.audioData // result.audioData is already An ArrayBuffer
                            });
                        } else {
                            const errorMsg = `Speech synthesis canceled: ${result.errorDetails}. Reason: ${result.reason}`;
                            context.error(errorMsg);
                            resolve({ 
                                status: 500, 
                                body: errorMsg 
                            });
                        }
                    },
                    error => {
                        synthesizer.close();
                        context.error('Speech synthesis internal error:', error);
                        resolve({ status: 500, body: error.toString() });
                    }
                );
            });

        } catch (error) {
            context.error('Error synthesizing speech:', error.message);
            return {
                status: 500,
                body: "An error occurred during speech synthesis: " + error.message
            };
        }
    }
});
