'use client';

import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { opportunities } from '@/lib/data';
import type { ChartConfig } from '@/components/ui/chart';

const salesByRegionData = [
    { region: 'Norte', sales: 90000, fill: 'var(--color-norte)' },
    { region: 'Centro', sales: 75000, fill: 'var(--color-centro)' },
    { region: 'Sur', sales: 120000, fill: 'var(--color-sur)' },
];

const salesByRegionConfig = {
    sales: { label: 'Ventas', color: 'hsl(var(--primary))' },
    norte: { label: 'Norte', color: 'hsl(var(--chart-1))' },
    centro: { label: 'Centro', color: 'hsl(var(--chart-2))' },
    sur: { label: 'Sur', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig;

const pipelineData = Object.entries(
    opportunities.reduce((acc, opp) => {
        if (!['Ganada', 'Perdida'].includes(opp.stage)) {
            acc[opp.stage] = (acc[opp.stage] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>)
).map(([stage, count]) => ({ stage, count }));


const pipelineConfig = {
    count: { label: 'Oportunidades' },
    Prospecto: { label: 'Prospecto', color: 'hsl(var(--chart-1))' },
    Calificación: { label: 'Calificación', color: 'hsl(var(--chart-2))' },
    Propuesta: { label: 'Propuesta', color: 'hsl(var(--chart-3))' },
    Negociación: { label: 'Negociación', color: 'hsl(var(--chart-4))' },
} satisfies ChartConfig;


export function DashboardCharts() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
            <CardHeader>
                <CardTitle>Ventas por Región</CardTitle>
                <CardDescription>Un vistazo al rendimiento de ventas en diferentes regiones.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
                 <ChartContainer config={salesByRegionConfig} className="h-[300px] w-full">
                    <BarChart
                        accessibilityLayer
                        data={salesByRegionData}
                        layout="vertical"
                        margin={{ left: 10 }}
                    >
                        <CartesianGrid horizontal={false} />
                        <YAxis
                            dataKey="region"
                            type="category"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={10}
                        />
                        <XAxis dataKey="sales" type="number" hide />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dot" />}
                        />
                        <Bar dataKey="sales" fill="var(--color-sales)" radius={4} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
        <Card className="lg:col-span-3">
            <CardHeader>
                <CardTitle>Resumen del Pipeline</CardTitle>
                <CardDescription>Distribución actual de oportunidades en el pipeline de ventas.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center [&>div]:h-[250px]">
                <ChartContainer config={pipelineConfig} className="mx-auto aspect-square h-full">
                    <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="stage" hideLabel />} />
                        <Pie data={pipelineData} dataKey="count" nameKey="stage" />
                        <ChartLegend content={<ChartLegendContent nameKey="stage" />} />
                    </PieChart>
                </ChartContainer>
            </CardContent>
        </Card>
    </div>
  );
}
