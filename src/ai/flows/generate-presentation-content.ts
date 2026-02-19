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
  reportData: z.any(),
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
  prompt: `Eres un analista de ventas experto y diseñador de presentaciones para "Paisano Trailer". Tu tarea es generar el contenido para múltiples diapositivas, basándote en un tipo de reporte y los datos proporcionados.

  **Instrucciones MUY IMPORTANTES:**
  1.  **CRÍTICO: Debes basar TODA tu respuesta ÚNICAMENTE en los datos JSON proporcionados en \`reportData\`. No inventes, alucines ni extrapoles ninguna información o cifra. Si un dato no está presente, no lo menciones.**
  2.  **SÉ EXTREMADAMENTE CONCISO.** El texto para títulos y puntos debe ser muy breve para que quepa en la diapositiva.
  3.  **USA MÚLTIPLES DIAPOSITIVAS.** No intentes meter toda la información en una sola. Si un tema necesita más explicación, crea diapositivas adicionales.
  4.  **Variedad de Diapositivas:** Utiliza una mezcla de los tipos de diapositiva disponibles.
  5.  **Usa Gráficos:** Para datos numéricos, usa 'bar_chart_slide'. No pongas más de 5-7 barras por gráfico.
  
  **Contexto del Reporte:**
  - Tipo de Reporte: {{{reportType}}}
  - Datos (en formato JSON): {{{reportData}}}

  **Lógica de Generación de Contenido:**

  - **Si reportType es 'monthly_sales_summary' o 'weekly_performance':**
    - **Diapositiva 1 (title_slide):** Título: "Resumen de Ventas {reportData.period}", Subtítulo: (Fecha actual).
    - **Diapositiva 2 (kpi_slide):** Título: "Indicadores Clave del Periodo". KPIs: "Nuevos Prospectos", "Clientes Potenciales", "Clientes Ganados", "Cotizaciones Realizadas". Usa los datos de \`reportData.kpis\`.
    - **Diapositiva 3 (bar_chart_slide):** Título: "Top 5 Ciudades con Clientes Potenciales". Usa los datos de \`reportData.charts.potentialByCity\`.
    - **Diapositiva 4 (bar_chart_slide):** Título: "Top 5 Estados con Prospectos (USA)". Usa los datos de \`reportData.charts.prospectsByState\`.
    - **Diapositiva 5 (bar_chart_slide):** Título: "Origen de los Prospectos". Usa los datos de \`reportData.charts.prospectSources\`.
    - **Diapositiva 6 (bar_chart_slide):** Título: "Resumen del Flujo de Ventas (Total)". Usa los datos de \`reportData.charts.pipelineSummary\`.
    - **Diapositiva 7 (bullet_points_slide):** Título: "Análisis y Recomendaciones". Usando SÓLO los datos proporcionados, especialmente los KPIs y las razones de descarte (\`reportData.discardedReasons\`), escribe 3-4 puntos clave. Por ejemplo: "El 40% de los descartes son por precio, se recomienda revisar la estrategia.", "La mayoría de prospectos vienen de Google, invertir más en SEO."

  - **Si reportType es 'lost_opportunities_analysis':**
    - **Diapositiva 1 (title_slide):** Título: "Análisis de Oportunidades Perdidas".
    - **Diapositiva 2 (bar_chart_slide):** Título: "Principales Motivos de Descarte". Analiza los datos de \`reportData\` (que será un array de strings con razones) para agrupar y contar los motivos, y crea un gráfico de barras.
    - **Diapositiva 3 (bullet_points_slide):** Título: "Plan de Acción". Basado en el gráfico anterior, sugiere 3 acciones concretas. Ej: "Crear guion para objeciones de precio", "Mejorar calificación inicial para evitar prospectos sin presupuesto".

  Ahora, genera el contenido para la presentación.
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
