'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { Lightbulb, Loader2, Paperclip, CheckCircle2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  generateMarketingPlan,
  type GenerateMarketingPlanOutput,
} from '@/ai/flows/generate-marketing-plan';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { MarketingTaskDialog, type TaskCompletionData } from '@/components/marketing-task-dialog';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';


const GENERATION_CODE = 'PAISANO2026';

type CompletedTasksState = {
  [taskId: string]: TaskCompletionData;
};

export default function MarketingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<GenerateMarketingPlanOutput | null>(null);
  const { toast } = useToast();
  const [completedTasks, setCompletedTasks] = useState<CompletedTasksState>({});
  
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<{ id: string; description: string } | null>(null);
  
  const [uncheckAlertOpen, setUncheckAlertOpen] = useState(false);
  const [taskToUncheck, setTaskToUncheck] = useState<string | null>(null);


  useEffect(() => {
    const today = new Date();
    const storedPlan = localStorage.getItem('marketingPlan');
    const storedPlanWeek = localStorage.getItem('marketingPlanWeek');
    const currentWeek = getWeek(today, { weekStartsOn: 1 });

    if (storedPlan && storedPlanWeek && parseInt(storedPlanWeek, 10) === currentWeek) {
      try {
        setPlan(JSON.parse(storedPlan));
        const storedCompletedTasks = localStorage.getItem('completedMarketingTasks');
        if (storedCompletedTasks) {
          setCompletedTasks(JSON.parse(storedCompletedTasks));
        }
      } catch (error) {
        console.error("Failed to parse marketing data from localStorage", error);
        localStorage.removeItem('marketingPlan');
        localStorage.removeItem('completedMarketingTasks');
      }
    }
  }, []);

  const { totalTasks, completedTasksCount, progress } = useMemo(() => {
    if (!plan) return { totalTasks: 0, completedTasksCount: 0, progress: 0 };
    const total = plan.weeklyPlan.reduce((acc, day) => acc + day.tasks.length, 0);
    const completed = Object.keys(completedTasks).length;
    const progressValue = total > 0 ? (completed / total) * 100 : 0;
    return {
      totalTasks: total,
      completedTasksCount: completed,
      progress: progressValue,
    };
  }, [plan, completedTasks]);

  const handleGeneratePlan = async () => {
    setIsLoading(true);
    setPlan(null);
    setCompletedTasks({});
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
  
  const handleTaskCheckChange = (taskId: string, taskDescription: string, checked: boolean) => {
    if (checked) {
      setSelectedTask({ id: taskId, description: taskDescription });
      setIsTaskDialogOpen(true);
    } else {
      setTaskToUncheck(taskId);
      setUncheckAlertOpen(true);
    }
  };

  const handleUncheckConfirm = () => {
    if (!taskToUncheck) return;
    const newCompletedTasks = { ...completedTasks };
    delete newCompletedTasks[taskToUncheck];
    setCompletedTasks(newCompletedTasks);
    localStorage.setItem('completedMarketingTasks', JSON.stringify(newCompletedTasks));
    setUncheckAlertOpen(false);
    setTaskToUncheck(null);
  };

  const handleTaskCompletion = (data: TaskCompletionData) => {
    if (!selectedTask) return;
    const newCompletedTasks = { ...completedTasks, [selectedTask.id]: data };
    setCompletedTasks(newCompletedTasks);
    localStorage.setItem('completedMarketingTasks', JSON.stringify(newCompletedTasks));
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
        
        {plan && (
          <Card>
            <CardHeader>
              <CardTitle>Progreso Semanal</CardTitle>
              <CardDescription>
                Has completado {completedTasksCount} de {totalTasks} tareas esta semana.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={progress} className="w-full" />
            </CardContent>
          </Card>
        )}

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
                          const isCompleted = completedTasks.hasOwnProperty(taskId);
                          const completionData = completedTasks[taskId];

                          return (
                            <li key={taskId} className="flex flex-col items-start gap-3">
                              <div className="flex items-start gap-3 w-full">
                                <Checkbox
                                  id={taskId}
                                  checked={isCompleted}
                                  onCheckedChange={(checked) => handleTaskCheckChange(taskId, task, !!checked)}
                                  className="mt-1"
                                />
                                <Label
                                  htmlFor={taskId}
                                  className={cn(
                                    "text-sm text-muted-foreground transition-colors cursor-pointer flex-1",
                                    isCompleted && "line-through text-muted-foreground/70"
                                  )}
                                >
                                  {task}
                                </Label>
                              </div>
                              {isCompleted && completionData && (
                                <Collapsible className="w-full pl-8" defaultOpen>
                                  <CollapsibleTrigger asChild>
                                      <Button variant="ghost" className="w-full justify-start text-xs h-8 -ml-3">
                                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                                          Ver detalles de la publicación
                                      </Button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="space-y-2 p-3 bg-muted/50 rounded-md">
                                    <h4 className="font-semibold text-xs">{completionData.title}</h4>
                                    <p className="text-xs whitespace-pre-wrap">{completionData.text}</p>
                                    {completionData.fileUrl && (
                                        <Button asChild size="sm" variant="outline" className="mt-2 h-7">
                                            <a href={completionData.fileUrl} target="_blank" rel="noopener noreferrer">
                                                <Paperclip className="h-3 w-3 mr-2" />
                                                {completionData.fileName || 'Ver Archivo'}
                                            </a>
                                        </Button>
                                    )}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
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
              Generar un nuevo plan reemplazará el plan semanal actual y su progreso. Por favor, ingrese el código especial para continuar.
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

      {selectedTask && (
        <MarketingTaskDialog 
            open={isTaskDialogOpen}
            onOpenChange={setIsTaskDialogOpen}
            onConfirm={handleTaskCompletion}
            taskDescription={selectedTask.description}
        />
      )}
      
       <AlertDialog open={uncheckAlertOpen} onOpenChange={setUncheckAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desmarcar Tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el registro de la publicación (título, texto y archivo adjunto) asociado a esta tarea. ¿Está seguro de que quiere continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUncheckConfirm} variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Sí, eliminar registro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
