'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Lightbulb, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  generateMarketingPlan,
  type GenerateMarketingPlanOutput,
} from '@/ai/flows/generate-marketing-plan';

export default function MarketingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<GenerateMarketingPlanOutput | null>(null);
  const { toast } = useToast();

  const handleGeneratePlan = async () => {
    setIsLoading(true);
    setPlan(null);

    try {
      const result = await generateMarketingPlan({
        businessDescription: 'Fabricación y venta de remolques de alta resistencia: Sand Hopper, Grain Hopper, Dump bodies, Landscapes y Watter tank.',
        socialMediaFocus: 'TikTok',
      });
      setPlan(result);
    } catch (error) {
      console.error("Error generating marketing plan:", error);
      toast({
        variant: 'destructive',
        title: 'Error de IA',
        description: 'No se pudo generar el plan de marketing en este momento.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-bold">Asistente de Marketing</h1>
        <Button onClick={handleGeneratePlan} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Lightbulb className="mr-2 h-4 w-4" />
          )}
          {isLoading ? 'Generando Plan...' : 'Generar Plan de Marketing Semanal'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan de Contenido Semanal</CardTitle>
          <CardDescription>
            Aquí tienes una lista de objetivos diarios y tareas sugeridas por la IA para impulsar tu presencia en redes sociales, con un enfoque principal en TikTok.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && !plan && (
             <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed rounded-lg">
                <p className="text-lg font-semibold">Tu plan de marketing te espera</p>
                <p className="text-muted-foreground">Presiona el botón de arriba para que la IA genere tus tareas de la semana.</p>
            </div>
          )}
          {plan && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plan.weeklyPlan.map((dayPlan) => (
                <Card key={dayPlan.day} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-lg">{dayPlan.day}</CardTitle>
                    <CardDescription>{dayPlan.theme}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <ul className="space-y-3">
                      {dayPlan.tasks.map((task, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                          <span className="text-sm text-muted-foreground">{task}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
