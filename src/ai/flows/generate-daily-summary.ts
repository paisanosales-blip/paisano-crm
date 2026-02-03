'use server';

/**
 * @fileOverview An AI agent that generates a motivational daily summary for a salesperson.
 *
 * - generateDailySummary - A function that generates a personalized daily briefing.
 * - GenerateDailySummaryInput - The input type for the generateDailySummary function.
 * - GenerateDailySummaryOutput - The return type for the generateDailySummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateDailySummaryInputSchema = z.object({
  userName: z.string().describe('The first name of the salesperson.'),
  todaysFollowUps: z.number().describe('The number of follow-up activities scheduled for today.'),
  overdueFollowUps: z.number().describe('The number of follow-up activities that are past their due date.'),
  newLeadsCount: z.number().describe('The number of new leads in the "Primer contacto" stage.'),
  activeOpportunitiesCount: z.number().describe('The total number of opportunities not yet won or lost.'),
  closingOpportunitiesCount: z.number().describe('The number of opportunities in the "Negociación" or "Cierre de venta" stages.'),
});
export type GenerateDailySummaryInput = z.infer<typeof GenerateDailySummaryInputSchema>;

const GenerateDailySummaryOutputSchema = z.object({
  summary: z.string().describe('A concise, motivational daily summary for the salesperson, written in Spanish.'),
});
export type GenerateDailySummaryOutput = z.infer<typeof GenerateDailySummaryOutputSchema>;

export async function generateDailySummary(
  input: GenerateDailySummaryInput
): Promise<GenerateDailySummaryOutput> {
  return generateDailySummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDailySummaryPrompt',
  input: {schema: GenerateDailySummaryInputSchema},
  output: {schema: GenerateDailySummaryOutputSchema},
  prompt: `Eres un coach de ventas positivo y energético. Tu tarea es escribir un breve resumen diario para un vendedor llamado {{{userName}}}. El resumen debe ser motivador, estar orientado a la acción y basado en los datos proporcionados. Usa un tono amigable y alentador. El mensaje debe estar en español.

Datos del día:
- Seguimientos para hoy: {{{todaysFollowUps}}}
- Seguimientos atrasados: {{{overdueFollowUps}}}
- Nuevos prospectos (en primer contacto): {{{newLeadsCount}}}
- Oportunidades activas totales: {{{activeOpportunitiesCount}}}
- Oportunidades en etapa de cierre/negociación: {{{closingOpportunitiesCount}}}

A continuación, algunos ejemplos de cómo podrías estructurar el mensaje según los datos. Adapta el tono y el contenido para que suene natural y de ánimo.

- Si hay seguimientos para hoy, priorízalos.
- Si hay seguimientos atrasados, menciónalos con urgencia pero de forma positiva.
- Si hay oportunidades en cierre, resáltalas como una gran oportunidad.
- Si no hay seguimientos, anímale a buscar nuevos prospectos o a mover los existentes.
- Siempre termina con una frase de ánimo.

Ejemplo 1 (con actividades):
"¡Buenos días, {{{userName}}}! ☀️ Prepárate para un día productivo. Tienes {{{todaysFollowUps}}} seguimientos clave para hoy. ¡Cada llamada es una oportunidad! Además, hay {{{overdueFollowUps}}} seguimientos atrasados que necesitan tu atención para no perder el impulso. Concéntrate en esos primero. ¡Vamos a convertir esas conversaciones en ventas! ¡Tú puedes!"

Ejemplo 2 (sin seguimientos pero con oportunidades):
"¡Excelente día, {{{userName}}}! Hoy no tienes seguimientos programados, lo que lo convierte en el día perfecto para la estrategia. Tienes {{{activeOpportunitiesCount}}} oportunidades activas en tu pipeline. ¿Qué te parece si avanzamos a esos {{{closingOpportunitiesCount}}} prospectos que están cerca del cierre? ¡Un pequeño empujón podría ser la diferencia! ¡A por todas!"

Ejemplo 3 (pocos datos, día tranquilo):
"¡Hola, {{{userName}}}! ¡Que tengas un gran día! Tu agenda de seguimientos está despejada hoy. Es una excelente oportunidad para nutrir a tus {{{newLeadsCount}}} nuevos prospectos o buscar nuevas oportunidades. Recuerda que la constancia es la clave del éxito en las ventas. ¡Vamos a sembrar hoy para cosechar mañana! ¡Mucho éxito!"

Ahora, genera un nuevo resumen basado en los datos reales proporcionados.
`,
});

const generateDailySummaryFlow = ai.defineFlow(
  {
    name: 'generateDailySummaryFlow',
    inputSchema: GenerateDailySummaryInputSchema,
    outputSchema: GenerateDailySummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
