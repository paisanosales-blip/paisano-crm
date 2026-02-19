'use server';
/**
 * @fileOverview An AI agent that generates content for presentation slides.
 *
 * - generatePresentationContent - A function that generates slide content based on report data.
 * - PresentationContent - The type for a single slide's content.
 * - GeneratePresentationContentInput - The input type for the generatePresentationContent function.
 * - GeneratePresentationContentOutput - The return type for the generatePresentationContent function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const TitleSlideSchema = z.object({
  slideType: z.enum(['title_slide']),
  title: z.string().describe('The main title of the slide.'),
  subtitle: z.string().optional().describe('A subtitle, e.g., the date range of the report.'),
});

const KpiSchema = z.object({
    label: z.string().describe('The name of the key performance indicator, e.g., "Ingresos Totales".'),
    value: z.string().describe('The value of the KPI, e.g., "$125,000 USD".'),
});

const KpiSlideSchema = z.object({
  slideType: z.enum(['kpi_slide']),
  title: z.string().describe('The title for the KPI slide, e.g., "Métricas Clave del Mes".'),
  kpis: z.array(KpiSchema).min(1).max(4).describe('An array of 1 to 4 key performance indicators.'),
});

const BulletPointsSlideSchema = z.object({
  slideType: z.enum(['bullet_points_slide']),
  title: z.string().describe('The title for the bullet points slide.'),
  points: z.array(z.string()).min(1).max(5).describe('An array of 1 to 5 bullet points summarizing key findings or actions.'),
});

const QuoteSlideSchema = z.object({
  slideType: z.enum(['quote_slide']),
  quote: z.string().describe('An impactful quote or a key takeaway sentence.'),
  author: z.string().optional().describe('The author of the quote, or the source of the takeaway.'),
});

const PresentationContentSchema = z.union([
  TitleSlideSchema,
  KpiSlideSchema,
  BulletPointsSlideSchema,
  QuoteSlideSchema,
]);
export type PresentationContent = z.infer<typeof PresentationContentSchema>;


const GeneratePresentationContentInputSchema = z.object({
  reportType: z.enum(['monthly_sales_summary', 'lost_opportunities_analysis', 'weekly_performance']),
  reportData: z.string().describe('A JSON string of the data to be analyzed for the presentation.'),
  logoUrl: z.string().optional().describe('URL of the company logo to be included in the design.'),
});
export type GeneratePresentationContentInput = z.infer<typeof GeneratePresentationContentInputSchema>;


const GeneratePresentationContentOutputSchema = z.object({
  slides: z.array(PresentationContentSchema).describe('An array of slide content objects.'),
});
export type GeneratePresentationContentOutput = z.infer<typeof GeneratePresentationContentOutputSchema>;


export async function generatePresentationContent(
  input: GeneratePresentationContentInput
): Promise<GeneratePresentationContentOutput> {
  return generatePresentationContentFlow(input);
}


const prompt = ai.definePrompt({
  name: 'generatePresentationContentPrompt',
  input: { schema: GeneratePresentationContentInputSchema },
  output: { schema: GeneratePresentationContentOutputSchema },
  prompt: `Eres un analista de ventas experto y diseñador de presentaciones para "Paisano Trailer", una empresa que vende remolques de alta resistencia. Tu tarea es generar el contenido para 3-5 diapositivas de una presentación de PowerPoint, basándote en un tipo de reporte y los datos proporcionados. El tono debe ser profesional, conciso y visualmente impactante.

  **Instrucciones Generales:**
  1.  **Analiza los datos:** Revisa el JSON en 'reportData' para entender el rendimiento.
  2.  **Genera 3 a 5 diapositivas:** Crea una secuencia lógica de diapositivas que cuenten una historia.
  3.  **Variedad de Diapositivas:** Utiliza una mezcla de los tipos de diapositiva disponibles ('title_slide', 'kpi_slide', 'bullet_points_slide', 'quote_slide') para hacer la presentación dinámica.
  4.  **Enfócate en Insights:** No te limites a listar datos. Extrae conclusiones, resalta tendencias y ofrece recomendaciones clave en los puntos.
  5.  **Sé Conciso:** Cada diapositiva debe ser clara y fácil de entender. Menos es más.

  **Contexto del Reporte:**
  - Tipo de Reporte: {{{reportType}}}
  - Datos (en formato JSON): {{{reportData}}}

  **Ejemplos de cómo pensar para cada tipo de reporte:**

  - **Si reportType es 'monthly_sales_summary':**
    - **Diapositiva 1 (title_slide):** Título como "Resumen de Ventas" y el mes/año.
    - **Diapositiva 2 (kpi_slide):** Métricas clave como "Ingresos Totales", "Nuevos Clientes", "Tasa de Conversión".
    - **Diapositiva 3 (bullet_points_slide):** Conclusiones principales, como "Aumento del 20% en ventas de 'Sand Hopper'" o "Recomendación: Enfocar esfuerzos en el sector de construcción".
    - **Diapositiva 4 (quote_slide):** Una frase impactante como "La constancia en el seguimiento fue clave para superar la meta este mes."

  - **Si reportType es 'lost_opportunities_analysis':**
    - **Diapositiva 1 (title_slide):** Título como "Análisis de Oportunidades Perdidas".
    - **Diapositiva 2 (kpi_slide):** KPIs como "Total Oportunidades Perdidas" y "Principal Motivo de Descarte". Usa los datos para encontrar el motivo más común.
    - **Diapositiva 3 (bullet_points_slide):** Título "Plan de Acción". Puntos como "Mejorar calificación inicial para reducir pérdidas por 'Sin presupuesto'" o "Crear guion para objeciones de precio".
  
  - **Si reportType es 'weekly_performance':**
    - **Diapositiva 1 (title_slide):** Título "Rendimiento Semanal".
    - **Diapositiva 2 (kpi_slide):** KPIs como "Nuevos Prospectos Creados", "Seguimientos Completados".
    - **Diapositiva 3 (bullet_points_slide):** Título "Logros y Desafíos". Puntos como "Logro: Se contactaron al 100% de los nuevos prospectos." y "Desafío: 5 seguimientos se encuentran atrasados."
    - **Diapositiva 4 (quote_slide):** Una frase motivacional como "La disciplina de esta semana definirá las ventas del próximo mes." con autor "Coach de Ventas".

  Ahora, genera el contenido para la presentación basándote en los datos y el tipo de reporte proporcionados.
  `,
});

const generatePresentationContentFlow = ai.defineFlow(
  {
    name: 'generatePresentationContentFlow',
    inputSchema: GeneratePresentationContentInputSchema,
    outputSchema: GeneratePresentationContentOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
