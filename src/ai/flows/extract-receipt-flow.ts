'use server';
/**
 * @fileOverview A receipt data extraction AI agent.
 *
 * - extractReceiptData - A function that handles the receipt data extraction process.
 * - ExtractReceiptInput - The input type for the extractReceiptData function.
 * - ExtractReceiptOutput - The return type for the extractReceiptData function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'zod';

const ExtractReceiptInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a purchase receipt, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractReceiptInput = z.infer<typeof ExtractReceiptInputSchema>;

const ReceiptItemSchema = z.object({
    name: z.string().describe("The name of the purchased item."),
    quantity: z.number().describe("The quantity of the item purchased."),
    price: z.number().describe("The unit price for a single item."),
});

const ExtractReceiptOutputSchema = z.object({
  supplierName: z.string().describe("The name of the company or store from where the items were purchased."),
  items: z.array(ReceiptItemSchema).describe("A list of all individual items purchased."),
  tax: z.number().optional().describe("The total tax amount listed on the receipt. If not present, this can be omitted."),
  serviceCharge: z.number().optional().describe("The total service charge or tip amount listed on the receipt. If not present, this can be omitted."),
});
export type ExtractReceiptOutput = z.infer<typeof ExtractReceiptOutputSchema>;

export async function extractReceiptData(input: ExtractReceiptInput): Promise<ExtractReceiptOutput> {
  return extractReceiptDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractReceiptDataPrompt',
  input: {schema: ExtractReceiptInputSchema},
  output: {schema: ExtractReceiptOutputSchema},
  prompt: `You are an expert receipt data extraction agent. Your task is to analyze the provided receipt image and extract the following information in a structured JSON format:
1.  **supplierName**: The name of the store or company.
2.  **items**: A list of all purchased items. For each item, extract its name, the quantity purchased, and the **unit price** (price for one item). If the receipt only shows the total price for a quantity greater than one, calculate the unit price.
3.  **tax**: The total tax amount. If not explicitly mentioned, omit this field.
4.  **serviceCharge**: Any service charge, tip, or surcharge. If not explicitly mentioned, omit this field.

Analyze the receipt image carefully to provide the most accurate data possible.

Receipt Image: {{media url=photoDataUri}}`,
});

const extractReceiptDataFlow = ai.defineFlow(
  {
    name: 'extractReceiptDataFlow',
    inputSchema: ExtractReceiptInputSchema,
    outputSchema: ExtractReceiptOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
