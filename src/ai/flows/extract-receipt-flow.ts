
'use server';

import { ai } from '@/ai/ai-instance';
import { z } from 'zod';

const ReceiptItemSchema = z.object({
  name: z.string().describe('The name of the purchased item.'),
  quantity: z.number().describe('The quantity of the item purchased.'),
  price: z.number().describe('The unit price of the item.'),
});

const ReceiptDataSchema = z.object({
  companyName: z.string().optional().describe('The name of the company or store on the receipt.'),
  items: z.array(ReceiptItemSchema).describe('A list of all items purchased.'),
  tax: z.number().optional().describe('The total tax amount, if present.'),
  serviceCharge: z.number().optional().describe('The service charge amount, if present.'),
});

export type ReceiptData = z.infer<typeof ReceiptDataSchema>;

const extractReceiptFlow = ai.defineFlow(
  {
    name: 'extractReceiptFlow',
    inputSchema: z.object({
      photoDataUri: z.string().describe("A photo of a receipt, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
    }),
    outputSchema: ReceiptDataSchema,
  },
  async (input) => {
    const llmResponse = await ai.generate({
      prompt: `You are an expert receipt data extractor. Analyze the following receipt image and extract the requested information in the specified JSON format.

      - Identify the company name.
      - List all individual purchased items. For each item, extract its name, quantity, and unit price. If quantity is not specified, assume it is 1.
      - Extract the total tax amount, if listed.
      - Extract any service charge, if listed.

      Image to analyze:
      {{media url=photoDataUri}}`,
      output: {
        schema: ReceiptDataSchema,
      },
    });

    return llmResponse.output()!;
  }
);

export async function scanReceiptFlow(input: { photoDataUri: string }): Promise<ReceiptData> {
    return extractReceiptFlow(input);
}
