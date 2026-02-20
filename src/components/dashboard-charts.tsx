'use client';

import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis, Cell, LabelList, Funnel, FunnelChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import React from 'react';
import { Skeleton } from './ui/skeleton';
import { getClassification } from '@/lib/types';
import { states } from '@/lib/geography';

const pipelineConfig = {
    count: { label: 'Oportunidades' },
    'Primer contacto': { label: 'Contacto', color: 'hsl(var(--chart-1))' },
    'Envió de Información': { label: 'Información', color: 'hsl(var(--chart-2))' },
    'Envió de Cotización': { label: 'Cotización', color: 'hsl(var(--chart-3))' },
    'Negociación': { label: 'Negociación', color: 'hsl(var(--chart-4))' },
    'Cierre de venta': { label: 'Cierre', color: 'hsl(var(--chart-5))' },
    'Financiamiento Externo': { label: 'Financiamiento', color: 'hsl(var(--chart-6))' },
    'Descartado': { label: 'Descartado', color: 'hsl(var(--chart-7))' },
} satisfies ChartConfig;

const prospectSourceConfig = {
    count: { label: 'Prospectos' },
    'REDES SOCIALES': { label: 'Redes Sociales', color: 'hsl(var(--chart-1))' },
    'PUBLICIDAD': { label: 'Publicidad', color: 'hsl(var(--chart-2))' },
    'BUSQUEDA EN GOOGLE': { label: 'Búsqueda en Google', color: 'hsl(var(--chart-3))' },
    'BUSQUEDA EN MAPS': { label: 'Búsqueda en Maps', color: 'hsl(var(--chart-4))' },
    'Desconocido': { label: 'Desconocido', color: 'hsl(var(--chart-5))' },
} satisfies ChartConfig;

interface DashboardChartsProps {
    opportunities: any[] | null;
    leads: any[] | null;
    isLoading: boolean;
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (!percent || percent < 0.05) { // Do not render label if slice is too small
    return null;
  }
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-bold"
      style={{ pointerEvents: 'none' }}
    >
      {`(${(percent * 100).toFixed(0)}%`}
    </text>
  );
};


