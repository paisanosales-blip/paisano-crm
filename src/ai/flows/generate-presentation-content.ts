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
  prompt: `Eres un analista de ventas experto y diseñador de presentaciones para "Paisano Trailer". Tu tarea es generar el contenido para múltiples diapositivas, basándote en un tipo de reporte y los datos JSON proporcionados.

  **Instrucciones CRÍTICAS:**
  1.  **USA SOLO LOS DATOS PROPORCIONADOS:** Basa TODA tu respuesta ÚNICAMENTE en los datos JSON de \`reportData\`. No inventes ninguna cifra. Si un dato no está, no lo menciones.
  2.  **SÉ EXTREMADAMENTE CONCISO:** El texto para títulos y puntos debe ser muy breve. Usa frases cortas.
  3.  **MÁS DIAPOSITIVAS, MENOS TEXTO:** Prefiere crear más diapositivas con poca información que pocas diapositivas con mucha. No intentes meter todo en una sola.
  4.  **VARÍA EL DISEÑO:** Utiliza una mezcla de los tipos de diapositiva disponibles, especialmente 'bar_chart_slide' para datos numéricos.
  5.  **UNA IDEA POR DIAPOSITIVA DE ANÁLISIS:** Cada diapositiva de análisis ('bullet_points_slide') debe tener 1 o 2 puntos clave como máximo.
  
  **Contexto del Reporte:**
  - Tipo de Reporte: {{{reportType}}}
  - Datos (en formato JSON): {{{reportData}}}

  **Lógica de Generación de Contenido:**

  - **Si reportType es 'monthly_sales_summary' o 'weekly_performance':**
    - **Diapositiva 1 (title_slide):** Título: "Resumen de Ventas {reportData.period}", Subtítulo: (Fecha actual).
    - **Diapositiva 2 (kpi_slide):** Título: "Indicadores Clave". KPIs: "Nuevos Prospectos", "Clientes Potenciales", "Clientes Ganados", "Cotizaciones Realizadas", "Financiamiento", "Descartados". Usa los datos de \`reportData.kpis\`. Sé muy conciso en los labels.
    - **Diapositiva 3 (bar_chart_slide):** Título: "Top 5 Ciudades con Clientes Potenciales". Usa los datos de \`reportData.charts.potentialByCity\`.
    - **Diapositiva 4 (bullet_points_slide):** Título: "Análisis: Geografía de Clientes". Escribe 1 o 2 puntos clave sobre las ciudades más importantes. Ej: "La mayoría de clientes potenciales se concentran en [Ciudad 1]."
    - **Diapositiva 5 (bar_chart_slide):** Título: "Top 5 Estados con Prospectos (USA)". Usa los datos de \`reportData.charts.prospectsByState\`.
    - **Diapositiva 6 (bullet_points_slide):** Título: "Análisis: Presencia en USA". Escribe 1 o 2 puntos sobre los estados con mayor actividad.
    - **Diapositiva 7 (bar_chart_slide):** Título: "Origen de los Prospectos". Usa los datos de \`reportData.charts.prospectSources\`.
    - **Diapositiva 8 (bullet_points_slide):** Título: "Análisis: Canales de Adquisición". Menciona el canal más efectivo y alguna oportunidad. Ej: "Google es el principal generador de prospectos."
    - **Diapositiva 9 (bar_chart_slide):** Título: "Resumen del Flujo de Ventas". Usa los datos de \`reportData.charts.pipelineSummary\`.
    - **Diapositiva 10 (bullet_points_slide):** Título: "Análisis: Flujo de Ventas". Destaca dónde se están acumulando o perdiendo más prospectos. Ej: "Hay un alto número de prospectos en la etapa de 'Negociación'."
    - **Diapositiva 11 (bullet_points_slide):** Título: "Conclusiones y Acciones". Basado en TODO lo anterior, crea 3 puntos finales con acciones recomendadas. Ej: "1. Enfocar esfuerzos de marketing en Texas.", "2. Mejorar guion para objeciones de precio."

  - **Si reportType es 'lost_opportunities_analysis':**
    - **Diapositiva 1 (title_slide):** Título: "Análisis de Oportunidades Perdidas".
    - **Diapositiva 2 (kpi_slide):** Título: "Impacto de Descarte". KPIs: "Total Descartados" (usa \`reportData.totalDiscarded\`), "Valor Potencial Perdido" (usa \`reportData.totalValueLost\`).
    - **Diapositiva 3 (bar_chart_slide):** Título: "Principales Motivos de Descarte". Analiza los datos de \`reportData.reasons\` (array de strings) para agrupar y contar motivos, y crea un gráfico de barras.
    - **Diapositiva 4 (bullet_points_slide):** Título: "Plan de Acción". Basado en el gráfico anterior, sugiere 3-4 acciones concretas y cortas. Ej: "1. Crear guion para objeción de precio.", "2. Ofrecer financiamiento alternativo.", "3. Mejorar calificación inicial."

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
