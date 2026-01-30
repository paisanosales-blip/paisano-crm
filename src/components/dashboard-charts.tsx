'use client';

import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import React from 'react';
import { Skeleton } from './ui/skeleton';
import { getClassification } from '@/lib/types';

const potentialClientsByRegionConfig = {
    clients: { label: 'Clientes Potenciales' },
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

    const potentialClientsByRegionData = React.useMemo(() => {
        if (!opportunities || !leads) return [];

        const leadsMap = new Map(leads.map(lead => [lead.id, lead]));
        const clientsByRegion = opportunities
            .filter(opp => getClassification(opp.stage) === 'CLIENTE POTENCIAL')
            .reduce((acc, opp) => {
                const lead = leadsMap.get(opp.leadId);
                const region = lead?.region || 'Otro';
                acc[region] = (acc[region] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

        return Object.entries(clientsByRegion).map(([region, clients]) => ({
            region,
            clients,
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
                <CardTitle>Clientes Potenciales por Región</CardTitle>
                <CardDescription>Distribución de oportunidades en cotización o negociación.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
                 {potentialClientsByRegionData.length > 0 ? (
                    <ChartContainer config={potentialClientsByRegionConfig} className="h-[300px] w-full">
                        <BarChart
                            accessibilityLayer
                            data={potentialClientsByRegionData}
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
                                tickFormatter={(value) => potentialClientsByRegionConfig[value as keyof typeof potentialClientsByRegionConfig]?.label || value}
                            />
                            <XAxis dataKey="clients" type="number" hide />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" />}
                            />
                            <Bar dataKey="clients" radius={4} />
                        </BarChart>
                    </ChartContainer>
                 ) : (
                    <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                        No hay clientes potenciales para mostrar.
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
