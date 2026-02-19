'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { startOfMonth, endOfMonth, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generatePresentationContent, type PresentationContent } from '@/ai/flows/generate-presentation-content';
import { PresentationSlide } from '@/components/presentation-slide';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb } from 'lucide-react';

type ReportType = 'monthly_sales_summary' | 'lost_opportunities_analysis' | 'weekly_performance';

export default function PresentationsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [reportType, setReportType] = useState<ReportType | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [slides, setSlides] = useState<PresentationContent[]>([]);
  
  // Data fetching
  const opportunitiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'opportunities'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  const { data: opportunities, isLoading: areOppsLoading } = useCollection(opportunitiesQuery);

  const activitiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'activities'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  const { data: activities, isLoading: areActivitiesLoading } = useCollection(activitiesQuery);

  const reportData = useMemo(() => {
    if (!opportunities || !activities) return null;
    
    const now = new Date();
    
    switch (reportType) {
      case 'monthly_sales_summary':
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        return opportunities.filter(opp => {
          if (!opp.createdDate) return false;
          const oppDate = new Date(opp.createdDate);
          return oppDate >= monthStart && oppDate <= monthEnd;
        });
      case 'lost_opportunities_analysis':
        return opportunities.filter(opp => opp.stage === 'Descartado');
      case 'weekly_performance':
        const weekStart = subDays(now, 7);
        const weeklyOpps = opportunities.filter(opp => new Date(opp.createdDate) >= weekStart);
        const weeklyActivities = activities.filter(act => new Date(act.createdDate) >= weekStart);
        return { opportunities: weeklyOpps, activities: weeklyActivities };
      default:
        return null;
    }
  }, [reportType, opportunities, activities]);

  const handleGenerate = async () => {
    if (!reportType) {
      toast({ variant: 'destructive', title: 'Seleccione un reporte', description: 'Debe elegir un tipo de reporte para generar.' });
      return;
    }
    if (!reportData) {
      toast({ variant: 'destructive', title: 'Datos no disponibles', description: 'No se pudieron cargar los datos para este reporte.' });
      return;
    }

    setIsLoading(true);
    setSlides([]);
    
    try {
      const logoUrl = localStorage.getItem('sidebarLogo') || '';
      
      const result = await generatePresentationContent({
        reportType: reportType,
        reportData: JSON.stringify(reportData),
        logoUrl: logoUrl
      });
      
      setSlides(result.slides);

      toast({
        title: '¡Presentación Generada!',
        description: 'Se han creado las diapositivas para tu reporte.',
      });

    } catch (error) {
      console.error('Error generating presentation:', error);
      toast({
        variant: 'destructive',
        title: 'Error al generar la presentación',
        description: 'No se pudo crear la presentación en este momento. Inténtelo de nuevo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-headline font-bold">Generador de Presentaciones</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Crea una Presentación con IA</CardTitle>
          <CardDescription>
            Selecciona un tipo de reporte y la IA generará diapositivas con un diseño profesional que podrás copiar en tu presentación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select onValueChange={(value) => setReportType(value as ReportType)} value={reportType}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Seleccione el tipo de reporte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly_sales_summary">Resumen de Ventas Mensual</SelectItem>
                <SelectItem value="lost_opportunities_analysis">Análisis de Oportunidades Perdidas</SelectItem>
                <SelectItem value="weekly_performance">Rendimiento Semanal</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleGenerate} disabled={isLoading || areOppsLoading || areActivitiesLoading || !reportType} className="sm:w-auto">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generar Diapositivas
                </>
              )}
            </Button>
          </div>
        </CardContent>
        {(isLoading || slides.length > 0) && (
            <CardFooter>
            {isLoading ? (
                 <div className="w-full flex flex-col items-center justify-center h-96 border-2 border-dashed rounded-md">
                    <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                    <p className="mt-4 text-sm text-muted-foreground">La IA está diseñando tus diapositivas...</p>
                 </div>
            ) : (
              <div className="w-full">
                <Alert className="mb-4">
                    <Lightbulb className="h-4 w-4" />
                    <AlertTitle>¡Consejo!</AlertTitle>
                    <AlertDescription>
                        Para copiar una diapositiva, haga clic derecho sobre la imagen y seleccione "Copiar imagen". Luego, puede pegarla en PowerPoint, Google Slides u otro software.
                    </AlertDescription>
                </Alert>
                <Carousel className="w-full" opts={{ align: "start" }}>
                    <CarouselContent>
                    {slides.map((slide, index) => (
                        <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
                            <div className="p-1">
                                <PresentationSlide slide={slide} />
                            </div>
                        </CarouselItem>
                    ))}
                    </CarouselContent>
                    <CarouselPrevious />
                    <CarouselNext />
                </Carousel>
              </div>
            )}
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
