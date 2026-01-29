'use server';
/**
 * @fileOverview Quotation summary generator.
 *
 * - generateQuotationSummary - A function that generates a summary of a quotation.
 * - GenerateQuotationSummaryInput - The input type for the generateQuotationSummary function.
 * - GenerateQuotationSummaryOutput - The return type for the generateQuotationSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateQuotationSummaryInputSchema = z.object({
  quotationDetails: z.string().describe('The details of the quotation.'),
  keyTerms: z.string().describe('Key terms and conditions of the quotation.'),
});
export type GenerateQuotationSummaryInput = z.infer<
  typeof GenerateQuotationSummaryInputSchema
>;

const GenerateQuotationSummaryOutputSchema = z.object({
  summary: z.string().describe('A short summary of the quotation.'),
  progress: z.string().describe('Progress of the quotation summary generation.'),
});
export type GenerateQuotationSummaryOutput = z.infer<
  typeof GenerateQuotationSummaryOutputSchema
>;

export async function generateQuotationSummary(
  input: GenerateQuotationSummaryInput
): Promise<GenerateQuotationSummaryOutput> {
  return generateQuotationSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateQuotationSummaryPrompt',
  input: {schema: GenerateQuotationSummaryInputSchema},
  output: {schema: GenerateQuotationSummaryOutputSchema},
  prompt: `You are an AI assistant helping a sales person.
  Create a short summary of the quotation with the following details: {{{quotationDetails}}}. Also, highlight the following key terms and conditions: {{{keyTerms}}}. Finally, add one short, one-sentence summary of what you have generated to the 'progress' field in the output.`,
});

const generateQuotationSummaryFlow = ai.defineFlow(
  {
    name: 'generateQuotationSummaryFlow',
    inputSchema: GenerateQuotationSummaryInputSchema,
    outputSchema: GenerateQuotationSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
