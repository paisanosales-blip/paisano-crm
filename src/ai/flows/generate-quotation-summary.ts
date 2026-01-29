'use server';
/**
 * @fileOverview Generador de resúmenes de cotizaciones.
 *
 * - generateQuotationSummary - Una función que genera un resumen de una cotización.
 * - GenerateQuotationSummaryInput - El tipo de entrada para la función generateQuotationSummary.
 * - GenerateQuotationSummaryOutput - El tipo de retorno para la función generateQuotationSummary.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateQuotationSummaryInputSchema = z.object({
  quotationDetails: z.string().describe('Los detalles de la cotización.'),
  keyTerms: z.string().describe('Términos y condiciones clave de la cotización.'),
});
export type GenerateQuotationSummaryInput = z.infer<
  typeof GenerateQuotationSummaryInputSchema
>;

const GenerateQuotationSummaryOutputSchema = z.object({
  summary: z.string().describe('Un resumen corto de la cotización.'),
  progress: z.string().describe('Progreso de la generación del resumen de la cotización.'),
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
  prompt: `Eres un asistente de IA que ayuda a un vendedor. Crea un resumen corto de la cotización con los siguientes detalles: {{{quotationDetails}}}. Además, resalta los siguientes términos y condiciones clave: {{{keyTerms}}}. Finalmente, agrega un resumen corto de una oración de lo que has generado al campo 'progress' en la salida.`,
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
