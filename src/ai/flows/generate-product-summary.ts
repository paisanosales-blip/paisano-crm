'use server';

/**
 * @fileOverview An AI agent that generates a summary for a product description.
 *
 * - generateProductSummary - A function that generates a product summary.
 * - GenerateProductSummaryInput - The input type for the generateProductSummary function.
 * - GenerateProductSummaryOutput - The return type for the generateProductSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateProductSummaryInputSchema = z.object({
  description: z.string().describe('The full description of the product.'),
});
export type GenerateProductSummaryInput = z.infer<typeof GenerateProductSummaryInputSchema>;

const GenerateProductSummaryOutputSchema = z.object({
  summary: z.string().describe('A concise, compelling summary of the product, highlighting key features and benefits for a quotation.'),
});
export type GenerateProductSummaryOutput = z.infer<typeof GenerateProductSummaryOutputSchema>;

export async function generateProductSummary(
  input: GenerateProductSummaryInput
): Promise<GenerateProductSummaryOutput> {
  return generateProductSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateProductSummaryPrompt',
  input: {schema: GenerateProductSummaryInputSchema},
  output: {schema: GenerateProductSummaryOutputSchema},
  prompt: `You are an expert copy editor. Your task is to create a concise summary of a product description for a quotation.

The summary must be in English. It should be brief (2-3 sentences), highlight the most important features and benefits, and use only words found in the original description. Do not add any new words or marketing language.

Full Product Description:
{{{description}}}
`,
});

const generateProductSummaryFlow = ai.defineFlow(
  {
    name: 'generateProductSummaryFlow',
    inputSchema: GenerateProductSummaryInputSchema,
    outputSchema: GenerateProductSummaryOutputSchema,
  },
  async input => {
    if (!input.description) {
      return { summary: '' };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
