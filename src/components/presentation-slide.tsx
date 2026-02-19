'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, LabelList, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { PaisanoLogo } from '@/components/icons';
import { type PresentationContent } from '@/ai/flows/generate-presentation-content';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';

interface PresentationSlideProps {
  slide: PresentationContent;
}

const renderContent = (slide: PresentationContent) => {
    switch (slide.slideType) {
        case 'title_slide':
            return (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <h1 className="text-6xl font-bold text-gray-800 leading-tight drop-shadow-sm">{slide.title}</h1>
                    {slide.subtitle && <p className="mt-4 text-4xl text-gray-500">{slide.subtitle}</p>}
                </div>
            );
        case 'kpi_slide':
            const gridCols = slide.kpis.length > 2 ? 'grid-cols-2' : 'grid-cols-1';
            const textSize = slide.kpis.length > 2 ? 'text-5xl' : 'text-6xl';
            return (
                <div className="p-4 h-full flex flex-col">
                    <h2 className="text-4xl font-bold text-gray-800 mb-4 text-center">{slide.title}</h2>
                    <div className={`grid ${gridCols} gap-4 flex-grow`}>
                        {slide.kpis.map((kpi, index) => (
                            <div key={index} className="p-2 rounded-lg bg-gray-50 text-center flex flex-col justify-center border">
                                <p className={`${textSize} font-bold text-primary`}>{kpi.value}</p>
                                <p className="text-2xl font-medium text-gray-600 mt-1">{kpi.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            );
        case 'bullet_points_slide':
            return (
                <div className="p-4">
                    <h2 className="text-4xl font-bold text-gray-800 mb-8">{slide.title}</h2>
                    <ul className="space-y-6">
                        {slide.points.map((point, index) => (
                            <li key={index} className="flex items-start text-3xl text-gray-700">
                                <span className="text-primary font-bold mr-6 mt-1 text-4xl leading-none">▪</span>
                                <span className="flex-1">{point}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        case 'quote_slide':
            return (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <blockquote className="text-5xl italic font-medium text-gray-700 leading-normal">
                        "{slide.quote}"
                    </blockquote>
                    {slide.author && <p className="mt-6 text-3xl text-gray-500">- {slide.author}</p>}
                </div>
            );
         case 'bar_chart_slide':
            const chartConfig: ChartConfig = {
                value: { label: "Valor" },
                ...slide.data.reduce((acc, item) => {
                    acc[item.name] = { label: item.name };
                    return acc;
                }, {} as ChartConfig)
            };
            return (
                 <div className="p-4 h-full flex flex-col">
                    <h2 className="text-4xl font-bold text-gray-800 mb-2 text-center">{slide.title}</h2>
                    <div className="flex-grow min-h-0">
                        <ChartContainer config={chartConfig} className="h-full w-full">
                            <BarChart accessibilityLayer data={slide.data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    tickLine={false}
                                    tickMargin={10}
                                    axisLine={false}
                                    interval={0}
                                    tickFormatter={(value) => value.slice(0, 10)}
                                    style={{ fontSize: '0.8rem' }}
                                />
                                <YAxis style={{ fontSize: '0.8rem' }} />
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent indicator="dot" />}
                                />
                                <Bar dataKey="value" radius={4}>
                                    <LabelList dataKey="value" position="top" offset={4} className="fill-foreground" fontSize={12} />
                                    {slide.data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    </div>
                </div>
            );
        default:
            return <p>Tipo de diapositiva no soportado.</p>;
    }
}


export function PresentationSlide({ slide }: PresentationSlideProps) {
  const logoUrl = typeof window !== 'undefined' ? localStorage.getItem('sidebarLogo') : null;
  
  return (
    <Card className="aspect-video w-full overflow-hidden shadow-lg border-2 border-black/10 bg-white">
        <CardContent className="relative flex h-full w-full flex-col justify-between p-0">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 h-4 bg-red-700 z-20" />
            <div className="absolute top-6 left-6 h-28 w-64 z-20">
                {logoUrl ? (
                    <Image src={logoUrl} alt="Logo" fill className="object-contain object-left" />
                ) : (
                    <PaisanoLogo className="w-full h-full text-gray-300" />
                )}
            </div>

            {/* Main Content Area */}
            <div className="w-full h-full pt-40 px-10 pb-12 flex flex-col justify-center">
                 {renderContent(slide)}
            </div>
            
            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-black flex items-center justify-center z-10">
                <p className="text-sm font-semibold text-white tracking-widest uppercase">PAISANO TRAILER</p>
            </div>
        </CardContent>
    </Card>
  );
}
