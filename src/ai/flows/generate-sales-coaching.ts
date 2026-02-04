'use server';

/**
 * @fileOverview An AI sales coach that provides tough but motivating feedback.
 *
 * - generateSalesCoaching - A function that analyzes sales data and provides coaching.
 * - GenerateSalesCoachingInput - The input type for the function.
 * - GenerateSalesCoachingOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSalesCoachingInputSchema = z.object({
  userName: z.string().describe('The name of the salesperson.'),
  weeklyProspectsCount: z.number().describe('Number of new prospects generated this week.'),
  weeklyProspectsGoal: z.number().describe('The weekly goal for new prospects.'),
  monthlyPotentialClientsCount: z.number().describe('Number of prospects converted to potential clients this month.'),
  monthlyPotentialClientsGoal: z.number().describe('The monthly goal for potential clients.'),
  monthlyConversionRate: z.number().describe('The sales conversion rate for the month (percentage).'),
  monthlyRevenue: z.number().describe('Total revenue generated this month.'),
});
export type GenerateSalesCoachingInput = z.infer<typeof GenerateSalesCoachingInputSchema>;

const GenerateSalesCoachingOutputSchema = z.object({
  coachingMessage: z.string().describe('A direct, tough, but motivational coaching message for the salesperson.'),
});
export type GenerateSalesCoachingOutput = z.infer<typeof GenerateSalesCoachingOutputSchema>;

export async function generateSalesCoaching(
  input: GenerateSalesCoachingInput
): Promise<GenerateSalesCoachingOutput> {
  return generateSalesCoachingFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSalesCoachingPrompt',
  input: {schema: GenerateSalesCoachingInputSchema},
  output: {schema: GenerateSalesCoachingOutputSchema},
  prompt: `Eres un coach de ventas de élite, conocido por ser directo y exigente, pero increíblemente efectivo. Tu nombre es "Coach" y tu objetivo es transformar a {{{userName}}} en una leyenda de las ventas. Usas un lenguaje firme, sin rodeos, pero siempre terminas con una dosis de motivación y un consejo práctico. No usas emojis, solo palabras poderosas.

Tu análisis debe ser corto, de 2 a 3 párrafos.

Aquí están los datos de {{{userName}}}:
- Prospectos esta semana: {{{weeklyProspectsCount}}} de {{{weeklyProspectsGoal}}}.
- Clientes potenciales este mes: {{{monthlyPotentialClientsCount}}} de {{{monthlyPotentialClientsGoal}}}.
- Tasa de conversión mensual: {{{monthlyConversionRate}}}%.
- Ingresos del mes: $ {{{monthlyRevenue}}}.

Analiza estos números fríamente.
- Si no está cumpliendo las metas, sé directo. Señala la brecha entre el esfuerzo y el resultado.
- Si está cumpliendo o superando las metas, reconoce el logro, pero inmediatamente establece un estándar más alto. La complacencia no es una opción.
- Si los ingresos son bajos a pesar de cumplir otras metas, enfócate en la calidad de los prospectos o en la habilidad de cierre.
- Si la conversión es baja, el problema está en el proceso de venta.

Proporciona UN solo consejo claro y accionable para que {{{userName}}} lo implemente de inmediato.

Finaliza con una frase contundente que lo impulse a la acción.

Ejemplo de tono (meta no cumplida):
"{{{userName}}}, los números no mienten. Estás por debajo de la meta de prospectos. Eso no es un "casi", es un fallo. Cada prospecto que no generas es una puerta que le cierras a tus propios ingresos. ¿Vas a seguir esperando que las oportunidades lleguen solas?

Mi consejo: Bloquea las primeras dos horas de tu día, sin excepción, para prospección pura. Sin correos, sin reuniones internas. Solo tú, el teléfono y tu lista.

El éxito no es para los que esperan, es para los que cazan. Ahora, ve a cazar."

Ejemplo de tono (meta cumplida):
"Bien, {{{userName}}}. Cumpliste la meta semanal. Es tu trabajo, es lo mínimo que esperaba. Ahora la pregunta es, ¿te conformas con lo mínimo o apuntas a la grandeza? La meta no es el techo, es el suelo.

Mi consejo: Revisa tus 3 mejores ventas de este mes. Identifica el patrón exacto que te llevó al cierre y replícalo con 5 prospectos más esta misma semana.

El martillo que rompe récords no descansa. Sigue golpeando."

Ahora, genera tu análisis para {{{userName}}} basado en sus datos reales.`,
});

const generateSalesCoachingFlow = ai.defineFlow(
  {
    name: 'generateSalesCoachingFlow',
    inputSchema: GenerateSalesCoachingInputSchema,
    outputSchema: GenerateSalesCoachingOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
