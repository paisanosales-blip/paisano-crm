'use server';

/**
 * @fileOverview An AI agent that analyzes the reasons why sales opportunities were lost.
 *
 * - analyzeDiscardReasons - A function that analyzes a list of reasons and returns a summary.
 * - AnalyzeDiscardReasonsInput - The input type for the analyzeDiscardReasons function.
 * - AnalyzeDiscardReasonsOutput - The return type for the analyzeDiscardReasons function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeDiscardReasonsInputSchema = z.object({
  reasons: z.array(z.string()).describe('A list of reasons why sales opportunities were discarded or lost.'),
});
export type AnalyzeDiscardReasonsInput = z.infer<typeof AnalyzeDiscardReasonsInputSchema>;

const AnalyzeDiscardReasonsOutputSchema = z.object({
  summary: z.string().describe('A concise summary analyzing the main causes for lost opportunities, grouped into categories with percentages if possible. Highlight the top 2-3 reasons.'),
});
export type AnalyzeDiscardReasonsOutput = z.infer<typeof AnalyzeDiscardReasonsOutputSchema>;

export async function analyzeDiscardReasons(
  input: AnalyzeDiscardReasonsInput
): Promise<AnalyzeDiscardReasonsOutput> {
  return analyzeDiscardReasonsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeDiscardReasonsPrompt',
  input: {schema: AnalyzeDiscardReasonsInputSchema},
  output: {schema: AnalyzeDiscardReasonsOutputSchema},
  prompt: `Eres un analista de ventas experto. Tu tarea es analizar una lista de razones por las cuales se perdieron oportunidades de venta.

Basado en la siguiente lista de razones, agrupa causas similares en categorías (por ejemplo, 'Precio', 'Competencia', 'Tiempo', 'Sin respuesta'), calcula el porcentaje que representa cada categoría y presenta un resumen conciso. Destaca las 2-3 razones principales.

Ejemplo de respuesta:
"El análisis de las oportunidades perdidas revela que la razón principal es el Precio (45%), seguido por la elección de un Competidor (25%). También se observa un 15% de casos por falta de seguimiento. Sugerencia: Revisar la estrategia de precios y reforzar la capacitación en manejo de objeciones sobre la competencia."

Lista de Razones:
{{{reasons}}}
`,
});

const analyzeDiscardReasonsFlow = ai.defineFlow(
  {
    name: 'analyzeDiscardReasonsFlow',
    inputSchema: AnalyzeDiscardReasonsInputSchema,
    outputSchema: AnalyzeDiscardReasonsOutputSchema,
  },
  async input => {
    if (input.reasons.length === 0) {
      return { summary: 'No hay suficientes datos para analizar. No se encontraron oportunidades descartadas con motivos.' };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
