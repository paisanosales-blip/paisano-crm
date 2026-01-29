'use server';

/**
 * @fileOverview Resume las interacciones con los clientes para los gerentes de ventas.
 *
 * - summarizeClientInteractions - Una función que genera un resumen de las interacciones con el cliente.
 * - SummarizeClientInteractionsInput - El tipo de entrada para la función summarizeClientInteractions.
 * - SummarizeClientInteractionsOutput - El tipo de retorno para la función summarizeClientInteractions.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeClientInteractionsInputSchema = z.object({
  interactions: z.string().describe('Una lista de interacciones con el cliente.'),
  clientName: z.string().describe('El nombre del cliente.'),
});
export type SummarizeClientInteractionsInput = z.infer<typeof SummarizeClientInteractionsInputSchema>;

const SummarizeClientInteractionsOutputSchema = z.object({
  summary: z.string().describe('Un resumen de las interacciones con el cliente.'),
});
export type SummarizeClientInteractionsOutput = z.infer<typeof SummarizeClientInteractionsOutputSchema>;

export async function summarizeClientInteractions(input: SummarizeClientInteractionsInput): Promise<SummarizeClientInteractionsOutput> {
  return summarizeClientInteractionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeClientInteractionsPrompt',
  input: {schema: SummarizeClientInteractionsInputSchema},
  output: {schema: SummarizeClientInteractionsOutputSchema},
  prompt: `Eres un experto en ventas. Por favor, resume las siguientes interacciones con {{clientName}} para proporcionar una visión general rápida para un gerente de ventas:\n\nInteracciones:\n{{{interactions}}}`,
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
