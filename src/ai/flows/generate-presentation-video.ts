'use server';

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';
import * as fs from 'fs';
import { Readable } from 'stream';
import type { MediaPart } from 'genkit';

const GeneratePresentationVideoOutputSchema = z.object({
  videoDataUri: z.string().describe('The generated video as a Base64 data URI.'),
});

export type GeneratePresentationVideoOutput = z.infer<
  typeof GeneratePresentationVideoOutputSchema
>;

async function downloadVideo(video: MediaPart): Promise<string> {
  const fetch = (await import('node-fetch')).default;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set.');
  }

  const videoDownloadResponse = await fetch(
    `${video.media!.url}&key=${apiKey}`
  );

  if (
    !videoDownloadResponse ||
    videoDownloadResponse.status !== 200 ||
    !videoDownloadResponse.body
  ) {
    throw new Error('Failed to fetch video');
  }

  const chunks: Buffer[] = [];
  for await (const chunk of videoDownloadResponse.body) {
    chunks.push(chunk as Buffer);
  }
  const buffer = Buffer.concat(chunks);
  return `data:video/mp4;base64,${buffer.toString('base64')}`;
}

export const generatePresentationVideo = ai.defineFlow(
  {
    name: 'generatePresentationVideoFlow',
    inputSchema: z.string(),
    outputSchema: GeneratePresentationVideoOutputSchema,
  },
  async (prompt) => {
    let { operation } = await ai.generate({
      model: googleAI.model('veo-2.0-generate-001'),
      prompt,
      config: {
        durationSeconds: 8,
        aspectRatio: '16:9',
      },
    });

    if (!operation) {
      throw new Error('Expected the model to return an operation');
    }

    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      operation = await ai.checkOperation(operation);
    }

    if (operation.error) {
      throw new Error('Failed to generate video: ' + operation.error.message);
    }

    const video = operation.output?.message?.content.find((p) => !!p.media);
    if (!video) {
      throw new Error('Failed to find the generated video');
    }

    const videoDataUri = await downloadVideo(video);

    return { videoDataUri };
  }
);
