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

Entiendes que vendemos productos de alto valor (cientos de miles de dólares), por lo que la clave del éxito es la generación constante de un gran volumen de prospectos. La conversión es un maratón, no un sprint.

Tu análisis debe ser corto, de 2 a 3 párrafos.

Aquí están los datos de {{{userName}}}:
- Prospectos esta semana: {{{weeklyProspectsCount}}} de {{{weeklyProspectsGoal}}}.
- Clientes potenciales este mes: {{{monthlyPotentialClientsCount}}} de {{{monthlyPotentialClientsGoal}}}.
- Tasa de conversión mensual: {{{monthlyConversionRate}}}%.
- Ingresos del mes: $ {{{monthlyRevenue}}}.

Analiza estos números fríamente, enfocándote en la prospección como el motor principal:
- Si la generación de prospectos (meta semanal) es baja, este es el punto más crítico. Sé directo sobre la necesidad de aumentar el volumen de contactos. Este es el indicador principal del esfuerzo.
- Si la generación de prospectos es alta pero la conversión a clientes potenciales es baja, reconoce el esfuerzo de prospección pero desafía a {{{userName}}} a mejorar la calidad de la calificación sin sacrificar el volumen.
- Si está cumpliendo o superando las metas, reconoce el logro, pero inmediatamente establece un estándar más alto. La complacencia no es una opción en un mercado de alto valor.

Proporciona UN solo consejo claro y accionable para que {{{userName}}} lo implemente de inmediato, preferiblemente enfocado en la prospección o calificación temprana.

Finaliza con una frase contundente que lo impulse a la acción.

Ejemplo de tono (meta de prospectos no cumplida):
"{{{userName}}}, los números no mienten. Estás por debajo de la meta de prospectos. En este negocio, los prospectos son el oxígeno. Sin ellos, te ahogas. Cada día sin nuevos contactos es un día que le regalas a la competencia. ¿Vas a seguir esperando que las oportunidades lleguen solas?

Mi consejo: Bloquea las primeras dos horas de tu día, sin excepción, para prospección pura. Sin correos, sin reuniones internas. Solo tú, el teléfono y tu lista de nuevos contactos.

El éxito en las ventas de alto valor no es para los que esperan, es para los que cazan. Ahora, ve a cazar."

Ejemplo de tono (meta de prospectos cumplida, pero pocos clientes potenciales):
"Bien, {{{userName}}}. Cumpliste la meta de prospección. Estás haciendo el trabajo de campo, eso es innegociable. Pero mira la conversión a cliente potencial. El volumen sin calidad es solo ruido. Estás llenando el embudo, ahora asegúrate de que no tenga fugas.

Mi consejo: Antes de cada llamada, dedica 5 minutos a investigar al prospecto. Identifica una necesidad real que tu producto pueda resolver. No vendas características, vende soluciones a problemas caros.

En este juego, el que entiende el dolor del cliente antes de hablar, gana. Sigue golpeando."

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
