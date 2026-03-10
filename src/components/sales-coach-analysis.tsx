'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BrainCircuit, Loader2 } from 'lucide-react';
import { generateSalesCoaching } from '@/ai/flows/generate-sales-coaching';

interface SalesCoachAnalysisProps {
  userName: string;
  monthlyStats: {
    clientesPotenciales: number;
    tasaDeConversion: number;
    ingresosTotales: number;
  };
  weeklyProgress: {
    count: number;
  };
  weeklyGoal: number;
  monthlyGoal: number;
}

export function SalesCoachAnalysis({
  userName,
  monthlyStats,
  weeklyProgress,
  weeklyGoal,
  monthlyGoal
}: SalesCoachAnalysisProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const handleAnalysis = async () => {
    setIsLoading(true);
    setAnalysis(null);

    try {
      const result = await generateSalesCoaching({
        userName: userName,
        weeklyProspectsCount: weeklyProgress.count,
        weeklyProspectsGoal: weeklyGoal,
        monthlyPotentialClientsCount: monthlyStats.clientesPotenciales,
        monthlyPotentialClientsGoal: monthlyGoal,
        monthlyConversionRate: monthlyStats.tasaDeConversion,
        monthlyRevenue: monthlyStats.ingresosTotales,
      });
      setAnalysis(result.coachingMessage);
    } catch (error) {
      console.error("Error generating sales coaching:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análisis del Coach de Ventas</CardTitle>
        <CardDescription>
          Recibe retroalimentación directa y accionable de un coach de ventas experto basado en tu rendimiento actual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {analysis ? (
          <div className="p-4 border rounded-lg bg-muted/50 whitespace-pre-wrap">
            <p className="text-sm text-foreground">{analysis}</p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-24 text-center text-sm text-muted-foreground">
            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              'Presiona el botón para recibir tu retroalimentación.'
            )}
          </div>
        )}
        <Button onClick={handleAnalysis} disabled={isLoading} className="w-full">
          {isLoading ? (
            'Analizando...'
          ) : (
            <>
              <BrainCircuit className="mr-2 h-4 w-4" />
              Obtener Análisis del Coach
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
