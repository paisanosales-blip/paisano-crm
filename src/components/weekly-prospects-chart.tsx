'use client';

import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, LabelList } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from './ui/skeleton';
import { startOfMonth, endOfMonth, getWeek, isWithinInterval } from 'date-fns';

interface WeeklyProspectsChartProps {
    opportunities: any[] | null;
    currentMonth: Date;
    isLoading: boolean;
}

const chartConfig = {
    prospects: {
        label: 'Prospectos',
        color: 'hsl(var(--chart-1))',
    },
} satisfies ChartConfig;

export function WeeklyProspectsChart({ opportunities, currentMonth, isLoading }: WeeklyProspectsChartProps) {
    const weeklyData = useMemo(() => {
        if (!opportunities) return [];

        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const startWeek = getWeek(monthStart);

        const opportunitiesInMonth = opportunities.filter(opp => {
            if (!opp.createdDate) return false;
            const createdDate = new Date(opp.createdDate);
            return isWithinInterval(createdDate, { start: monthStart, end: monthEnd });
        });

        const weeklyCounts = opportunitiesInMonth.reduce((acc, opp) => {
            const weekNumber = getWeek(new Date(opp.createdDate)) - startWeek + 1;
            const weekKey = `Semana ${weekNumber}`;
            acc[weekKey] = (acc[weekKey] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Ensure all weeks of the month are present, even if with 0 prospects
        const totalWeeks = getWeek(monthEnd) - startWeek + 1;
        const chartData = Array.from({ length: totalWeeks }, (_, i) => {
            const weekKey = `Semana ${i + 1}`;
            return {
                week: weekKey,
                prospects: weeklyCounts[weekKey] || 0,
            };
        });

        return chartData;

    }, [opportunities, currentMonth]);

    if (isLoading) {
        return <Skeleton className="h-96 w-full" />;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Generación de Prospectos por Semana</CardTitle>
                <CardDescription>
                    Nuevas oportunidades creadas cada semana en el mes seleccionado.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {weeklyData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[350px] w-full">
                        <BarChart accessibilityLayer data={weeklyData} margin={{ top: 20 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="week"
                                tickLine={false}
                                tickMargin={10}
                                axisLine={false}
                            />
                            <YAxis />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" />}
                            />
                            <Bar
                                dataKey="prospects"
                                fill="var(--color-prospects)"
                                radius={4}
                            >
                                <LabelList dataKey="prospects" position="top" offset={4} className="fill-foreground" fontSize={12} />
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                ) : (
                    <div className="h-[350px] w-full flex items-center justify-center text-muted-foreground">
                        No hay datos de prospectos para este mes.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
