'use server';

/**
 * @fileOverview Un agente de IA que sugiere la siguiente mejor acción para que un vendedor la tome con un cliente.
 *
 * - suggestNextAction - Una función que sugiere la siguiente mejor acción para un vendedor.
 * - SuggestNextActionInput - El tipo de entrada para la función suggestNextAction.
 * - SuggestNextActionOutput - El tipo de retorno para la función suggestNextAction.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestNextActionInputSchema = z.object({
  pastInteractions: z
    .string()
    .describe(
      'Un resumen de las interacciones pasadas con el cliente, incluyendo fechas, temas discutidos y resultados.'
    ),
  quotationStatus: z
    .string()
    .describe(
      'El estado actual de la cotización, incluyendo si ha sido enviada, aceptada, rechazada o está pendiente.'
    ),
  salesPipelineStage: z
    .string()
    .describe(
      'La etapa actual del cliente en el flujo de ventas (p. ej., Prospecto, Calificación, Propuesta, Negociación, Ganada, Perdida).'
    ),
  clientDetails: z.string().describe('Detalles sobre el cliente y sus necesidades.'),
});
export type SuggestNextActionInput = z.infer<typeof SuggestNextActionInputSchema>;

const SuggestNextActionOutputSchema = z.object({
  nextAction: z
    .string()
    .describe(
      'La siguiente acción sugerida para que el vendedor la tome con el cliente. Este debe ser un paso específico y procesable.'
    ),
  rationale: z
    .string()
    .describe(
      'La justificación detrás de la siguiente acción sugerida. Explica por qué se recomienda esta acción en función de los datos de entrada.'
    ),
});
export type SuggestNextActionOutput = z.infer<typeof SuggestNextActionOutputSchema>;

export async function suggestNextAction(
  input: SuggestNextActionInput
): Promise<SuggestNextActionOutput> {
  return suggestNextActionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestNextActionPrompt',
  input: {schema: SuggestNextActionInputSchema},
  output: {schema: SuggestNextActionOutputSchema},
  prompt: `Eres un asistente de IA que ayuda a un vendedor a determinar la siguiente mejor acción a tomar con un cliente.

  Basado en la siguiente información, sugiere la única y más efectiva siguiente acción para que el vendedor la tome.
  Explica tu justificación para la sugerencia.

  Detalles del Cliente: {{{clientDetails}}}
  Interacciones Pasadas: {{{pastInteractions}}}
  Estado de la Cotización: {{{quotationStatus}}}
  Etapa del Flujo de Ventas: {{{salesPipelineStage}}}

  Considera las necesidades del cliente, la etapa actual en el flujo de ventas y el estado de cualquier cotización pendiente.
  Sugiere un siguiente paso específico y procesable que el vendedor pueda tomar para avanzar en el trato.
  La sugerencia debe ser realista.

  La respuesta debe tener el siguiente formato:
  Siguiente Acción: [La siguiente acción sugerida]
  Justificación: [Explicación de por qué se recomienda esta acción]
  `,
});

const suggestNextActionFlow = ai.defineFlow(
  {
    name: 'suggestNextActionFlow',
    inputSchema: SuggestNextActionInputSchema,
    outputSchema: SuggestNextActionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
