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
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <h1 className="text-5xl font-bold text-gray-800">{slide.title}</h1>
                    {slide.subtitle && <p className="mt-4 text-2xl text-gray-600">{slide.subtitle}</p>}
                </div>
            );
        case 'kpi_slide':
            return (
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-8">{slide.title}</h2>
                    <div className={`grid grid-cols-${slide.kpis.length > 2 ? '2' : '1'} gap-6`}>
                        {slide.kpis.map((kpi, index) => (
                            <div key={index} className="p-6 rounded-lg bg-gray-100/70 text-center">
                                <p className="text-5xl font-bold text-primary">{kpi.value}</p>
                                <p className="text-xl font-medium text-gray-700 mt-2">{kpi.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            );
        case 'bullet_points_slide':
            return (
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-6">{slide.title}</h2>
                    <ul className="space-y-4">
                        {slide.points.map((point, index) => (
                            <li key={index} className="flex items-start text-xl text-gray-700">
                                <span className="text-primary font-bold mr-3 mt-1">▪</span>
                                <span>{point}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        case 'quote_slide':
            return (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <blockquote className="text-4xl italic font-medium text-gray-700">
                        "{slide.quote}"
                    </blockquote>
                    {slide.author && <p className="mt-6 text-2xl text-gray-600">- {slide.author}</p>}
                </div>
            );
        default:
            return <p>Tipo de diapositiva no soportado.</p>;
    }
}


export function PresentationSlide({ slide }: PresentationSlideProps) {
  const logoUrl = typeof window !== 'undefined' ? localStorage.getItem('sidebarLogo') : null;
  
  return (
    <Card className="aspect-video w-full overflow-hidden shadow-lg border-2 border-black/10">
        <CardContent className="relative flex h-full w-full flex-col justify-between bg-white p-12">
            {/* Header */}
            <div className="absolute top-0 left-0 w-full h-4 bg-primary" />

            {/* Main Content */}
            <div className="flex-grow flex flex-col justify-center z-10">
                {renderContent(slide)}
            </div>
            
            {/* Footer */}
            <div className="absolute bottom-8 left-12 right-12 flex items-center justify-between z-10">
                {logoUrl ? (
                    <Image src={logoUrl} alt="Logo" width={100} height={25} className="object-contain" />
                ) : (
                    <PaisanoLogo className="w-24 h-auto text-gray-300" />
                )}
                <div className="text-right">
                    <p className="text-sm font-bold text-gray-700">PAISANO TRAILER</p>
                    <p className="text-xs text-gray-500">CONFIDENCIAL</p>
                </div>
            </div>
            <div className="absolute bottom-0 left-0 w-full h-2 bg-gray-800" />
        </CardContent>
    </Card>
  );
}
