'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lightbulb, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeDiscardReasons } from '@/ai/flows/analyze-discard-reasons';
import type { Opportunity } from '@/lib/types';

interface LostOpportunitiesAnalysisProps {
  discardedOpportunities: Opportunity[];
}

export function LostOpportunitiesAnalysis({ discardedOpportunities }: LostOpportunitiesAnalysisProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAnalysis = async () => {
    setIsLoading(true);
    setAnalysis(null);

    const reasons = discardedOpportunities
      .map(opp => opp.discardReason)
      .filter((reason): reason is string => !!reason);

    if (reasons.length === 0) {
      toast({
        title: 'No hay datos suficientes',
        description: 'No se encontraron motivos de descarte para analizar en el período seleccionado.',
      });
      setIsLoading(false);
      return;
    }

    try {
      const result = await analyzeDiscardReasons({ reasons });
      setAnalysis(result.summary);
    } catch (error) {
      console.error("Error analyzing discard reasons:", error);
      toast({
        variant: 'destructive',
        title: 'Error de IA',
        description: 'No se pudo generar el análisis en este momento.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análisis de Oportunidades Perdidas</CardTitle>
        <CardDescription>
          Utilice la IA para identificar las principales razones por las que se descartan prospectos en el mes seleccionado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {analysis ? (
          <div className="p-4 border rounded-lg bg-muted/50">
            <p className="text-sm text-foreground">{analysis}</p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-24 text-center text-sm text-muted-foreground">
            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              'Presione el botón para generar un análisis.'
            )}
          </div>
        )}
        <Button onClick={handleAnalysis} disabled={isLoading || discardedOpportunities.length === 0} className="w-full">
          {isLoading ? (
            'Analizando...'
          ) : (
            <>
              <Lightbulb className="mr-2 h-4 w-4" />
              Analizar Motivos de Descarte
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