export function DashboardCharts({ opportunities, leads, isLoading }: DashboardChartsProps) {

    const { potentialClientsByCityData, potentialClientsByCityConfig } = React.useMemo(() => {
        if (!opportunities || !leads) {
            return {
                potentialClientsByCityData: [],
                potentialClientsByCityConfig: { clients: { label: 'Clientes Potenciales' } },
            };
        }

        const leadsMap = new Map(leads.map(lead => [lead.id, lead]));
        const clientsByCity = opportunities
            .filter(opp => getClassification(opp.stage) === 'CLIENTE POTENCIAL')
            .reduce((acc, opp) => {
                const lead = leadsMap.get(opp.leadId);
                const city = lead?.city || 'Otro';
                acc[city] = (acc[city] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

        const sortedCities = Object.entries(clientsByCity)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        const config: ChartConfig = { clients: { label: 'Clientes Potenciales' } };
        
        const data = sortedCities.map(([city, clients], index) => {
            const key = city.replace(/\s+/g, '');
            config[key] = { label: city };
            return {
                city: key,
                label: city,
                clients,
            }
        });

        return { potentialClientsByCityData: data, potentialClientsByCityConfig: config };
    }, [opportunities, leads]);

    const { prospectsByStateData, prospectsByStateConfig } = React.useMemo(() => {
        if (!leads) {
            return {
                prospectsByStateData: [],
                prospectsByStateConfig: { prospects: { label: 'Prospectos' } },
            };
        }
    
        const usStates = new Set(states['US'].map(s => s.code));
    
        const prospectsInUS = (leads as any[]).filter(lead => lead.country === 'US' && lead.state && usStates.has(lead.state));
    
        const prospectsByState = prospectsInUS.reduce((acc, lead) => {
            const stateName = states['US'].find(s => s.code === lead.state)?.name || lead.state;
            acc[stateName] = (acc[stateName] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    
        const sortedStates = Object.entries(prospectsByState)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);
    
        const config: ChartConfig = { prospects: { label: 'Prospectos' } };
        
        const data = sortedStates.map(([stateName, count], index) => {
            const key = stateName.replace(/\s+/g, '');
            config[key] = { label: stateName };
            return {
                state: key, 
                label: stateName,
                prospects: count,
            }
        });
    
        return { prospectsByStateData: data, prospectsByStateConfig: config };
    }, [leads]);

    const pipelineData = React.useMemo(() => {
        if (!opportunities) return [];
        const stageCounts = opportunities.reduce((acc, opp) => {
            const stage = opp.stage || 'Desconocido';
            acc[stage] = (acc[stage] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        return Object.entries(stageCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([stage, count]) => ({ 
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

        return Object.entries(sourceCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([source, count]) => {
                return {
                    source,
                    count,
                };
            });
    }, [leads]);

    const funnelData = React.useMemo(() => {
        if (!opportunities) return [];
    
        const funnelStages: (keyof typeof pipelineConfig)[] = ['Primer contacto', 'Envió de Información', 'Envió de Cotización', 'Negociación', 'Cierre de venta'];
        const stageOrder = funnelStages.reduce((acc, stage, index) => {
            acc[stage] = index;
            return acc;
        }, {} as Record<string, number>);
    
        const stageCounts = funnelStages.map(stage => ({
            stage,
            value: 0,
            name: pipelineConfig[stage].label,
            fill: pipelineConfig[stage].color
        }));
        
        opportunities.forEach(opp => {
            const oppStageIndex = stageOrder[opp.stage as keyof typeof stageOrder];
            
            // Only count if the stage is part of the main funnel
            if (oppStageIndex !== undefined) {
                // An opportunity in a later stage has also passed through all previous stages
                for (let i = 0; i <= oppStageIndex; i++) {
                    stageCounts[i].value += 1;
                }
            }
        });
    
        return stageCounts;
    }, [opportunities]);

    const { salesBySellerData, salesBySellerConfig } = React.useMemo(() => {
      if (!opportunities) {
          return {
              salesBySellerData: [],
              salesBySellerConfig: { revenue: { label: 'Ingresos' } },
          };
      }

      const salesBySeller = opportunities
          .filter(opp => opp.stage === 'Cierre de venta' && opp.currency === 'USD')
          .reduce((acc, opp) => {
              const seller = opp.sellerName || 'Sin Asignar';
              acc[seller] = (acc[seller] || 0) + (opp.value || 0);
              return acc;
          }, {} as Record<string, number>);

      const sortedSellers = Object.entries(salesBySeller)
          .sort(([, a], [, b]) => b - a);

      const config: ChartConfig = { revenue: { label: 'Ingresos (USD)' } };
      
      const data = sortedSellers.map(([seller, revenue], index) => {
          const key = seller.replace(/\s+/g, '');
          config[key] = { label: seller, color: `hsl(var(--chart-${(index % 5) + 1}))` };
          return {
              seller,
              revenue,
              fill: `var(--color-chart-${(index % 5) + 1})`
          }
      });

      return { salesBySellerData: data, salesBySellerConfig: config };
  }, [opportunities]);

    if (isLoading) {
        return (
            <div className="grid gap-6 md:grid-cols-2">
                <Skeleton className="h-[400px]" />
                <Skeleton className="h-[400px]" />
                <Skeleton className="h-[400px]" />
                <Skeleton className="h-[400px]" />
                <Skeleton className="h-[350px] md:col-span-2" />
                <Skeleton className="h-[350px] md:col-span-2" />
            </div>
        )
    }

  return (
    <div className="grid gap-6 md:grid-cols-2">
        <Card>
            <CardHeader>
                <CardTitle>Clientes Potenciales por Ciudad</CardTitle>
                <CardDescription>Distribución de oportunidades en cotización o negociación (Top 5 Ciudades).</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
                 {potentialClientsByCityData.length > 0 ? (
                    <ChartContainer config={potentialClientsByCityConfig} className="h-[300px] w-full">
                        <BarChart
                            accessibilityLayer
                            data={potentialClientsByCityData}
                            layout="vertical"
                            margin={{ left: 10, right: 30 }}
                        >
                            <CartesianGrid horizontal={false} />
                            <YAxis
                                dataKey="label"
                                type="category"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                tickFormatter={(value) => value}
                            />
                            <XAxis dataKey="clients" type="number" hide />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" />}
                            />
                            <Bar dataKey="clients" radius={4}>
                                <LabelList dataKey="clients" position="right" offset={8} className="fill-foreground" fontSize={12} />
                                {potentialClientsByCityData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                 ) : (
                    <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                        No hay clientes potenciales para mostrar.
                    </div>
                 )}
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Prospectos por Estado (USA)</CardTitle>
                <CardDescription>Top 10 estados con más prospectos en EE.UU.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
                 {prospectsByStateData.length > 0 ? (
                    <ChartContainer config={prospectsByStateConfig} className="h-[300px] w-full">
                        <BarChart
                            accessibilityLayer
                            data={prospectsByStateData}
                            layout="vertical"
                            margin={{ left: 10, right: 30 }}
                        >
                            <CartesianGrid horizontal={false} />
                            <YAxis
                                dataKey="label"
                                type="category"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                width={100}
                                tickFormatter={(value) => value}
                            />
                            <XAxis dataKey="prospects" type="number" hide />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" />}
                            />
                            <Bar dataKey="prospects" radius={4}>
                                <LabelList dataKey="prospects" position="right" offset={8} className="fill-foreground" fontSize={12} />
                                {prospectsByStateData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                 ) : (
                    <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                        No hay prospectos en EE.UU. para mostrar.
                    </div>
                 )}
            </CardContent>
        </Card>
        <Card>
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
                            margin={{ left: 10, right: 30 }}
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
                            <Bar dataKey="count" radius={4}>
                                <LabelList dataKey="count" position="right" offset={8} className="fill-foreground" fontSize={12} />
                                {prospectSourceData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                 ) : (
                    <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                        No hay datos de prospectos.
                    </div>
                 )}
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Resumen del Flujo</CardTitle>
                <CardDescription>Distribución de oportunidades.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center [&>div]:h-[300px]">
                {pipelineData.length > 0 ? (
                    <ChartContainer config={pipelineConfig} className="mx-auto aspect-square h-full">
                        <PieChart>
                            <ChartTooltip content={<ChartTooltipContent nameKey="stage" hideLabel />} />
                            <Pie
                                data={pipelineData}
                                dataKey="count"
                                nameKey="stage"
                                labelLine={false}
                                label={renderCustomizedLabel}
                            >
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
         <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle>Rendimiento de Ventas por Vendedor</CardTitle>
                <CardDescription>Ingresos totales (USD) generados por cada vendedor en el período seleccionado.</CardDescription>
            </CardHeader>
            <CardContent>
                {salesBySellerData.length > 0 ? (
                    <ChartContainer config={salesBySellerConfig} className="h-[350px] w-full">
                        <BarChart accessibilityLayer data={salesBySellerData} margin={{ top: 20 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="seller"
                                tickLine={false}
                                tickMargin={10}
                                axisLine={false}
                            />
                            <YAxis tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" formatter={(value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value as number)} />}
                            />
                            <Bar dataKey="revenue" radius={4}>
                                <LabelList
                                    position="top"
                                    offset={4}
                                    className="fill-foreground"
                                    fontSize={12}
                                    formatter={(value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)}
                                />
                                {salesBySellerData.map((entry) => (
                                    <Cell key={entry.seller} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                ) : (
                    <div className="h-[350px] w-full flex items-center justify-center text-muted-foreground">
                        No hay datos de ventas para mostrar.
                    </div>
                )}
            </CardContent>
        </Card>
        <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle>Embudo de Ventas</CardTitle>
                <CardDescription>Conversión de prospectos a través de las etapas de venta.</CardDescription>
            </CardHeader>
            <CardContent>
                {funnelData.length > 0 && funnelData.some(d => d.value > 0) ? (
                    <ChartContainer config={{}} className="h-[300px] w-full aspect-video">
                        <FunnelChart layout="vertical">
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" />}
                            />
                            <Funnel
                                data={funnelData}
                                dataKey="value"
                                nameKey="name"
                                isAnimationActive
                                layout="vertical"
                                neckWidth="30%"
                                neckHeight="20%"
                            >
                                <LabelList
                                    position="right"
                                    fill="hsl(var(--foreground))"
                                    stroke="none"
                                    dataKey="name"
                                    className="font-medium"
                                />
                                <LabelList 
                                    position="center"
                                    fill="#fff"
                                    stroke="hsl(var(--foreground))"
                                    strokeWidth={0.2}
                                    formatter={(value: number) => value}
                                    className="font-bold text-sm"
                                />
                                {funnelData.map((entry) => (
                                    <Cell key={`cell-${entry.stage}`} fill={entry.fill} />
                                ))}
                            </Funnel>
                        </FunnelChart>
                    </ChartContainer>
                ) : (
                    <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                        No hay suficientes datos para construir el embudo.
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
