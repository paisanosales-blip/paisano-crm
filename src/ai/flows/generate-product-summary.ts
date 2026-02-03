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
  prompt: `Eres un experto en marketing y ventas. Tu tarea es crear un resumen conciso y atractivo de la descripción de un producto para incluirlo en una cotización.

El resumen debe ser breve (2-3 frases), destacar las características y beneficios más importantes, y estar redactado en un lenguaje claro y persuasivo.

Descripción Completa del Producto:
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
