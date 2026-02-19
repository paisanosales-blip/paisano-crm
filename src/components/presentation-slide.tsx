'use client';

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
                    <h1 className="text-5xl font-bold text-gray-800 leading-tight">{slide.title}</h1>
                    {slide.subtitle && <p className="mt-4 text-2xl text-gray-600">{slide.subtitle}</p>}
                </div>
            );
        case 'kpi_slide':
            const gridCols = slide.kpis.length > 2 ? 'grid-cols-2' : 'grid-cols-1';
            return (
                <div className="p-8">
                    <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">{slide.title}</h2>
                    <div className={`grid ${gridCols} gap-6`}>
                        {slide.kpis.map((kpi, index) => (
                            <div key={index} className="p-4 rounded-lg bg-gray-100 text-center flex flex-col justify-center">
                                <p className="text-4xl lg:text-5xl font-bold text-primary">{kpi.value}</p>
                                <p className="text-base lg:text-lg font-medium text-gray-700 mt-2">{kpi.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            );
        case 'bullet_points_slide':
            return (
                <div className="p-8">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6">{slide.title}</h2>
                    <ul className="space-y-4">
                        {slide.points.map((point, index) => (
                            <li key={index} className="flex items-start text-xl text-gray-700">
                                <span className="text-primary font-bold mr-4 mt-1">▪</span>
                                <span className="flex-1">{point}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        case 'quote_slide':
            return (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <blockquote className="text-3xl lg:text-4xl italic font-medium text-gray-700 leading-normal">
                        "{slide.quote}"
                    </blockquote>
                    {slide.author && <p className="mt-6 text-xl text-gray-600">- {slide.author}</p>}
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
        <CardContent className="relative flex h-full w-full flex-col p-0">
            {/* Header */}
            <div className="absolute top-0 left-0 w-full h-3 bg-primary z-20" />

            {/* Main Content */}
            <div className="flex-grow flex flex-col justify-center pt-8 pb-20">
                {renderContent(slide)}
            </div>
            
            {/* Footer */}
            <div className="absolute bottom-0 left-0 w-full h-16 bg-gray-50 flex items-center justify-between px-8 z-20 border-t">
                {logoUrl ? (
                    <div className="relative h-8 w-24">
                        <Image src={logoUrl} alt="Logo" fill className="object-contain" />
                    </div>
                ) : (
                    <PaisanoLogo className="w-24 h-auto text-gray-400" />
                )}
                <div className="text-right">
                    <p className="text-sm font-bold text-gray-700">PAISANO TRAILER</p>
                    <p className="text-xs text-gray-500">REPORTE CONFIDENCIAL</p>
                </div>
            </div>
            <div className="absolute bottom-0 left-0 w-full h-2 bg-black z-20" />
        </CardContent>
    </Card>
  );
}
