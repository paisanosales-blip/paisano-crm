'use client';

import { useState, useMemo, useRef, createRef, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { startOfMonth, endOfMonth, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Sparkles, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generatePresentationContent, type PresentationContent } from '@/ai/flows/generate-presentation-content';
import { PresentationSlide } from '@/components/presentation-slide';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb } from 'lucide-react';
import { toPng } from 'html-to-image';
import { getClassification } from '@/lib/types';
import { states } from '@/lib/geography';

type ReportType = 'monthly_sales_summary' | 'lost_opportunities_analysis' | 'weekly_performance';

export default function PresentationsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [reportType, setReportType] = useState<ReportType | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [slides, setSlides] = useState<PresentationContent[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSlide, setPreviewSlide] = useState<PresentationContent | null>(null);
  const slideRefs = useRef<Array<React.RefObject<HTMLDivElement>>>([]);
  
  const slidePreviewRef = useRef<HTMLDivElement>(null);

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

  const leadsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'leads'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  const { data: leads, isLoading: areLeadsLoading } = useCollection(leadsQuery);

  const quotationsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'quotations'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  const { data: quotations, isLoading: areQuotsLoading } = useCollection(quotationsQuery);
  
  const isDataLoading = areOppsLoading || areActivitiesLoading || areLeadsLoading || areQuotsLoading;

  const reportData = useMemo(() => {
    if (!opportunities || !activities || !leads || !quotations) return null;
    
    const now = new Date();
    const isWeekly = reportType === 'weekly_performance';
    const periodStart = isWeekly ? subDays(now, 7) : startOfMonth(now);
    const periodEnd = isWeekly ? now : endOfMonth(now);

    const opportunitiesInPeriod = opportunities.filter(opp => {
        if (!opp.createdDate) return false;
        const oppDate = new Date(opp.createdDate);
        return oppDate >= periodStart && oppDate <= periodEnd;
    });
    
    const wonOpportunitiesInPeriod = opportunities.filter(opp => {
        if (!opp.closingDate) return false;
        const closingDate = new Date(opp.closingDate);
        return closingDate >= periodStart && closingDate <= periodEnd && opp.stage === 'Cierre de venta';
    });

    const potentialOpportunitiesInPeriod = opportunitiesInPeriod.filter(
        opp => getClassification(opp.stage) === 'CLIENTE POTENCIAL'
    );

    const financingOpportunitiesInPeriod = opportunities.filter(opp => {
        if (!opp.financiamientoExternoDate) return false;
        const financingDate = new Date(opp.financiamientoExternoDate);
        return financingDate >= periodStart && financingDate <= periodEnd;
    });

    const discardedOpportunitiesInPeriod = opportunities.filter(opp => {
        if (!opp.discardedDate) return false;
        const discardedDate = new Date(opp.discardedDate);
        return discardedDate >= periodStart && discardedDate <= periodEnd;
    });

    const quotationsInPeriod = quotations.filter(q => {
        if (!q.createdDate) return false;
        const qDate = new Date(q.createdDate);
        return qDate >= periodStart && qDate <= periodEnd;
    });

    // Chart data calculations
    const leadsMap = new Map(leads.map(lead => [lead.id, lead]));

    const clientsByCity = potentialOpportunitiesInPeriod
        .reduce((acc, opp) => {
            const lead = leadsMap.get(opp.leadId);
            const city = lead?.city || 'Otro';
            acc[city] = (acc[city] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    const topCities = Object.entries(clientsByCity).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, value]) => ({ name, value }));

    const usStates = new Set(states['US'].map(s => s.code));
    const prospectsInUS = (leads as any[]).filter(lead => lead.country === 'US' && lead.state && usStates.has(lead.state));
    const prospectsByState = prospectsInUS.reduce((acc, lead) => {
        const stateName = states['US'].find(s => s.code === lead.state)?.name || lead.state;
        acc[stateName] = (acc[stateName] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const topStates = Object.entries(prospectsByState).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, value]) => ({ name, value }));

    const sourceCounts = (leads as any[]).reduce((acc, lead) => {
        const source = lead.contactMethod || 'Desconocido';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const prospectSources = Object.entries(sourceCounts).map(([name, value]) => ({ name, value }));

    const stageCounts = opportunities.reduce((acc, opp) => {
        const stage = opp.stage || 'Desconocido';
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const pipelineSummary = Object.entries(stageCounts).map(([name, value]) => ({ name, value }));

    switch (reportType) {
      case 'monthly_sales_summary':
      case 'weekly_performance':
        return {
            period: isWeekly ? "Semanal" : "Mensual",
            kpis: {
                newProspects: opportunitiesInPeriod.length,
                potentialClients: potentialOpportunitiesInPeriod.length,
                wonClients: wonOpportunitiesInPeriod.length,
                newQuotations: quotationsInPeriod.length,
                financingClients: financingOpportunitiesInPeriod.length,
                discardedClients: discardedOpportunitiesInPeriod.length
            },
            charts: {
                potentialByCity: topCities,
                prospectsByState: topStates,
                prospectSources: prospectSources,
                pipelineSummary: pipelineSummary,
            },
            discardedReasons: discardedOpportunitiesInPeriod.map(o => o.discardReason).filter(Boolean)
        };
      case 'lost_opportunities_analysis':
        return opportunities.filter(opp => opp.stage === 'Descartado').map(o => o.discardReason).filter(Boolean);
      default:
        return null;
    }
  }, [reportType, opportunities, activities, leads, quotations]);

  useEffect(() => {
    slideRefs.current = slides.map((_, i) => slideRefs.current[i] ?? createRef<HTMLDivElement>());
  }, [slides]);
  
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
      const logoUrl = typeof window !== 'undefined' ? localStorage.getItem('sidebarLogo') : '';
      
      const result = await generatePresentationContent({
        reportType: reportType,
        reportData: JSON.stringify(reportData), // Stringify the complex object
        logoUrl: logoUrl || ''
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
  
  const handleDownload = async () => {
    if (!slidePreviewRef.current) {
      toast({ variant: 'destructive', title: 'Error de Descarga', description: 'No se pudo encontrar la referencia de la diapositiva.' });
      return;
    }
    
    const nodeFilter = (node: HTMLElement) => {
      // The library fails to parse cross-origin CSS, so we skip the google fonts stylesheet.
      return !(node.tagName === 'LINK' && node.getAttribute('href')?.startsWith('https://fonts.googleapis.com'));
    };

    try {
      const dataUrl = await toPng(slidePreviewRef.current, { 
        cacheBust: true, 
        pixelRatio: 2,
        filter: nodeFilter,
      });
      const link = document.createElement('a');
      link.download = `${previewSlide?.slideType || 'diapositiva'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download image:', err);
      toast({ variant: 'destructive', title: 'Error de Descarga', description: 'No se pudo convertir la diapositiva a imagen.' });
    }
  };

  const handlePreviewClick = (slide: PresentationContent) => {
    setPreviewSlide(slide);
    setIsPreviewOpen(true);
  };

  return (
    <>
    <div className="grid gap-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-headline font-bold">Generador de Presentaciones</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Crea una Presentación con IA</CardTitle>
          <CardDescription>
            Selecciona un tipo de reporte y la IA generará diapositivas con un diseño profesional.
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
                <SelectItem value="weekly_performance">Rendimiento Semanal</SelectItem>
                <SelectItem value="lost_opportunities_analysis">Análisis de Oportunidades Perdidas</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleGenerate} disabled={isLoading || isDataLoading || !reportType} className="sm:w-auto">
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
                    <AlertTitle>¡Listo!</AlertTitle>
                    <AlertDescription>
                        Haz clic en una diapositiva para verla en grande y descargarla como imagen PNG.
                    </AlertDescription>
                </Alert>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {slides.map((slide, index) => (
                         <div key={index} className="cursor-pointer group" onClick={() => handlePreviewClick(slide)}>
                            <div className="border-2 border-transparent group-hover:border-primary rounded-lg transition-all">
                               <PresentationSlide slide={slide} />
                            </div>
                        </div>
                    ))}
                </div>
              </div>
            )}
            </CardFooter>
        )}
      </Card>
    </div>
    <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl p-0 border-0">
             <DialogHeader>
                <DialogTitle className="sr-only">Vista Previa de Diapositiva</DialogTitle>
                <DialogDescription className="sr-only">
                    Vista previa de la diapositiva generada.
                </DialogDescription>
            </DialogHeader>
            <div className="aspect-video relative" ref={slidePreviewRef}>
                {previewSlide && <PresentationSlide slide={previewSlide} />}
            </div>
            <DialogFooter className="p-4 border-t">
                <Button onClick={handleDownload} className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Descargar Diapositiva
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
