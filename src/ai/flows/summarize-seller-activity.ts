'use server';

/**
 * @fileOverview An AI agent that summarizes a seller's activity for a manager.
 *
 * - summarizeSellerActivity - A function that generates a summary of a seller's performance.
 * - SummarizeSellerActivityInput - The input type for the function.
 * - SummarizeSellerActivityOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeSellerActivityInputSchema = z.object({
  sellerName: z.string().describe("The name of the salesperson whose activity is being summarized."),
  timePeriod: z.string().describe("The time period for the summary (e.g., 'la última semana', 'los últimos 30 días')."),
  activitiesCount: z.number().describe("The total number of activities (calls, emails, notes) logged by the seller."),
  dealsClosedCount: z.number().describe("The number of opportunities the seller moved to the 'Cierre de venta' stage."),
  responseRate: z.number().describe("The seller's call response rate as a percentage (0-100)."),
});
export type SummarizeSellerActivityInput = z.infer<typeof SummarizeSellerActivityInputSchema>;

const SummarizeSellerActivityOutputSchema = z.object({
  summary: z.string().describe("A concise, one-paragraph summary of the seller's activity."),
});
export type SummarizeSellerActivityOutput = z.infer<typeof SummarizeSellerActivityOutputSchema>;

export async function summarizeSellerActivity(
  input: SummarizeSellerActivityInput
): Promise<SummarizeSellerActivityOutput> {
  return summarizeSellerActivityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeSellerActivityPrompt',
  input: {schema: SummarizeSellerActivityInputSchema},
  output: {schema: SummarizeSellerActivityOutputSchema},
  prompt: `Eres un gerente de ventas analítico y eficiente. Tu tarea es generar un resumen conciso de la actividad de un vendedor para un período de tiempo específico, basándote en las métricas proporcionadas.

El resumen debe ser de un solo párrafo, directo y fácil de entender.

Ejemplo de Tono:
"En la última semana, Juan Pérez registró 15 actividades, cerró 2 tratos y tuvo una tasa de respuesta del 60% en sus llamadas."

Ahora, genera un resumen para el siguiente vendedor:

Vendedor: {{{sellerName}}}
Período: {{{timePeriod}}}
Métricas:
- Actividades Totales Registradas: {{{activitiesCount}}}
- Tratos Cerrados: {{{dealsClosedCount}}}
- Tasa de Respuesta en Llamadas: {{{responseRate}}}%
`,
});

const summarizeSellerActivityFlow = ai.defineFlow(
  {
    name: 'summarizeSellerActivityFlow',
    inputSchema: SummarizeSellerActivityInputSchema,
    outputSchema: SummarizeSellerActivityOutputSchema,
  },
  async input => {
    if (input.activitiesCount === 0 && input.dealsClosedCount === 0) {
        return { summary: `No se registró actividad para ${input.sellerName} en ${input.timePeriod}.` };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
