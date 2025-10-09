
'use server';
/**
 * @fileOverview An AI flow for extracting transaction details from natural language.
 *
 * - parseTransaction - A function that handles parsing a text string for transaction data.
 * - TransactionData - The TypeScript type for the output.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'zod';

const TransactionDataSchema = z.object({
    type: z.enum(['income', 'expense']).describe('The type of the transaction.'),
    category: z.string().describe('The category of the transaction (e.g., Rent, Salary, Groceries).'),
    amount: z.number().describe('The numerical amount of the transaction.'),
    source: z.string().optional().describe('The source of the funds (e.g., Cash, Bank, Credit Card).'),
    tags: z.array(z.string()).optional().describe('A list of any tags associated with the transaction.'),
});

export type TransactionData = z.infer<typeof TransactionDataSchema>;

const TransactionInputSchema = z.object({
    prompt: z.string(),
    existingCategories: z.array(z.string()).optional(),
});
export type TransactionInput = z.infer<typeof TransactionInputSchema>;


export async function parseTransaction(input: TransactionInput): Promise<TransactionData> {
    return extractTransactionFlow(input);
}

const extractTransactionFlow = ai.defineFlow(
  {
    name: 'extractTransactionFlow',
    inputSchema: TransactionInputSchema,
    outputSchema: TransactionDataSchema,
  },
  async (input) => {
    const llmResponse = await ai.generate({
        prompt: `You are an expert financial assistant. Analyze the following text and extract the transaction details into the specified JSON format.

        - Determine if the transaction is 'income' or 'expense'.
        - Identify the category of the transaction.
        - Extract the numerical amount.
        - Identify the source of the transaction (e.g., cash, bank).
        - Extract any tags associated with the transaction (e.g., from phrases like 'with tag monthly').

        {{#if existingCategories}}
        Here is a list of existing categories: {{jsonStringify existingCategories}}
        If the category you identify is very similar to one in this list, please use the existing category name to maintain consistency. For example, if you see 'Salery', use 'Salary'.
        {{/if}}

        Examples:
        - "rent received of 20000 by cash" -> { "type": "income", "category": "Rent", "amount": 20000, "source": "Cash" }
        - "paid 500 for electricity bill with tag monthly" -> { "type": "expense", "category": "Electricity Bill", "amount": 500, "source": "Unknown", "tags": ["monthly"] }
        - "salary of 50000 from bank" -> { "type": "income", "category": "Salary", "amount": 50000, "source": "Bank" }

        Text to analyze:
        "${input.prompt}"`,
        output: {
            schema: TransactionDataSchema,
        },
    });

    return llmResponse.output!;
  }
);
