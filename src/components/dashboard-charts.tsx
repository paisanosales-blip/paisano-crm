'use client';

import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import React from 'react';
import { Skeleton } from './ui/skeleton';

const salesByRegionConfig = {
    sales: { label: 'Ventas' },
    Norte: { label: 'Norte', color: 'hsl(var(--chart-1))' },
    Centro: { label: 'Centro', color: 'hsl(var(--chart-2))' },
    Sur: { label: 'Sur', color: 'hsl(var(--chart-3))' },
    Otro: { label: 'Otro', color: 'hsl(var(--chart-4))' },
} satisfies ChartConfig;

const pipelineConfig = {
    count: { label: 'Oportunidades' },
    'Primer contacto': { label: 'Contacto', color: 'hsl(var(--chart-1))' },
    'Envió de Información': { label: 'Información', color: 'hsl(var(--chart-2))' },
    'Envió de Cotización': { label: 'Cotización', color: 'hsl(var(--chart-3))' },
    'Negociación': { label: 'Negociación', color: 'hsl(var(--chart-4))' },
    'Cierre de venta': { label: 'Cierre', color: 'hsl(var(--chart-5))' },
} satisfies ChartConfig;

const prospectSourceConfig = {
    count: { label: 'Prospectos' },
    'REDESSOCIALES': { label: 'Redes Sociales', color: 'hsl(var(--chart-1))' },
    'PUBLICIDAD': { label: 'Publicidad', color: 'hsl(var(--chart-2))' },
    'BUSQUEDAENGOOGLE': { label: 'Búsqueda en Google', color: 'hsl(var(--chart-3))' },
    'BUSQUEDAENMAPS': { label: 'Búsqueda en Maps', color: 'hsl(var(--chart-4))' },
    'Desconocido': { label: 'Desconocido', color: 'hsl(var(--chart-5))' },
} satisfies ChartConfig;

interface DashboardChartsProps {
    opportunities: any[] | null;
    leads: any[] | null;
    isLoading: boolean;
}

export function DashboardCharts({ opportunities, leads, isLoading }: DashboardChartsProps) {

    const salesByRegionData = React.useMemo(() => {
        if (!opportunities || !leads) return [];

        const leadsMap = new Map(leads.map(lead => [lead.id, lead]));
        const salesByRegion = opportunities
            .filter(opp => opp.stage === 'Cierre de venta' && opp.value > 0)
            .reduce((acc, opp) => {
                const lead = leadsMap.get(opp.leadId);
                const region = lead?.region || 'Otro';
                acc[region] = (acc[region] || 0) + opp.value;
                return acc;
            }, {} as Record<string, number>);

        return Object.entries(salesByRegion).map(([region, sales]) => ({
            region,
            sales,
            fill: `var(--color-${region})`,
        }));
    }, [opportunities, leads]);


    const pipelineData = React.useMemo(() => {
        if (!opportunities) return [];
        const stageCounts = opportunities.reduce((acc, opp) => {
            const stage = opp.stage || 'Desconocido';
            acc[stage] = (acc[stage] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        return Object.entries(stageCounts).map(([stage, count]) => ({ 
            stage, 
            count,
            fill: pipelineConfig[stage as keyof typeof pipelineConfig]?.color || 'hsl(var(--muted))'
        }));
    }, [opportunities]);

     const prospectSourceData = React.useMemo(() => {
        if (!leads) return [];
        const sourceCounts = leads.reduce((acc, lead) => {
            const source = lead.contactMethod || 'Desconocido';
            acc[source] = (acc[source] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(sourceCounts).map(([source, count]) => {
            const configKey = source.replace(/\s+/g, '').toUpperCase();
            return {
                source,
                count,
                fill: prospectSourceConfig[configKey as keyof typeof prospectSourceConfig]?.color || 'hsl(var(--muted))',
            };
        });
    }, [leads]);

    if (isLoading) {
        return (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <Skeleton className="lg:col-span-3 h-[400px]" />
                <Skeleton className="lg:col-span-2 h-[400px]" />
                <Skeleton className="lg:col-span-2 h-[400px]" />
            </div>
        )
    }

  return (
    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-7">
        <Card className="lg:col-span-3">
            <CardHeader>
                <CardTitle>Ventas por Región</CardTitle>
                <CardDescription>Un vistazo al rendimiento de ventas en diferentes regiones.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
                 {salesByRegionData.length > 0 ? (
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
                                tickFormatter={(value) => salesByRegionConfig[value as keyof typeof salesByRegionConfig]?.label || value}
                            />
                            <XAxis dataKey="sales" type="number" hide />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" />}
                            />
                            <Bar dataKey="sales" radius={4} />
                        </BarChart>
                    </ChartContainer>
                 ) : (
                    <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                        No hay datos de ventas para mostrar.
                    </div>
                 )}
            </CardContent>
        </Card>
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>Fuente de Prospectos</CardTitle>
                <CardDescription>Canales de origen de los prospectos.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
                 {prospectSourceData.length > 0 ? (
                    <ChartContainer config={prospectSourceConfig} className="h-[300px] w-full">
                        <BarChart
                            accessibilityLayer
                            data={prospectSourceData}
                            layout="vertical"
                            margin={{ left: 10 }}
                        >
                            <CartesianGrid horizontal={false} />
                            <YAxis
                                dataKey="source"
                                type="category"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                tickFormatter={(value) => {
                                    const configKey = value.replace(/\s+/g, '').toUpperCase();
                                    return prospectSourceConfig[configKey as keyof typeof prospectSourceConfig]?.label || value;
                                }}
                            />
                            <XAxis dataKey="count" type="number" hide />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" />}
                            />
                            <Bar dataKey="count" radius={4} />
                        </BarChart>
                    </ChartContainer>
                 ) : (
                    <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                        No hay datos de prospectos.
                    </div>
                 )}
            </CardContent>
        </Card>
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>Resumen del Flujo</CardTitle>
                <CardDescription>Distribución de oportunidades.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center [&>div]:h-[300px]">
                {pipelineData.length > 0 ? (
                    <ChartContainer config={pipelineConfig} className="mx-auto aspect-square h-full">
                        <PieChart>
                            <ChartTooltip content={<ChartTooltipContent nameKey="stage" hideLabel />} />
                            <Pie data={pipelineData} dataKey="count" nameKey="stage">
                               {pipelineData.map((entry) => (
                                <Cell key={`cell-${entry.stage}`} fill={entry.fill} />
                               ))}
                            </Pie>
                            <ChartLegend content={<ChartLegendContent nameKey="stage" />} />
                        </PieChart>
                    </ChartContainer>
                ) : (
                     <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                        No hay oportunidades.
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
