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
  title: z.string().describe('The main title of the slide. Should be very concise.'),
  subtitle: z.string().optional().describe('A subtitle, e.g., the date range of the report. Keep it brief.'),
});

const KpiSchema = z.object({
    label: z.string().describe('The name of the key performance indicator, e.g., "Ingresos". Use a short label.'),
    value: z.string().describe('The value of the KPI, e.g., "$125,000".'),
});

const KpiSlideSchema = z.object({
  slideType: z.enum(['kpi_slide']),
  title: z.string().describe('The title for the KPI slide, e.g., "Métricas Clave". Should be concise.'),
  kpis: z.array(KpiSchema).min(1).max(4).describe('An array of 1 to 4 key performance indicators.'),
});

const BulletPointsSlideSchema = z.object({
  slideType: z.enum(['bullet_points_slide']),
  title: z.string().describe('The title for the bullet points slide. Should be concise.'),
  points: z.array(z.string()).min(1).max(3).describe('An array of 1 to 3 short bullet points summarizing key findings or actions.'),
});

const QuoteSlideSchema = z.object({
  slideType: z.enum(['quote_slide']),
  quote: z.string().describe('An impactful quote or a key takeaway sentence. Should be brief.'),
  author: z.string().optional().describe('The author of the quote, or the source of the takeaway.'),
});

const BarChartSlideSchema = z.object({
  slideType: z.enum(['bar_chart_slide']),
  title: z.string().describe('The title for the bar chart slide, e.g., "Ventas por Categoría". Should be concise.'),
  data: z.array(z.object({
    name: z.string().describe('The label for a bar on the x-axis. Use short names.'),
    value: z.number().describe('The numerical value for the bar.'),
  })).min(1).max(5).describe('An array of 1 to 5 data points for the bar chart.'),
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

### 🔴 INSTRUCCIONES GENERALES (MUY IMPORTANTE)
- **Solo incluir información si el dato existe en la app.** Si un dato no está disponible, omitirlo completamente.
- **No inventar métricas ni estimar valores.**
- **No saturar las diapositivas.** Máximo 3–5 elementos visuales o puntos por diapositiva.
- El análisis debe ser **claro, breve y estratégico**. Evitar párrafos largos.
- Cada diapositiva debe tener datos claros y 1–3 insights estratégicos como máximo, con enfoque comercial y de toma de decisiones.

**Contexto del Reporte:**
- Tipo de Reporte: {{{reportType}}}
- Datos (en formato JSON): {{{reportData}}}

---

### 📊 LÓGICA PARA "RESUMEN DE PROSPECCIÓN MENSUAL" o "weekly_performance"

**🔹 Diapositiva 1: Título**
- **slideType:** \`title_slide\`
- **Contenido:**
  - \`title\`: "RESUMEN DE PROSPECCIÓN MENSUAL" o "RESUMEN DE PROSPECCIÓN SEMANAL".
  - \`subtitle\`: Usar el \`reportData.period\` si existe.

**🔹 Diapositiva 2: Indicadores Clave (KPIs Principales)**
- **slideType:** \`kpi_slide\`
- **Contenido:** Mostrar únicamente si los datos existen en \`reportData.kpis\`.
  - KPIs: "Nuevos Prospectos", "Clientes Potenciales", "Clientes Ganados", "Financiamiento".
- **Objetivo:** Vista ejecutiva rápida del desempeño comercial.

**🔹 Diapositiva 3: Actividad Comercial**
- **slideType:** \`kpi_slide\`
- **Contenido:** Mostrar únicamente si los datos existen en \`reportData.kpis\`.
  - KPIs: "Cotizaciones Realizadas", "Prospectos Descartados".
- **Objetivo:** Resumir la actividad clave del embudo.

**🔹 Diapositiva 4: Top 5 Ciudades con Clientes Potenciales**
- **slideType:** \`bar_chart_slide\`
- **Condición:** Solo si \`reportData.charts.potentialByCity\` tiene datos.
- **Contenido:** Gráfico de barras con las 5 ciudades con más clientes potenciales.
- **Análisis:** Después de esta, crea una diapositiva \`bullet_points_slide\` con 1-2 insights breves sobre la concentración del mercado y oportunidades.

**🔹 Diapositiva 5: Top 5 Estados (USA)**
- **slideType:** \`bar_chart_slide\`
- **Condición:** Solo si \`reportData.charts.prospectsByState\` tiene datos.
- **Contenido:** Gráfico de barras con los 5 estados de USA con más prospectos.
- **Análisis:** Después de esta, crea una diapositiva \`bullet_points_slide\` con 1-2 interpretaciones claras sobre la presencia en USA.

**🔹 Diapositiva 6: Origen de Prospectos**
- **slideType:** \`bar_chart_slide\`
- **Condición:** Solo si \`reportData.charts.prospectSources\` tiene datos.
- **Contenido:** Gráfico de barras mostrando los canales de origen que existan.
- **Análisis:** Después de esta, crea una diapositiva \`bullet_points_slide\` con 1-3 insights sobre el canal con mayor volumen y oportunidades de mejora.

**🔹 Diapositiva 7: Flujo de Ventas**
- **slideType:** \`bar_chart_slide\`
- **Condición:** Solo si \`reportData.charts.pipelineSummary\` tiene datos.
- **Contenido:** Gráfico de barras mostrando la distribución de prospectos por etapa.
- **Análisis:** Después de esta, crea una diapositiva \`bullet_points_slide\` con 1-3 interpretaciones sobre cuellos de botella o fugas en el proceso.

**🔹 Diapositiva 8: Diagnóstico Comercial del Periodo**
- **slideType:** \`bullet_points_slide\`
- **Contenido:** Un resumen ejecutivo con máximo 3 hallazgos clave enfocados en: generación vs conversión, eficiencia del proceso y la principal oportunidad de mejora.

**🔹 Diapositiva 9: Plan de Acción**
- **slideType:** \`bullet_points_slide\`
- **Contenido:** Generar máximo 3 acciones concretas, específicas y ejecutables, directamente relacionadas con los datos y análisis anteriores.

---

### 📊 LÓGICA PARA "lost_opportunities_analysis"

**🔹 Diapositiva 1: Título**
- **slideType:** \`title_slide\`
- **Contenido:**
  - \`title\`: "Análisis de Oportunidades Perdidas"
  - \`subtitle\`: Usar \`reportData.period\` si existe.

**🔹 Diapositiva 2: Impacto del Descarte (KPIs)**
- **slideType:** \`kpi_slide\`
- **Contenido:**
  - KPIs: "Total Descartados" (usar \`reportData.totalDiscarded\`), "Valor Potencial Perdido" (usar \`reportData.totalValueLost\`).

**🔹 Diapositiva 3: Gráfico - Principales Motivos de Descarte**
- **slideType:** \`bar_chart_slide\`
- **Condición:** Si \`reportData.reasons\` tiene datos.
- **Contenido:** Agrupa y cuenta los motivos del array \`reportData.reasons\` para crear el gráfico.

**🔹 Diapositiva 4: Plan de Acción Sugerido**
- **slideType:** \`bullet_points_slide\`
- **Contenido:** Basado en el gráfico anterior, sugiere 3 acciones concretas y directas para mitigar las pérdidas (Ej: "Mejorar guion para objeción de precio.").

---
Ahora, genera el contenido para la presentación siguiendo estas estrictas instrucciones.
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
