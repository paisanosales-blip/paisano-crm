'use client';

import React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, LabelList, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from './ui/skeleton';

interface ResponseRateChartProps {
    data: {
        day: string;
        'Tasa de Respuesta': number;
        'Llamadas Totales': number;
    }[];
    isLoading: boolean;
}

const chartConfig = {
    'Tasa de Respuesta': {
        label: 'Tasa de Respuesta (%)',
    },
} satisfies ChartConfig;

export function ResponseRateChart({ data, isLoading }: ResponseRateChartProps) {
    if (isLoading) {
        return <Skeleton className="h-96 w-full" />;
    }

    const dayOrder = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const sortedData = data.sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Mejores Días de Contacto</CardTitle>
                <CardDescription>
                    Tasa de respuesta de clientes en llamadas completadas por día de la semana.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {sortedData.length > 0 && sortedData.some(d => d['Llamadas Totales'] > 0) ? (
                    <ChartContainer config={chartConfig} className="h-[350px] w-full">
                        <BarChart accessibilityLayer data={sortedData} margin={{ top: 20 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="day"
                                tickLine={false}
                                tickMargin={10}
                                axisLine={false}
                            />
                            <YAxis unit="%" />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent 
                                    formatter={(value, name, props) => {
                                        if (name === 'Tasa de Respuesta') {
                                            return [`${value}%`, `Llamadas Totales: ${props.payload['Llamadas Totales']}`];
                                        }
                                        return [value as string, name as string];
                                    }}
                                    indicator="dot" 
                                />}
                            />
                            <Bar dataKey="Tasa de Respuesta" radius={4}>
                                <LabelList
                                    position="top"
                                    offset={10}
                                    className="fill-foreground"
                                    fontSize={12}
                                    formatter={(value: number) => `${value}%`}
                                />
                                {sortedData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                ) : (
                    <div className="h-[350px] w-full flex items-center justify-center text-muted-foreground">
                        No hay suficientes datos de llamadas completadas para mostrar estadísticas.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
