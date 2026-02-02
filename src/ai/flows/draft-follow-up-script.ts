'use server';

/**
 * @fileOverview An AI agent that drafts scripts for sales follow-ups.
 *
 * - draftFollowUpScript - A function that generates a draft for a follow-up.
 * - DraftFollowUpScriptInput - The input type for the draftFollowUpScript function.
 * - DraftFollowUpScriptOutput - The return type for the draftFollowUpScript function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DraftFollowUpScriptInputSchema = z.object({
  clientDetails: z.string().describe('Details about the client and their needs.'),
  followUpType: z.string().describe('The type of follow-up being made (e.g., "Llamada", "Correo", "Mensaje").'),
  salesPipelineStage: z.string().describe('The current stage of the client in the sales pipeline.'),
  quotationStatus: z.string().describe('The current status of any existing quotation.'),
  pastInteractions: z.string().describe('A summary of past interactions with the client.'),
});
export type DraftFollowUpScriptInput = z.infer<typeof DraftFollowUpScriptInputSchema>;

const DraftFollowUpScriptOutputSchema = z.object({
  draft: z.string().describe('The generated script or draft for the follow-up.'),
});
export type DraftFollowUpScriptOutput = z.infer<typeof DraftFollowUpScriptOutputSchema>;

export async function draftFollowUpScript(
  input: DraftFollowUpScriptInput
): Promise<DraftFollowUpScriptOutput> {
  return draftFollowUpScriptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'draftFollowUpScriptPrompt',
  input: {schema: DraftFollowUpScriptInputSchema},
  output: {schema: DraftFollowUpScriptOutputSchema},
  prompt: `Eres un asistente de ventas experto. Basado en el contexto proporcionado sobre un cliente y un seguimiento programado, redacta un borrador para el campo "observaciones".

El tono debe ser profesional, conciso y orientado a la acción.

- Si el tipo de seguimiento es "Llamada" o "Reunión", proporciona una lista de puntos clave a discutir.
- Si el tipo de seguimiento es "Correo" o "Mensaje", redacta un borrador del mensaje.
- Si el tipo de seguimiento es "Nota", simplemente resume el estado actual para un recordatorio interno.

Contexto:
- Detalles del Cliente: {{{clientDetails}}}
- Tipo de Seguimiento: {{{followUpType}}}
- Etapa del Flujo de Ventas: {{{salesPipelineStage}}}
- Estado de la Cotización: {{{quotationStatus}}}
- Interacciones Pasadas:
{{{pastInteractions}}}
`,
});

const draftFollowUpScriptFlow = ai.defineFlow(
  {
    name: 'draftFollowUpScriptFlow',
    inputSchema: DraftFollowUpScriptInputSchema,
    outputSchema: DraftFollowUpScriptOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
