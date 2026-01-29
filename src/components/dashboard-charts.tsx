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
    sales: { label: 'Sales', color: 'hsl(var(--primary))' },
    norte: { label: 'Norte', color: 'hsl(var(--chart-1))' },
    centro: { label: 'Centro', color: 'hsl(var(--chart-2))' },
    sur: { label: 'Sur', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig;

const pipelineData = Object.entries(
    opportunities.reduce((acc, opp) => {
        if (!['Closed Won', 'Closed Lost'].includes(opp.stage)) {
            acc[opp.stage] = (acc[opp.stage] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>)
).map(([stage, count]) => ({ stage, count }));


const pipelineConfig = {
    count: { label: 'Opportunities' },
    Prospect: { label: 'Prospect', color: 'hsl(var(--chart-1))' },
    Qualification: { label: 'Qualification', color: 'hsl(var(--chart-2))' },
    Proposal: { label: 'Proposal', color: 'hsl(var(--chart-3))' },
    Negotiation: { label: 'Negotiation', color: 'hsl(var(--chart-4))' },
} satisfies ChartConfig;


export function DashboardCharts() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
            <CardHeader>
                <CardTitle>Sales by Region</CardTitle>
                <CardDescription>A look at sales performance across different regions.</CardDescription>
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
                <CardTitle>Pipeline Overview</CardTitle>
                <CardDescription>Current distribution of opportunities in the sales pipeline.</CardDescription>
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
