'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getWeek, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
  addDocumentNonBlocking,
  setDocumentNonBlocking,
  updateDocumentNonBlocking,
} from '@/firebase';
import { collection, doc, getDocs, deleteDoc } from 'firebase/firestore';
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lightbulb, Loader2, Paperclip, CheckCircle2, Trash2, KeyRound, Pencil, Eye, ThumbsUp, Undo2, FileCheck2, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  generateMarketingPlan,
} from '@/ai/flows/generate-marketing-plan';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { MarketingTaskDialog } from '@/components/marketing-task-dialog';
import { MarketingReviewDialog, type ReviewConfirmPayload } from '@/components/marketing-review-dialog';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MarketingPlan, CompletedMarketingTask, TaskCompletionData } from '@/lib/types';
import { TiktokIcon, InstagramIcon, FacebookIcon, LinkedinIcon } from '@/components/social-icons';


const GENERATION_CODE = 'PAISANO2026';

export default function MarketingPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<{ id: string; description: string; points: number; } | null>(null);
  const [editingTaskData, setEditingTaskData] = useState<CompletedMarketingTask | null>(null);
  
  const [uncheckAlertOpen, setUncheckAlertOpen] = useState(false);
  const [taskToUncheck, setTaskToUncheck] = useState<string | null>(null);
  
  const [planToDelete, setPlanToDelete] = useState<MarketingPlan | null>(null);
  const [isDeletePlanDialogOpen, setIsDeletePlanDialogOpen] = useState(false);
  
  const [taskToDelete, setTaskToDelete] = useState<CompletedMarketingTask | null>(null);
  const [isDeleteTaskDialogOpen, setIsDeleteTaskDialogOpen] = useState(false);
  const [deleteTaskCode, setDeleteTaskCode] = useState('');

  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [taskToReview, setTaskToReview] = useState<CompletedMarketingTask | null>(null);

  const marketingPlansQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'marketingPlans');
  }, [firestore]);
  const { data: marketingPlans, isLoading: arePlansLoading } = useCollection<MarketingPlan>(marketingPlansQuery);

  const sortedMarketingPlans = useMemo(() => {
    if (!marketingPlans) return [];
    return [...marketingPlans].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [marketingPlans]);

  // Effect to select the latest plan by default
  useEffect(() => {
    if (sortedMarketingPlans.length > 0) {
      const isSelectedPlanInList = sortedMarketingPlans.some(p => p.id === selectedPlanId);
      if (!isSelectedPlanInList) {
        setSelectedPlanId(sortedMarketingPlans[0].id);
      }
    } else {
      setSelectedPlanId(null);
    }
  }, [sortedMarketingPlans, selectedPlanId]);

  const plan = useMemo(() => {
    if (!selectedPlanId || !marketingPlans) return null;
    return marketingPlans.find(p => p.id === selectedPlanId) || null;
  }, [selectedPlanId, marketingPlans]);

  const completedTasksQuery = useMemoFirebase(() => {
    if (!firestore || !selectedPlanId) return null;
    return collection(firestore, 'marketingPlans', selectedPlanId, 'completedTasks');
  }, [firestore, selectedPlanId]);

  const { data: completedTasks, isLoading: areTasksLoading } = useCollection<CompletedMarketingTask>(completedTasksQuery);

  const { completedPoints, progress, rank, rankGoalPoints } = useMemo(() => {
    if (!plan?.planData) {
      return { totalPoints: 0, completedPoints: 0, progress: 0, rank: 'Aprendiz' as const, rankGoalPoints: 10 };
    }
    
    const completed = completedTasks
      ?.filter(task => task.reviewStatus === 'Aprobado')
      .reduce((acc, task) => acc + task.points, 0) || 0;
    
    let currentRank: 'Aprendiz' | 'Estratega' | 'Maestro' = 'Aprendiz';
    let progressValue = 0;
    let goalPoints = 10;

    if (completed >= 20) {
        currentRank = 'Maestro';
        progressValue = 100;
        goalPoints = completed;
    } else if (completed >= 10) {
        currentRank = 'Estratega';
        progressValue = ((completed - 10) / (20 - 10)) * 100;
        goalPoints = 20;
    } else {
        currentRank = 'Aprendiz';
        progressValue = (completed / 10) * 100;
        goalPoints = 10;
    }

    return {
        completedPoints: completed,
        progress: progressValue,
        rank: currentRank,
        rankGoalPoints: goalPoints,
    };
  }, [plan, completedTasks]);
  
  const planReviewStats = useMemo(() => {
    if (!completedTasks) {
      return { pending: 0, changesRequired: 0, approved: 0 };
    }

    return (completedTasks as CompletedMarketingTask[]).reduce(
      (acc, task) => {
        if (task.reviewStatus === 'Pendiente') {
          acc.pending++;
        } else if (task.reviewStatus === 'Requiere Cambios') {
          acc.changesRequired++;
        } else if (task.reviewStatus === 'Aprobado') {
          acc.approved++;
        }
        return acc;
      },
      { pending: 0, changesRequired: 0, approved: 0 }
    );
  }, [completedTasks]);

  const reviewStats = useMemo(() => {
    if (!completedTasks || !user) {
      return { tasksForMeToReview: 0, myTasksToCorrect: 0 };
    }

    const tasksForMeToReview = completedTasks.filter(
      task => task.reviewStatus === 'Pendiente'
    ).length;

    const myTasksToCorrect = completedTasks.filter(
      task => task.userId === user.uid && task.reviewStatus === 'Requiere Cambios'
    ).length;

    return { tasksForMeToReview, myTasksToCorrect };
  }, [completedTasks, user]);

  const socialMediaStats = useMemo(() => {
    const stats = {
      tiktok: 0,
      instagram: 0,
      facebook: 0,
      linkedin: 0,
    };
    if (!completedTasks) return stats;

    const approvedTasks = completedTasks.filter(task => task.reviewStatus === 'Aprobado');

    for (const task of approvedTasks) {
        const description = task.taskDescription.toLowerCase();
        if (description.includes('tiktok')) stats.tiktok++;
        if (description.includes('instagram')) stats.instagram++;
        if (description.includes('facebook')) stats.facebook++;
        if (description.includes('linkedin')) stats.linkedin++;
    }

    return stats;
  }, [completedTasks]);
  
  const isManager = userProfile?.role === 'manager';

  const handleGeneratePlan = async () => {
    if (!firestore || !user || !userProfile) {
        toast({ variant: 'destructive', title: 'Error de autenticación' });
        return;
    }
    setIsGenerating(true);

    try {
      const result = await generateMarketingPlan({
        businessDescription: 'Fabricación y venta de remolques de alta resistencia: Sand Hopper, Grain Hopper, Dump bodies, Landscapes y Watter tank.',
        socialMediaFocus: 'TikTok',
      });
      
      const newPlan: Omit<MarketingPlan, 'id'> = {
        code: `PLAN-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        weekNumber: getWeek(new Date(), { weekStartsOn: 1 }),
        planData: result,
      };

      const newDocRef = await addDocumentNonBlocking(collection(firestore, 'marketingPlans'), newPlan);
      if (newDocRef) {
        setSelectedPlanId(newDocRef.id);
        toast({ title: '¡Nuevo Plan de Grupo Generado!', description: `El plan con código ${newPlan.code} ya está disponible para todos.` });
      }

    } catch (error) {
      console.error("Error generating marketing plan:", error);
      toast({
        variant: 'destructive',
        title: 'Error de IA',
        description: 'No se pudo generar el plan de marketing en este momento.',
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleTaskCheckChange = (taskId: string, task: {description: string, points: number}, checked: boolean) => {
    if (checked) {
      setSelectedTask({ id: taskId, description: task.description, points: task.points });
      setEditingTaskData(null);
      setIsTaskDialogOpen(true);
    } else {
      setTaskToUncheck(taskId);
      setUncheckAlertOpen(true);
    }
  };

  const handleEditTaskClick = (task: CompletedMarketingTask) => {
    setEditingTaskData(task);
    setIsTaskDialogOpen(true);
  };

  const handleUncheckConfirm = async () => {
    if (!taskToUncheck || !firestore || !selectedPlanId) return;
    const taskDocRef = doc(firestore, 'marketingPlans', selectedPlanId, 'completedTasks', taskToUncheck);
    await deleteDoc(taskDocRef);
    setUncheckAlertOpen(false);
    setTaskToUncheck(null);
  };

  const handleTaskDialogConfirm = (data: TaskCompletionData) => {
    if (editingTaskData) {
      if (!firestore || !selectedPlanId || !user) return;
      const taskDocRef = doc(firestore, 'marketingPlans', selectedPlanId, 'completedTasks', editingTaskData.id);
      
      const updatedTaskData: CompletedMarketingTask = {
        ...editingTaskData,
        title: data.title,
        text: data.text,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
      };
      
      // If the user who submitted it is editing it, reset status for re-review
      if (editingTaskData.userId === user.uid) {
        updatedTaskData.reviewStatus = 'Pendiente';
        updatedTaskData.reviewFeedback = '';
      }
      
      setDocumentNonBlocking(taskDocRef, updatedTaskData, { merge: true });

    } else {
      if (!selectedTask || !firestore || !selectedPlanId || !user || !userProfile) return;
      const taskDocRef = doc(firestore, 'marketingPlans', selectedPlanId, 'completedTasks', selectedTask.id);
      
      const completedTaskData: CompletedMarketingTask = {
        ...data,
        id: selectedTask.id,
        planId: selectedPlanId,
        userId: user.uid,
        userName: `${userProfile.firstName} ${userProfile.lastName}`,
        taskDescription: selectedTask.description,
        points: selectedTask.points,
        completedAt: new Date().toISOString(),
        reviewStatus: 'Pendiente', // Default status
      };

      setDocumentNonBlocking(taskDocRef, completedTaskData, {});
    }
  };
  
  const handleReviewClick = (task: CompletedMarketingTask) => {
    setTaskToReview(task);
    setIsReviewDialogOpen(true);
  };

  const handleReviewConfirm = (payload: ReviewConfirmPayload) => {
      if (!taskToReview || !firestore || !selectedPlanId) return;

      const taskDocRef = doc(firestore, 'marketingPlans', selectedPlanId, 'completedTasks', taskToReview.id);
      
      updateDocumentNonBlocking(taskDocRef, {
          reviewStatus: payload.reviewStatus,
          reviewFeedback: payload.reviewFeedback,
      });
      
      toast({ title: 'Revisión Guardada' });
      setIsReviewDialogOpen(false);
      setTaskToReview(null);
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
  
  const handleDeletePlanConfirm = async () => {
    if (!planToDelete || !firestore) return;
    setIsGenerating(true); // Reuse isGenerating state for loading
    
    try {
        const tasksRef = collection(firestore, 'marketingPlans', planToDelete.id, 'completedTasks');
        const tasksSnapshot = await getDocs(tasksRef);
        
        const deletePromises: Promise<void>[] = [];
        tasksSnapshot.forEach(taskDoc => {
            deletePromises.push(deleteDoc(taskDoc.ref));
        });
        await Promise.all(deletePromises);

        await deleteDoc(doc(firestore, 'marketingPlans', planToDelete.id));

        toast({ title: "Plan Eliminado", description: `El plan ${planToDelete.code} y sus tareas han sido eliminados.` });
        setSelectedPlanId(null);
    } catch (error) {
        console.error("Error deleting plan:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el plan.' });
    } finally {
        setIsGenerating(false);
        setPlanToDelete(null);
        setIsDeletePlanDialogOpen(false);
    }
  };

  const handleDeleteTaskClick = (task: CompletedMarketingTask) => {
    setTaskToDelete(task);
    setIsDeleteTaskDialogOpen(true);
    setDeleteTaskCode('');
  };

  const handleDeleteTaskConfirm = async () => {
    if (!taskToDelete || !firestore || !selectedPlanId) return;
    
    if (deleteTaskCode !== 'PAISANO2026') {
      toast({
        variant: 'destructive',
        title: 'Código Incorrecto',
        description: 'El código especial ingresado no es válido.',
      });
      return;
    }

    const taskDocRef = doc(firestore, 'marketingPlans', selectedPlanId, 'completedTasks', taskToDelete.id);
    await deleteDoc(taskDocRef);
    toast({ title: 'Actividad Eliminada', description: 'La actividad completada ha sido eliminada.' });
    setIsDeleteTaskDialogOpen(false);
    setTaskToDelete(null);
  };

  const isLoading = isUserLoading || isProfileLoading || arePlansLoading || areTasksLoading;

  return (
    <>
      <div className="grid gap-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-headline font-bold">Asistente de Marketing</h1>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button onClick={() => setIsConfirmDialogOpen(true)} disabled={isGenerating} className="w-full sm:w-auto">
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lightbulb className="mr-2 h-4 w-4" />
                )}
                {isGenerating ? 'Generando...' : 'PLAN DE MARKETING SEMANAL'}
              </Button>
          </div>
        </div>

        {isManager && reviewStats.tasksForMeToReview > 0 && (
          <Alert>
            <FileCheck2 className="h-4 w-4" />
            <AlertTitle>Tareas Pendientes de Revisión</AlertTitle>
            <AlertDescription>
              Tienes {reviewStats.tasksForMeToReview} tarea(s) de marketing para revisar y aprobar.
            </AlertDescription>
          </Alert>
        )}

        {!isManager && reviewStats.myTasksToCorrect > 0 && (
          <Alert variant="destructive">
            <Undo2 className="h-4 w-4" />
            <AlertTitle>Tareas que Requieren Cambios</AlertTitle>
            <AlertDescription>
              Tienes {reviewStats.myTasksToCorrect} tarea(s) que necesitan tu atención. Busca los comentarios del manager para corregirlas.
            </AlertDescription>
          </Alert>
        )}
        
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <CardTitle>Progreso del Plan Semanal</CardTitle>
                    <CardDescription>
                        Resumen de tu avance en las metas de marketing de la semana (solo puntos de tareas aprobadas).
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    {plan?.code && <Badge variant="outline" className="text-lg py-1 px-3">{plan.code}</Badge>}
                    <Select onValueChange={setSelectedPlanId} value={selectedPlanId || ''} disabled={sortedMarketingPlans.length === 0}>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Seleccionar un plan..." />
                        </SelectTrigger>
                        <SelectContent>
                            {sortedMarketingPlans.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.code} - {format(new Date(p.createdAt), "dd MMM yyyy", { locale: es })}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {userProfile?.role === 'manager' && plan && (
                      <Button variant="outline" size="icon" onClick={() => { setPlanToDelete(plan); setIsDeletePlanDialogOpen(true); }} disabled={isGenerating}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Eliminar Plan</span>
                      </Button>
                    )}
                </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium">Rango Semanal</Label>
                    <Badge variant={rank === 'Maestro' ? 'default' : rank === 'Estratega' ? 'secondary' : 'outline'} className="text-base py-1 px-3">{rank}</Badge>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <Label className="text-sm font-medium">Progreso al Siguiente Rango</Label>
                        <span className="text-sm font-semibold">
                            {completedPoints} 
                            {rank !== 'Maestro' && ` de ${rankGoalPoints}`} pts.
                        </span>
                    </div>
                    <Progress value={progress} className="w-full h-3" />
                </div>
              </div>
              <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 text-center">Estado de las Tareas</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <ThumbsUp className="mx-auto h-6 w-6 text-green-500 mb-1" />
                      <p className="text-xl font-bold">{planReviewStats.approved}</p>
                      <p className="text-xs font-medium text-muted-foreground">Aprobadas</p>
                    </div>
                    <div>
                      <History className="mx-auto h-6 w-6 text-gray-500 mb-1" />
                      <p className="text-xl font-bold">{planReviewStats.pending}</p>
                      <p className="text-xs font-medium text-muted-foreground">Pendientes</p>
                    </div>
                    <div>
                      <Undo2 className="mx-auto h-6 w-6 text-yellow-500 mb-1" />
                      <p className="text-xl font-bold">{planReviewStats.changesRequired}</p>
                      <p className="text-xs font-medium text-muted-foreground">Con Cambios</p>
                    </div>
                  </div>
              </div>
               <div className="pt-4 border-t">
                    <div className="p-4 rounded-lg bg-muted/50 mt-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-3 text-center">Actividades Aprobadas por Red Social</h4>
                        <div className="grid grid-cols-4 gap-4 text-center">
                            <div>
                                <TiktokIcon className="mx-auto h-6 w-6 text-foreground mb-1" />
                                <p className="text-xl font-bold">{socialMediaStats.tiktok}</p>
                                <p className="text-xs font-medium text-muted-foreground">TikTok</p>
                            </div>
                            <div>
                                <InstagramIcon className="mx-auto h-6 w-6 text-pink-500 mb-1" />
                                <p className="text-xl font-bold">{socialMediaStats.instagram}</p>
                                <p className="text-xs font-medium text-muted-foreground">Instagram</p>
                            </div>
                            <div>
                                <FacebookIcon className="mx-auto h-6 w-6 text-blue-600 mb-1" />
                                <p className="text-xl font-bold">{socialMediaStats.facebook}</p>
                                <p className="text-xs font-medium text-muted-foreground">Facebook</p>
                            </div>
                            <div>
                                <LinkedinIcon className="mx-auto h-6 w-6 text-sky-700 mb-1" />
                                <p className="text-xl font-bold">{socialMediaStats.linkedin}</p>
                                <p className="text-xs font-medium text-muted-foreground">LinkedIn</p>
                            </div>
                        </div>
                    </div>
              </div>
            </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan de Contenido Semanal</CardTitle>
            <CardDescription>
              Aquí tienes una lista de objetivos diarios (L-V) y tareas sugeridas por la IA. 
              Para generar un nuevo plan, necesitarás el código especial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              </div>
            ) : !plan ? (
              <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed rounded-lg">
                  <p className="text-lg font-semibold">Tu plan de marketing te espera</p>
                  <p className="text-muted-foreground">
                    Presiona el botón de arriba para que la IA genere tus tareas de la semana.
                  </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plan.planData.weeklyPlan.map((dayPlan) => (
                  <Card key={dayPlan.day} className="flex flex-col">
                    <CardHeader>
                      <CardTitle className="text-lg">{dayPlan.day}</CardTitle>
                      <CardDescription>{dayPlan.theme}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <ul className="space-y-3">
                        {dayPlan.tasks.map((task, index) => {
                          const taskId = `${dayPlan.day}-${index}`;
                          const completionData = completedTasks?.find(t => t.id === taskId);
                          const isCompleted = !!completionData;
                          
                           const statusDetails = {
                              'Pendiente': { label: 'Pendiente', icon: <Pencil className="h-3 w-3" />, className: 'bg-gray-100 text-gray-800' },
                              'Aprobado': { label: 'Aprobado', icon: <ThumbsUp className="h-3 w-3" />, className: 'bg-green-100 text-green-800' },
                              'Requiere Cambios': { label: 'Requiere Cambios', icon: <Undo2 className="h-3 w-3" />, className: 'bg-yellow-100 text-yellow-800' },
                            }[completionData?.reviewStatus || 'Pendiente'];

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
                                  {task.description}
                                </Label>
                                <Badge variant="outline" className="shrink-0">{task.points} {task.points === 1 ? 'pto' : 'pts'}</Badge>
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
                                    <div className="flex justify-between items-center">
                                      <h4 className="font-semibold text-xs">{completionData.title}</h4>
                                      <Badge variant="secondary" className="text-xs">{completionData.userName}</Badge>
                                    </div>
                                    <p className="text-xs whitespace-pre-wrap">{completionData.text}</p>
                                     <div className="mt-2 pt-2 border-t">
                                        <div className="flex items-center justify-between">
                                            <h5 className="text-xs font-semibold text-muted-foreground">REVISIÓN</h5>
                                            <Badge variant="outline" className={cn("text-xs", statusDetails.className)}>
                                                {statusDetails.icon}
                                                <span className="ml-1.5">{statusDetails.label}</span>
                                            </Badge>
                                        </div>
                                        {completionData.reviewStatus === 'Requiere Cambios' && completionData.reviewFeedback && (
                                            <div className="mt-2 p-2 rounded-md bg-yellow-50 text-yellow-900 border border-yellow-200 text-xs">
                                                <p className="font-bold">Comentarios:</p>
                                                <p className="italic">"{completionData.reviewFeedback}"</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        {completionData.fileUrl ? (
                                            <Button asChild size="sm" variant="outline" className="h-7">
                                                <a href={completionData.fileUrl} target="_blank" rel="noopener noreferrer">
                                                    <Paperclip className="h-3 w-3 mr-2" />
                                                    {completionData.fileName || 'Ver Archivo'}
                                                </a>
                                            </Button>
                                        ) : <div />}

                                        <div className="flex items-center">
                                          {userProfile?.role === 'manager' && (
                                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleReviewClick(completionData)} title="Revisar actividad">
                                                  <Eye className="h-4 w-4" />
                                                  <span className="sr-only">Revisar actividad</span>
                                              </Button>
                                          )}
                                          {(completionData.userId === user?.uid || userProfile?.role === 'manager') && (
                                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditTaskClick(completionData)} title="Editar actividad">
                                                  <Pencil className="h-4 w-4" />
                                                  <span className="sr-only">Editar actividad</span>
                                              </Button>
                                          )}
                                          {userProfile?.role === 'manager' && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteTaskClick(completionData)} title="Eliminar actividad">
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">Eliminar actividad</span>
                                            </Button>
                                          )}
                                        </div>
                                    </div>
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
              Generar un nuevo plan creará una nueva versión con un nuevo código. El plan anterior y su progreso permanecerán en el historial. Por favor, ingrese el código especial para continuar.
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

      <MarketingTaskDialog 
        open={isTaskDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedTask(null);
            setEditingTaskData(null);
          }
          setIsTaskDialogOpen(isOpen);
        }}
        onConfirm={handleTaskDialogConfirm}
        taskDescription={editingTaskData?.taskDescription || selectedTask?.description || ''}
        initialData={editingTaskData}
      />
      
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
      
      <AlertDialog open={isDeletePlanDialogOpen} onOpenChange={setIsDeletePlanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar Plan de Marketing?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el plan "{planToDelete?.code}" y todas sus tareas completadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isGenerating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlanConfirm} variant="destructive" disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {isGenerating ? 'Eliminando...' : 'Eliminar Permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteTaskDialogOpen} onOpenChange={setIsDeleteTaskDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar Actividad Completada?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción es irreversible y eliminará el registro de la publicación. Ingrese el código especial para confirmar.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2 space-y-2">
                <Label htmlFor="delete-task-code">Código Especial</Label>
                <div className="relative">
                    <KeyRound className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="delete-task-code"
                        type="password"
                        placeholder="Ingrese el código"
                        className="pl-8"
                        value={deleteTaskCode}
                        onChange={(e) => setDeleteTaskCode(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleDeleteTaskConfirm();
                            }
                        }}
                    />
                </div>
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteTaskConfirm} variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar Permanentemente
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MarketingReviewDialog
        open={isReviewDialogOpen}
        onOpenChange={setIsReviewDialogOpen}
        onConfirm={handleReviewConfirm}
        task={taskToReview}
        isSubmitting={isGenerating}
      />
    </>
  );
}
