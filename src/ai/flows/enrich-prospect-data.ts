'use server';

/**
 * @fileOverview An AI agent that enriches prospect data by searching the web.
 *
 * - enrichProspectData - A function that takes a company name and finds contact information.
 * - EnrichProspectDataInput - The input type for the function.
 * - EnrichProspectDataOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnrichProspectDataInputSchema = z.object({
  companyName: z.string().describe('The name of the company to search for.'),
});
export type EnrichProspectDataInput = z.infer<typeof EnrichProspectDataInputSchema>;

const EnrichProspectDataOutputSchema = z.object({
  website: z.string().optional().describe('The official website URL of the company.'),
  phone: z.string().optional().describe('A primary contact phone number for the company.'),
  email: z.string().email().optional().describe('A general contact email address for the company.'),
  clientType: z.string().optional().describe('The industry or type of client (e.g., "Construction", "Transportation", "Agriculture").'),
});
export type EnrichProspectDataOutput = z.infer<typeof EnrichProspectDataOutputSchema>;

export async function enrichProspectData(
  input: EnrichProspectDataInput
): Promise<EnrichProspectDataOutput> {
  return enrichProspectDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'enrichProspectDataPrompt',
  input: {schema: EnrichProspectDataInputSchema},
  output: {schema: EnrichProspectDataOutputSchema},
  prompt: `Eres un asistente de investigación de ventas. Tu tarea es encontrar información de contacto pública para una empresa.

Busca en internet la siguiente empresa: {{{companyName}}}

Encuentra y devuelve la siguiente información si está disponible:
- El sitio web oficial.
- Un número de teléfono de contacto principal.
- Una dirección de correo electrónico de contacto general.
- El tipo de industria o cliente al que pertenece (ej. "Construction", "Transportation", "Sand Industry").

Si no puedes encontrar una pieza de información, simplemente omite ese campo. No inventes datos.
`,
});

const enrichProspectDataFlow = ai.defineFlow(
  {
    name: 'enrichProspectDataFlow',
    inputSchema: EnrichProspectDataInputSchema,
    outputSchema: EnrichProspectDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
