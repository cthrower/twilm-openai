import express, { Response } from 'express';
import ExpressWs from 'express-ws';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';
import { WebSocket } from 'ws';
import { Conversation } from '@11labs/client';  // Correct import from ElevenLabs SDK

const app = ExpressWs(express()).app;
const PORT: number = parseInt(process.env.PORT || '5050');

// Function to handle the conversation with ElevenLabs
async function handleElevenLabsConversation(ws: WebSocket, streamSid: string) {
  // Start the conversation with ElevenLabs without using navigator.mediaDevices
  const conversation = await Conversation.startSession({
    agentId: '9hLq3vrbkPaGatzEqeqL', // Example agentId
    onConnect: ({ conversationId }) => {
      console.log(`Connected to conversation: ${conversationId}`);
    },
    onMessage: ({ message, source }) => {
      console.log(`Message from ${source}: ${message}`);
      // Send response back to Twilio
      ws.send(
        JSON.stringify({
          streamSid,
          event: 'media',
          media: {
            payload: Buffer.from(message).toString('base64'),
          },
        }),
      );
    },
    onError: (message) => console.error(`Error: ${message}`),
    onStatusChange: ({ status }) => console.log(`Status changed to: ${status}`),
  });

  ws.on('message', async (data: string) => {
    const message = JSON.parse(data);

    if (message.event === 'media' && message.media) {
      const audioBuffer = Buffer.from(message.media.payload, 'base64');

      // Instead of navigator.mediaDevices, directly feed this audio into ElevenLabs
      //conversation.input.addAudioBase64Chunk(audioBuffer.toString('base64'));

      // Optionally, handle any output frequency data or volume if necessary
    }
  });

  ws.on('error', console.error);
}

// Main server logic
function startApp() {
  app.post('/call/incoming', (_, res: Response) => {
    const twiml = new VoiceResponse();
    twiml.connect().stream({
      url: `wss://${process.env.SERVER_DOMAIN}/call/connection`,
    });

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
  });

  app.ws('/call/connection', (ws: WebSocket) => {
    ws.on('message', async (data: string) => {
      const message = JSON.parse(data);
      if (message.event === 'start' && message.start) {
        const streamSid = message.start.streamSid;
        console.log('Starting session for streamSid:', streamSid);

        await handleElevenLabsConversation(ws, streamSid);
      }
    });

    ws.on('error', console.error);
  });

  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

startApp();