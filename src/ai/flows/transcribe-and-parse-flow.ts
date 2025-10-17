
'use server';
/**
 * @fileOverview An AI flow for transcribing audio and extracting transaction details.
 *
 * - transcribeAndParseTransaction - A function that handles parsing audio for transaction data.
 * - TransactionData - The TypeScript type for the output.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'zod';
import { TransactionData, parseTransaction, TransactionInput } from './extract-transaction-flow';

const AudioInputSchema = z.object({
  audioDataUri: z.string().describe("A voice recording of a transaction, as a data URI that must include a MIME type (like 'audio/webm' or 'audio/mp4') and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  existingCategories: z.array(z.string()).optional(),
});

export async function transcribeAndParseTransaction(input: z.infer<typeof AudioInputSchema>): Promise<TransactionData> {
  return transcribeAndParseFlow(input);
}

const transcribeAndParseFlow = ai.defineFlow(
  {
    name: 'transcribeAndParseFlow',
    inputSchema: AudioInputSchema,
    outputSchema: z.custom<TransactionData>(),
  },
  async (input) => {
    // Step 1: Transcribe the audio to text.
    const { text } = await ai.generate({
      prompt: [{ media: { url: input.audioDataUri } }],
    });

    const transcribedText = text;
    if (!transcribedText) {
      throw new Error("Could not transcribe audio.");
    }

    // Step 2: Use the existing flow to parse the transcribed text.
    const transactionInput: TransactionInput = {
      prompt: transcribedText,
      existingCategories: input.existingCategories,
    };

    const parsedData = await parseTransaction(transactionInput);
    return parsedData;
  }
);
