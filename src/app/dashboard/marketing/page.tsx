'use client';

import React, { useState, useEffect } from 'react';
import { getWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Lightbulb, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  generateMarketingPlan,
  type GenerateMarketingPlanOutput,
} from '@/ai/flows/generate-marketing-plan';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const GENERATION_CODE = 'PAISANO2026';

export default function MarketingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<GenerateMarketingPlanOutput | null>(null);
  const { toast } = useToast();
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');

  useEffect(() => {
    const today = new Date();
    const storedPlan = localStorage.getItem('marketingPlan');
    const storedPlanWeek = localStorage.getItem('marketingPlanWeek');
    const currentWeek = getWeek(today, { weekStartsOn: 1 });

    if (storedPlan && storedPlanWeek && parseInt(storedPlanWeek, 10) === currentWeek) {
      setPlan(JSON.parse(storedPlan));
      const storedCompletedTasks = localStorage.getItem('completedMarketingTasks');
      if (storedCompletedTasks) {
        setCompletedTasks(new Set(JSON.parse(storedCompletedTasks)));
      }
    }
  }, []);

  const handleGeneratePlan = async () => {
    setIsLoading(true);
    setPlan(null);
    setCompletedTasks(new Set());
    localStorage.removeItem('completedMarketingTasks');

    try {
      const result = await generateMarketingPlan({
        businessDescription: 'Fabricación y venta de remolques de alta resistencia: Sand Hopper, Grain Hopper, Dump bodies, Landscapes y Watter tank.',
        socialMediaFocus: 'TikTok',
      });
      setPlan(result);
      const currentWeek = getWeek(new Date(), { weekStartsOn: 1 });
      localStorage.setItem('marketingPlan', JSON.stringify(result));
      localStorage.setItem('marketingPlanWeek', String(currentWeek));
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
  
  const handleToggleTask = (taskId: string) => {
    const newCompletedTasks = new Set(completedTasks);
    if (newCompletedTasks.has(taskId)) {
      newCompletedTasks.delete(taskId);
    } else {
      newCompletedTasks.add(taskId);
    }
    setCompletedTasks(newCompletedTasks);
    localStorage.setItem('completedMarketingTasks', JSON.stringify(Array.from(newCompletedTasks)));
  };

  const handleGenerationConfirm = () => {
    if (enteredCode === GENERATION_CODE) {
      setIsConfirmDialogOpen(false);
      setEnteredCode('');
      handleGeneratePlan();
    } else {
      toast({
        variant: 'destructive',
        title: 'Código Incorrecto',
        description: 'El código especial ingresado no es válido.',
      });
    }
  };


  return (
    <>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-headline font-bold">Asistente de Marketing</h1>
          <Button onClick={() => setIsConfirmDialogOpen(true)} disabled={isLoading}>
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
              Aquí tienes una lista de objetivos diarios (L-V) y tareas sugeridas por la IA. 
              Para generar un nuevo plan que reemplazará al actual, necesitarás el código especial.
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
                  <p className="text-muted-foreground">
                    Presiona el botón de arriba para que la IA genere tus tareas de la semana.
                  </p>
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
                        {dayPlan.tasks.map((task, index) => {
                          const taskId = `${dayPlan.day}-${index}`;
                          return (
                            <li key={taskId} className="flex items-start gap-3">
                              <Checkbox
                                id={taskId}
                                checked={completedTasks.has(taskId)}
                                onCheckedChange={() => handleToggleTask(taskId)}
                                className="mt-1"
                              />
                              <Label
                                htmlFor={taskId}
                                className={cn(
                                  "text-sm text-muted-foreground transition-colors cursor-pointer",
                                  completedTasks.has(taskId) && "line-through text-muted-foreground/70"
                                )}
                              >
                                {task}
                              </Label>
                            </li>
                          )
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Generación</AlertDialogTitle>
            <AlertDialogDescription>
              Generar un nuevo plan reemplazará el plan semanal actual. Por favor, ingrese el código especial para continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
              <Label htmlFor="special-code" className="sr-only">Código Especial</Label>
              <Input 
                id="special-code"
                type="password"
                placeholder="Ingrese el código especial"
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleGenerationConfirm();
                  }
                }}
              />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEnteredCode('')}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerationConfirm}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
