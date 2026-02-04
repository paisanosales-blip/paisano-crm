'use server';

/**
 * @fileOverview An AI agent that generates a personal assistant summary for follow-ups.
 *
 * - generateFollowUpSummary - A function that generates a personalized summary of follow-up activities.
 * - GenerateFollowUpSummaryInput - The input type for the generateFollowUpSummary function.
 * - GenerateFollowUpSummaryOutput - The return type for the generateFollowUpSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFollowUpSummaryInputSchema = z.object({
  userName: z.string().describe('The first name of the salesperson.'),
  totalPending: z.number().describe('Total number of pending follow-ups.'),
  dueToday: z.number().describe('Number of follow-ups due today.'),
  overdue: z.number().describe('Number of overdue follow-ups.'),
  prospectsWithoutFollowUp: z.array(z.string()).describe('A list of client names that are active but have no scheduled follow-ups.'),
});
export type GenerateFollowUpSummaryInput = z.infer<typeof GenerateFollowUpSummaryInputSchema>;

const GenerateFollowUpSummaryOutputSchema = z.object({
  summary: z.string().describe('A concise, motivational summary from a personal assistant about follow-up tasks, written in Spanish.'),
});
export type GenerateFollowUpSummaryOutput = z.infer<typeof GenerateFollowUpSummaryOutputSchema>;

export async function generateFollowUpSummary(
  input: GenerateFollowUpSummaryInput
): Promise<GenerateFollowUpSummaryOutput> {
  return generateFollowUpSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFollowUpSummaryPrompt',
  input: {schema: GenerateFollowUpSummaryInputSchema},
  output: {schema: GenerateFollowUpSummaryOutputSchema},
  prompt: `Eres un asistente de ventas proactivo y personal para {{{userName}}}. Tu tarea es analizar los datos de seguimiento y proporcionar un resumen claro, conciso y accionable. El tono debe ser amigable y de apoyo.

Aquí están los datos de hoy:
- Tareas Pendientes Totales: {{{totalPending}}}
- Vencen Hoy: {{{dueToday}}}
- Atrasadas: {{{overdue}}}

{{#if prospectsWithoutFollowUp}}
Además, he notado que los siguientes prospectos activos no tienen un próximo seguimiento agendado. Podría ser una buena idea contactarlos para mantener el impulso:
{{#each prospectsWithoutFollowUp}}
- {{{this}}}
{{/each}}
{{/if}}

Basado en esta información, redacta un párrafo de resumen. Si hay seguimientos atrasados, priorízalos de manera urgente pero positiva. Si hay prospectos sin seguimiento, sugiere proactivamente agendar una nueva acción para ellos.

Ejemplo si hay atrasados:
"¡Hola, {{{userName}}}! Para hoy, tienes {{{dueToday}}} tareas en tu lista. ¡Vamos a enfocarnos en ellas! Es importante que demos prioridad a los {{{overdue}}} seguimientos atrasados para retomar el contacto. También, he visto que 'Cliente X' y 'Cliente Y' no tienen un próximo paso definido. ¿Agendamos una llamada rápida para ellos? ¡Que tengas un día productivo!"

Ejemplo si todo está al día:
"¡Excelente trabajo, {{{userName}}}! Vas al día con todos tus seguimientos. Hoy tienes {{{dueToday}}} tareas en la agenda. Ya que tienes la bandeja de entrada controlada, podría ser un buen momento para contactar a 'Cliente Z', quien no tiene un seguimiento agendado. ¡Aprovechemos el buen ritmo!"

Ahora, genera un nuevo resumen basado en los datos reales proporcionados.`,
});

const generateFollowUpSummaryFlow = ai.defineFlow(
  {
    name: 'generateFollowUpSummaryFlow',
    inputSchema: GenerateFollowUpSummaryInputSchema,
    outputSchema: GenerateFollowUpSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
