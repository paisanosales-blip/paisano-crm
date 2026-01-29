'use server';

/**
 * @fileOverview Summarizes client interactions for sales managers.
 *
 * - summarizeClientInteractions - A function that generates a summary of client interactions.
 * - SummarizeClientInteractionsInput - The input type for the summarizeClientInteractions function.
 * - SummarizeClientInteractionsOutput - The return type for the summarizeClientInteractions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeClientInteractionsInputSchema = z.object({
  interactions: z.string().describe('A list of interactions with the client.'),
  clientName: z.string().describe('The name of the client.'),
});
export type SummarizeClientInteractionsInput = z.infer<typeof SummarizeClientInteractionsInputSchema>;

const SummarizeClientInteractionsOutputSchema = z.object({
  summary: z.string().describe('A summary of the interactions with the client.'),
});
export type SummarizeClientInteractionsOutput = z.infer<typeof SummarizeClientInteractionsOutputSchema>;

export async function summarizeClientInteractions(input: SummarizeClientInteractionsInput): Promise<SummarizeClientInteractionsOutput> {
  return summarizeClientInteractionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeClientInteractionsPrompt',
  input: {schema: SummarizeClientInteractionsInputSchema},
  output: {schema: SummarizeClientInteractionsOutputSchema},
  prompt: `You are a sales expert. Please summarize the following interactions with {{clientName}} to provide a quick overview for a sales manager:\n\nInteractions:\n{{{interactions}}}`,
});

const summarizeClientInteractionsFlow = ai.defineFlow(
  {
    name: 'summarizeClientInteractionsFlow',
    inputSchema: SummarizeClientInteractionsInputSchema,
    outputSchema: SummarizeClientInteractionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
