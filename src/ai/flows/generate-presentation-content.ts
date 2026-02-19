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

const BarChartSlideSchema = z.object({
  slideType: z.enum(['bar_chart_slide']),
  title: z.string().describe('The title for the bar chart slide, e.g., "Ventas por Categoría".'),
  data: z.array(z.object({
    name: z.string().describe('The label for a bar on the x-axis.'),
    value: z.number().describe('The numerical value for the bar.'),
  })).describe('An array of data points for the bar chart.'),
});


const PresentationContentSchema = z.union([
  TitleSlideSchema,
  KpiSlideSchema,
  BulletPointsSlideSchema,
  QuoteSlideSchema,
  BarChartSlideSchema,
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

  **Instrucciones MUY IMPORTANTES:**
  1.  **SÉ EXTREMADAMENTE CONCISO.** El texto para títulos y puntos debe ser muy breve para que quepa en el diseño de la diapositiva. Usa frases cortas y directas.
  2.  **Analiza los datos:** Revisa el JSON en 'reportData' para entender el rendimiento.
  3.  **Genera 3 a 5 diapositivas:** Crea una secuencia lógica de diapositivas que cuenten una historia.
  4.  **Variedad de Diapositivas:** Utiliza una mezcla de los tipos de diapositiva disponibles ('title_slide', 'kpi_slide', 'bullet_points_slide', 'quote_slide', 'bar_chart_slide').
  5.  **Enfócate en Insights:** No te limites a listar datos. Extrae conclusiones, resalta tendencias y ofrece recomendaciones clave en los puntos.
  6.  **Usa Gráficos:** Cuando los datos contengan valores numéricos comparables (ej. ventas por producto, oportunidades por etapa), usa 'bar_chart_slide' para visualizarlos.

  **Contexto del Reporte:**
  - Tipo de Reporte: {{{reportType}}}
  - Datos (en formato JSON): {{{reportData}}}

  **Ejemplos de cómo pensar para cada tipo de reporte:**

  - **Si reportType es 'monthly_sales_summary':**
    - **Diapositiva 1 (title_slide):** Título: "Resumen de Ventas", Subtítulo: (Mes y Año).
    - **Diapositiva 2 (kpi_slide):** KPIs clave: "Ingresos Totales", "Nuevos Clientes", "Tasa de Conversión".
    - **Diapositiva 3 (bar_chart_slide):** Título: "Ingresos por Producto". Data: Un array con objetos \`{name: 'Nombre Producto', value: 50000}\`.
    - **Diapositiva 4 (bullet_points_slide):** Título: "Claves y Acciones". Puntos: "Aumento del 20% en 'Sand Hopper'", "Acción: Enfocar en construcción".

  - **Si reportType es 'lost_opportunities_analysis':**
    - **Diapositiva 1 (title_slide):** Título: "Análisis de Oportunidades Perdidas".
    - **Diapositiva 2 (bar_chart_slide):** Título: "Principales Motivos de Descarte". Data: Array con \`{name: 'Precio', value: 15}\`, \`{name: 'Competencia', value: 8}\`.
    - **Diapositiva 3 (bullet_points_slide):** Título: "Plan de Acción". Puntos: "Mejorar calificación inicial", "Crear guion para objeciones de precio".
  
  - **Si reportType es 'weekly_performance':**
    - **Diapositiva 1 (title_slide):** Título: "Rendimiento Semanal".
    - **Diapositiva 2 (kpi_slide):** KPIs: "Prospectos Creados", "Seguimientos Completados".
    - **Diapositiva 3 (bullet_points_slide):** Título: "Logros y Desafíos". Puntos: "Logro: 100% de contacto a nuevos prospectos.", "Desafío: 5 seguimientos atrasados."
    - **Diapositiva 4 (quote_slide):** Cita motivacional: "La disciplina de hoy define las ventas de mañana.", Autor: "Coach de Ventas".

  Ahora, genera el contenido para la presentación basándote en los datos y el tipo de reporte proporcionados. Sé breve y directo.
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
