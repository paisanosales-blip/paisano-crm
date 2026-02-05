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

const DailyTaskSchema = z.object({
    day: z.string().describe('Day of the week (e.g., Lunes, Martes).'),
    theme: z.string().describe('The theme or focus for the day.'),
    tasks: z.array(z.string()).describe('A list of specific, actionable tasks for the day.'),
});

const GenerateMarketingPlanOutputSchema = z.object({
  weeklyPlan: z.array(DailyTaskSchema).describe('A 5-day marketing plan with daily themes and tasks.'),
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
  prompt: `Eres un estratega de marketing digital experto, especializado en la industria de manufactura y maquinaria pesada.

Tu tarea es crear un plan de marketing de contenido para la semana laboral (Lunes a Viernes) para una empresa con la siguiente descripción:
{{{businessDescription}}}

El enfoque principal debe estar en la plataforma: {{{socialMediaFocus}}}. También debes incluir ideas para Facebook e Instagram.

Para cada día de Lunes a Viernes, define un tema central y una lista de 2 a 3 tareas específicas y accionables. Las tareas deben ser prácticas y diseñadas para generar interés, educar a la audiencia y capturar leads.

Ejemplo de formato de un día:
- Día: Lunes
- Tema: Detrás de Cámaras en la Fábrica
- Tareas:
  - "Grabar y editar un video corto (30s) para TikTok mostrando el proceso de soldadura de un remolque, usando música en tendencia."
  - "Publicar una foto en Instagram del equipo de producción trabajando en un proyecto, con una pregunta para la audiencia como '¿Qué detalle de fabricación te gustaría ver de cerca?'."
  - "Crear una publicación en Facebook compartiendo el video de TikTok y explicando la importancia de la calidad en nuestras soldaduras."

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
