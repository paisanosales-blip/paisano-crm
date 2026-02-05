'use server';

/**
 * @fileOverview An AI agent that generates a weekly marketing plan.
 *
 * - generateMarketingPlan - A function that generates a marketing plan.
 * - GenerateMarketingPlanInput - The input type for the function.
 * - GenerateMarketingPlanOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateMarketingPlanInputSchema = z.object({
  businessDescription: z.string().describe('Description of the business and its products.'),
  socialMediaFocus: z.string().describe('The primary social media platform to focus on.'),
});
export type GenerateMarketingPlanInput = z.infer<typeof GenerateMarketingPlanInputSchema>;

const DailyTaskItemSchema = z.object({
  description: z.string().describe('The specific, actionable task for the day.'),
  points: z.number().describe('The difficulty score of the task (1 for easy, 2 for medium, 3 for hard).'),
});

const DailyTaskSchema = z.object({
    day: z.string().describe('Day of the week (e.g., Lunes, Martes).'),
    theme: z.string().describe('The theme or focus for the day.'),
    tasks: z.array(DailyTaskItemSchema).describe('A list of 6 specific, actionable tasks for the day, each with a description and points.'),
});

const GenerateMarketingPlanOutputSchema = z.object({
  weeklyPlan: z.array(DailyTaskSchema).describe('A 5-day marketing plan with daily themes and 6 tasks, each having a description and difficulty points.'),
});
export type GenerateMarketingPlanOutput = z.infer<typeof GenerateMarketingPlanOutputSchema>;

export async function generateMarketingPlan(
  input: GenerateMarketingPlanInput
): Promise<GenerateMarketingPlanOutput> {
  return generateMarketingPlanFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateMarketingPlanPrompt',
  input: {schema: GenerateMarketingPlanInputSchema},
  output: {schema: GenerateMarketingPlanOutputSchema},
  prompt: `Eres un estratega de marketing digital creativo y práctico, especializado en la industria de manufactura y maquinaria pesada.

Tu tarea es crear un plan de marketing de contenido para la semana laboral (Lunes a Viernes) para una empresa con la siguiente descripción:
{{{businessDescription}}}

El enfoque principal debe estar en la plataforma: {{{socialMediaFocus}}}. También debes incluir ideas para Facebook, Instagram y LinkedIn.

Importante: El equipo de marketing está aprendiendo y no tiene experiencia en edición de video profesional. Las ideas deben ser sencillas, auténticas y fáciles de ejecutar con un teléfono móvil.

El objetivo es acumular puntos completando tareas. Asigna puntos a cada tarea según su dificultad:
- 1 Punto (Fácil): Tareas rápidas como hacer una encuesta, compartir una foto simple, o hacer una pregunta a la audiencia. Requieren mínimo esfuerzo.
- 2 Puntos (Medio): Tareas que requieren un poco más de preparación, como grabar un video corto sin edición, escribir un post un poco más detallado o buscar un audio en tendencia.
- 3 Puntos (Difícil): Tareas que implican más coordinación o creatividad, como grabar un time-lapse, hacer un video corto con varias tomas (aunque sea sin edición profesional), o escribir un post para LinkedIn más elaborado.

Para cada día de Lunes a Viernes, define un tema central y una lista de 6 tareas específicas y accionables. Cada tarea debe tener su 'description' y sus 'points'.

Ejemplo de formato de una tarea:
{
  "description": "Grabar un video corto (15-30s) para TikTok mostrando el proceso de soldadura. No necesita edición, solo muestra el trabajo real.",
  "points": 2
}

Genera un plan completo para los 5 días de la semana laboral.
`,
});

const generateMarketingPlanFlow = ai.defineFlow(
  {
    name: 'generateMarketingPlanFlow',
    inputSchema: GenerateMarketingPlanInputSchema,
    outputSchema: GenerateMarketingPlanOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
