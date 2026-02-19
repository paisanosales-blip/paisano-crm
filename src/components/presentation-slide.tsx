'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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
                    <h1 className="text-4xl font-bold text-gray-800 leading-tight drop-shadow-sm">{slide.title}</h1>
                    {slide.subtitle && <p className="mt-4 text-2xl text-gray-500">{slide.subtitle}</p>}
                </div>
            );
        case 'kpi_slide':
            const gridCols = slide.kpis.length > 2 ? 'grid-cols-2' : 'grid-cols-1';
            const kpiTextSize = slide.kpis.length > 2 ? 'text-3xl' : 'text-4xl';
            return (
                <div className="p-8 h-full flex flex-col">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">{slide.title}</h2>
                    <div className={`grid ${gridCols} gap-6 flex-grow`}>
                        {slide.kpis.map((kpi, index) => (
                            <div key={index} className="p-4 rounded-lg bg-gray-50 text-center flex flex-col justify-center border">
                                <p className={`${kpiTextSize} font-bold text-primary`}>{kpi.value}</p>
                                <p className="text-base font-medium text-gray-600 mt-2">{kpi.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            );
        case 'bullet_points_slide':
            return (
                <div className="p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">{slide.title}</h2>
                    <ul className="space-y-3">
                        {slide.points.map((point, index) => (
                            <li key={index} className="flex items-start text-lg text-gray-700">
                                <span className="text-primary font-bold mr-3 mt-1 text-2xl leading-none">▪</span>
                                <span className="flex-1">{point}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        case 'quote_slide':
            return (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <blockquote className="text-3xl italic font-medium text-gray-700 leading-normal">
                        "{slide.quote}"
                    </blockquote>
                    {slide.author && <p className="mt-6 text-lg text-gray-500">- {slide.author}</p>}
                </div>
            );
         case 'bar_chart_slide':
            const chartConfig: ChartConfig = {
                value: { label: "Valor" },
                ...slide.data.reduce((acc, item) => {
                    acc[item.name] = { label: item.name, color: "hsl(var(--primary))" };
                    return acc;
                }, {} as ChartConfig)
            };
            return (
                 <div className="p-8 h-full flex flex-col">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">{slide.title}</h2>
                    <div className="flex-grow">
                        <ChartContainer config={chartConfig} className="h-full w-full">
                            <BarChart accessibilityLayer data={slide.data} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    tickLine={false}
                                    tickMargin={10}
                                    axisLine={false}
                                    tickFormatter={(value) => value.slice(0, 15)}
                                />
                                <YAxis />
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent indicator="dot" />}
                                />
                                <Bar dataKey="value" fill="hsl(var(--primary))" radius={4} />
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
        <CardContent className="relative flex h-full w-full flex-col justify-center p-0">
             <div className="absolute top-4 left-6 h-8 w-24 z-20">
                {logoUrl ? (
                    <Image src={logoUrl} alt="Logo" fill className="object-contain" />
                ) : (
                    <PaisanoLogo className="w-full h-full text-gray-300" />
                )}
            </div>

            <div className="absolute top-16 left-8 right-8 h-1 bg-red-700" />

            <div className="absolute inset-0 pt-20 px-8 pb-16 flex flex-col justify-center">
                 {renderContent(slide)}
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-black flex items-center justify-center z-20">
                <p className="text-xs font-semibold text-white">PAISANO TRAILER</p>
            </div>
        </CardContent>
    </Card>
  );
}
