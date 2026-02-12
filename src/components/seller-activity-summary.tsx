'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BrainCircuit, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isWithinInterval, subDays } from 'date-fns';

import { summarizeSellerActivity } from '@/ai/flows/summarize-seller-activity';
import type { Opportunity, Activity } from '@/lib/types';

interface SellerActivitySummaryProps {
  sellerName: string;
  opportunities: Opportunity[] | null;
  activities: Activity[] | null;
}

export function SellerActivitySummary({
  sellerName,
  opportunities,
  activities,
}: SellerActivitySummaryProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<'week' | 'month'>('week');
  const { toast } = useToast();

  const handleAnalysis = async () => {
    setIsLoading(true);
    setAnalysis(null);
    
    if (!opportunities || !activities) {
        toast({ title: 'Datos no disponibles', description: 'No se pudieron cargar los datos de actividad.', variant: 'destructive'});
        setIsLoading(false);
        return;
    }

    const now = new Date();
    const days = timePeriod === 'week' ? 7 : 30;
    const periodStart = subDays(now, days);

    const activitiesInPeriod = activities.filter(act => 
        isWithinInterval(new Date(act.createdDate), { start: periodStart, end: now })
    );

    const dealsClosedInPeriod = opportunities.filter(opp => 
        opp.closingDate && opp.stage === 'Cierre de venta' && isWithinInterval(new Date(opp.closingDate), { start: periodStart, end: now })
    ).length;

    const completedCalls = activitiesInPeriod.filter(
        a => a.type === 'Llamada' && a.completed && a.clientResponded !== undefined
    );
    const respondedCalls = completedCalls.filter(a => a.clientResponded === true).length;
    const responseRate = completedCalls.length > 0 ? Math.round((respondedCalls / completedCalls.length) * 100) : 0;

    try {
      const result = await summarizeSellerActivity({
        sellerName,
        timePeriod: timePeriod === 'week' ? 'la última semana' : 'los últimos 30 días',
        activitiesCount: activitiesInPeriod.length,
        dealsClosedCount: dealsClosedInPeriod,
        responseRate,
      });
      setAnalysis(result.summary);
    } catch (error) {
      console.error("Error generating seller summary:", error);
      toast({
        variant: 'destructive',
        title: 'Error de IA',
        description: 'No se pudo generar el resumen en este momento.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen de Actividad por IA</CardTitle>
        <CardDescription>
          Genera un resumen de la actividad de un vendedor para un período específico.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
            <Select onValueChange={(value) => setTimePeriod(value as 'week' | 'month')} value={timePeriod}>
                <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="week">Últimos 7 días</SelectItem>
                    <SelectItem value="month">Últimos 30 días</SelectItem>
                </SelectContent>
            </Select>
             <Button onClick={handleAnalysis} disabled={isLoading} className="flex-grow">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BrainCircuit className="mr-2 h-4 w-4" />
              )}
              Generar Resumen
            </Button>
        </div>
         {analysis ? (
          <div className="p-4 border rounded-lg bg-muted/50 whitespace-pre-wrap">
            <p className="text-sm text-foreground">{analysis}</p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-20 text-center text-sm text-muted-foreground">
            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              'Seleccione un período y genere un resumen.'
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
