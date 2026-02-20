'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
  addDocumentNonBlocking,
} from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import {
  format,
  isToday,
  isTomorrow,
  isPast,
  isFuture,
  isThisWeek,
  formatDistanceToNow,
  isSameDay,
  differenceInDays,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, MoreVertical, Pencil, Trash2, Phone, Mail, MessageSquare, StickyNote, Users, ListTodo, AlertOctagon, CalendarClock, CheckCheck, Lightbulb, RefreshCcw, History, MessageCircle, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FollowUpDialog, type FollowUpSubmitPayload } from '@/components/follow-up-dialog';
import { CompleteFollowUpDialog, type CompletionPayload } from '@/components/complete-follow-up-dialog';
import { generateFollowUpSummary } from '@/ai/flows/generate-follow-up-summary';
import { getClassification, getBadgeClass } from '@/lib/types';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ResponseRateChart } from '@/components/response-rate-chart';
import { ClientTimelineDialog } from '@/components/client-timeline-dialog';
import { getUSHolidays } from '@/lib/holidays';

const groupStyleKeys = {
    destructive: {
        title: "text-destructive",
        badge: "destructive",
        icon: "bg-destructive/10 text-destructive",
        date: "text-destructive font-semibold",
    },
    primary: {
        title: "text-primary",
        badge: "default",
        icon: "bg-primary/10 text-primary",
        date: "text-destructive font-semibold",
    },
    secondary: {
        title: "text-foreground",
        badge: "secondary",
        icon: "bg-muted text-muted-foreground",
        date: "text-destructive font-semibold",
    },
    muted: {
        title: "text-muted-foreground",
        badge: "outline",
        icon: "bg-muted text-muted-foreground",
        date: "text-destructive font-semibold",
    }
} as const;


export default function FollowUpsPage() {
  const { user, isUserLoading: isUserAuthLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedUserId, setSelectedUserId] = useState<string>('me');
  const [showCompleted, setShowCompleted] = useState(false);
  
  const [isFollowUpDialogOpen, setIsFollowUpDialogOpen] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<any | null>(null);
  const [currentProspect, setCurrentProspect] = useState<any | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [activityToComplete, setActivityToComplete] = useState<any | null>(null);

  const [assistantSummary, setAssistantSummary] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineLeadId, setTimelineLeadId] = useState<string | null>(null);

  const holidayAlert = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const usHolidays = [
        ...getUSHolidays(currentYear),
        ...getUSHolidays(currentYear + 1) // Include next year for early-year holidays
    ];

    // Check if today is a holiday
    const todayHoliday = usHolidays.find(h => isSameDay(h.date, today));
    if (todayHoliday) {
      return `¡Atención! Hoy es ${todayHoliday.name}, día festivo en EUA. Es poco probable que los clientes respondan.`;
    }

    // Find the next upcoming holiday
    const upcomingHoliday = usHolidays
      .filter(h => h.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

    if (upcomingHoliday) {
      const daysUntil = differenceInDays(upcomingHoliday.date, today);
      if (daysUntil <= 7) {
        return `Próximo día festivo en EUA: ${upcomingHoliday.name} (${format(upcomingHoliday.date, 'eeee, dd MMMM', { locale: es })}). La respuesta de los clientes puede ser limitada.`;
      }
    }

    return null;
  }, []);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || userProfile?.role !== 'manager') return null;
    return query(collection(firestore, 'users'));
  }, [firestore, userProfile]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection(usersQuery);

  const activitiesQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseCollection = collection(firestore, 'activities');
    const isManager = userProfile.role === 'manager';

    if (isManager) {
      if (selectedUserId === 'all') {
        return query(baseCollection);
      }
      const userIdToFilter = selectedUserId === 'me' ? user.uid : selectedUserId;
      return query(baseCollection, where('sellerId', '==', userIdToFilter));
    }

    return query(baseCollection, where('sellerId', '==', user.uid));
  }, [firestore, user, userProfile, selectedUserId]);
  const { data: activities, isLoading: areActivitiesLoading } = useCollection(activitiesQuery);

  const leadsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseCollection = collection(firestore, 'leads');
    const isManager = userProfile.role === 'manager';
    if (isManager) {
        if (selectedUserId === 'all') return query(baseCollection);
        const userIdToFilter = selectedUserId === 'me' ? user.uid : selectedUserId;
        return query(baseCollection, where('sellerId', '==', userIdToFilter));
    }
    return query(baseCollection, where('sellerId', '==', user.uid));
  }, [firestore, user, userProfile, selectedUserId]);
  const { data: leads, isLoading: areLeadsLoading } = useCollection(leadsQuery);
  
  const opportunitiesQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseCollection = collection(firestore, 'opportunities');
    const isManager = userProfile.role === 'manager';
    if (isManager) {
        if (selectedUserId === 'all') return query(baseCollection);
        const userIdToFilter = selectedUserId === 'me' ? user.uid : selectedUserId;
        return query(baseCollection, where('sellerId', '==', userIdToFilter));
    }
    return query(baseCollection, where('sellerId', '==', user.uid));
  }, [firestore, user, userProfile, selectedUserId]);
  const { data: opportunities, isLoading: areOppsLoading } = useCollection(opportunitiesQuery);

  const quotationsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseCollection = collection(firestore, 'quotations');
    const isManager = userProfile.role === 'manager';
    if (isManager) {
        if (selectedUserId === 'all') return query(baseCollection);
        const userIdToFilter = selectedUserId === 'me' ? user.uid : selectedUserId;
        return query(baseCollection, where('sellerId', '==', userIdToFilter));
    }
    return query(baseCollection, where('sellerId', '==', user.uid));
  }, [firestore, user, userProfile, selectedUserId]);
  const { data: quotations, isLoading: areQuotsLoading } = useCollection(quotationsQuery);

  const allActivitiesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'activities');
  }, [firestore]);
  const { data: allActivities, isLoading: areAllActivitiesLoading } = useCollection(allActivitiesQuery);


  const isLoading = isUserAuthLoading || isProfileLoading || areUsersLoading || areActivitiesLoading || areLeadsLoading || areOppsLoading || areQuotsLoading || areAllActivitiesLoading;

  const followUpStats = useMemo(() => {
    if (!activities) {
      return {
        totalPending: 0,
        overdue: 0,
        dueToday: 0,
        completed: 0,
      };
    }

    let overdue = 0;
    let dueToday = 0;
    
    (activities as any[]).forEach(activity => {
      if (activity.completed) return; 

      if (activity.dueDate) {
        const dueDate = new Date(activity.dueDate);
        if (isPast(dueDate) && !isToday(dueDate)) {
          overdue++;
        } else if (isToday(dueDate)) {
          dueToday++;
        }
      }
    });

    return {
      totalPending: (activities as any[]).filter(a => !a.completed).length,
      overdue,
      dueToday,
      completed: (activities as any[]).filter(a => a.completed).length,
    };
  }, [activities]);

   const prospectsWithoutFollowUp = useMemo(() => {
    if (!leads || !opportunities || !activities) return [];

    const latestOpportunities = new Map<string, any>();
    (opportunities as any[]).forEach(op => {
      if (!latestOpportunities.has(op.leadId) || new Date(op.createdDate) > new Date(latestOpportunities.get(op.leadId).createdDate)) {
        latestOpportunities.set(op.leadId, op);
      }
    });

    const activeLeadIds = new Set<string>();
    for (const lead of (leads as any[])) {
      const opportunity = latestOpportunities.get(lead.id);
      if (opportunity && opportunity.stage !== 'Cierre de venta' && opportunity.stage !== 'Descartado' && opportunity.stage !== 'Financiamiento Externo') {
        activeLeadIds.add(lead.id);
      }
    }
    
    const leadsWithPendingFollowUps = new Set<string>(
      (activities as any[]).filter(a => !a.completed).map(a => a.leadId)
    );

    const leadsWithoutFollowUpIds = new Set<string>([...activeLeadIds].filter(id => !leadsWithPendingFollowUps.has(id)));
    
    return (leads as any[]).filter(lead => leadsWithoutFollowUpIds.has(lead.id)).map(lead => lead.clientName);

  }, [leads, opportunities, activities]);
  
  const fetchAssistantSummary = useCallback(async () => {
    if (!userProfile || !followUpStats || prospectsWithoutFollowUp === null || !user) return;
    setIsSummaryLoading(true);
    try {
      const result = await generateFollowUpSummary({
        userName: userProfile.firstName,
        totalPending: followUpStats.totalPending,
        dueToday: followUpStats.dueToday,
        overdue: followUpStats.overdue,
        prospectsWithoutFollowUp: prospectsWithoutFollowUp,
      });
      setAssistantSummary(result.summary);
      
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(`followUpSummaryCache_${user.uid}`, result.summary);
      localStorage.setItem(`followUpSummaryLastFetched_${user.uid}`, today);

    } catch (error) {
      console.error("Failed to generate assistant summary:", error);
      setAssistantSummary("No se pudo cargar el resumen del asistente en este momento. Intente de nuevo.");
      toast({ variant: "destructive", title: "Error de IA" });
    } finally {
      setIsSummaryLoading(false);
    }
  }, [user, userProfile, followUpStats, prospectsWithoutFollowUp, toast]);

  useEffect(() => {
    if (isLoading || !user || !userProfile) {
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const lastFetchedKey = `followUpSummaryLastFetched_${user.uid}`;
    const cachedSummaryKey = `followUpSummaryCache_${user.uid}`;
    const lastFetchedDate = localStorage.getItem(lastFetchedKey);

    if (lastFetchedDate === today) {
      const cachedSummary = localStorage.getItem(cachedSummaryKey);
      if (cachedSummary) {
        setAssistantSummary(cachedSummary);
        setIsSummaryLoading(false);
        return;
      }
    }

    fetchAssistantSummary();
  }, [isLoading, user, userProfile, fetchAssistantSummary]);

  const activityGroups = useMemo(() => {
    if (!activities || !leads || !opportunities || !quotations) return [];
    
    const leadsMap = new Map((leads as any[]).map(l => [l.id, l]));
    const opportunitiesMap = new Map();
    (opportunities as any[]).forEach(op => {
      if (!opportunitiesMap.has(op.leadId) || new Date(op.createdDate) > new Date(opportunitiesMap.get(op.leadId).createdDate)) {
        opportunitiesMap.set(op.leadId, op);
      }
    });

    const quotationsMap = new Map();
    (quotations as any[]).forEach(q => {
        if (!quotationsMap.has(q.opportunityId) || new Date(q.createdDate) > new Date(quotationsMap.get(q.opportunityId).createdDate)) {
            quotationsMap.set(q.opportunityId, q);
        }
    });

    const enriched = (activities as any[]).map((act) => {
      const lead = leadsMap.get(act.leadId);
      const opportunity = opportunitiesMap.get(act.leadId);
      const quotation = opportunity ? quotationsMap.get(opportunity.id) : null;
      
      const prospectActivities = (activities as any[]).filter(a => a.leadId === act.leadId)
        .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());

      return {
        ...act,
        prospect: {
            ...(lead || {}),
            opportunity,
            quotation,
            activities: prospectActivities,
        },
        clientName: lead?.clientName || 'Cliente no encontrado',
      };
    });

    const pendingActivities: any[] = [];
    const completedActivities: any[] = [];

    enriched.forEach((act) => {
      if (act.completed) {
        completedActivities.push(act);
      } else {
        pendingActivities.push(act);
      }
    });

    const overdue: any[] = [];
    const today: any[] = [];
    const tomorrow: any[] = [];
    const thisWeek: any[] = [];
    const upcoming: any[] = [];
    const noDate: any[] = [];

    pendingActivities.forEach((activity) => {
      if (!activity.dueDate) {
        noDate.push(activity);
      } else {
        const dueDate = new Date(activity.dueDate);
        if (isPast(dueDate) && !isToday(dueDate)) {
          overdue.push(activity);
        } else if (isToday(dueDate)) {
          today.push(activity);
        } else if (isTomorrow(dueDate)) {
          tomorrow.push(activity);
        } else if (isThisWeek(dueDate, { weekStartsOn: 1 })) {
          thisWeek.push(activity);
        } else if (isFuture(dueDate)) {
          upcoming.push(activity);
        }
      }
    });

    const sortByDate = (a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    const sortByCompletedDate = (a: any, b: any) => new Date(b.completedDate || b.createdDate).getTime() - new Date(a.completedDate || a.createdDate).getTime();
    const sortByCreated = (a: any, b: any) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();

    const pendingGroups = [
      { title: 'Atrasados', activities: overdue.sort(sortByDate), styleKey: 'destructive' as const },
      { title: 'Hoy', activities: today.sort(sortByDate), styleKey: 'primary' as const },
      { title: 'Mañana', activities: tomorrow.sort(sortByDate), styleKey: 'secondary' as const },
      { title: 'Esta Semana', activities: thisWeek.sort(sortByDate), styleKey: 'secondary' as const },
      { title: 'Próximamente', activities: upcoming.sort(sortByDate), styleKey: 'muted' as const },
      { title: 'Sin Fecha', activities: noDate.sort(sortByCreated), styleKey: 'muted' as const },
    ].filter(group => group.activities.length > 0);
    
    if (showCompleted && completedActivities.length > 0) {
      const completedGroup = {
        title: 'Historial (Completados)',
        activities: completedActivities.sort(sortByCompletedDate),
        styleKey: 'muted' as const,
      };
      return [...pendingGroups, completedGroup];
    }
    
    return pendingGroups;

  }, [activities, leads, opportunities, quotations, showCompleted]);
  
  const responseRateByDay = useMemo(() => {
    if (!allActivities) return [];

    const completedCalls = (allActivities as any[]).filter(
      (a) => a.type === 'Llamada' && a.completed && a.completedDate && a.clientResponded !== undefined
    );

    const dayStats: Record<string, { responded: number; notResponded: number }> = {
      'Lunes': { responded: 0, notResponded: 0 },
      'Martes': { responded: 0, notResponded: 0 },
      'Miércoles': { responded: 0, notResponded: 0 },
      'Jueves': { responded: 0, notResponded: 0 },
      'Viernes': { responded: 0, notResponded: 0 },
      'Sábado': { responded: 0, notResponded: 0 },
      'Domingo': { responded: 0, notResponded: 0 },
    };
    
    const dayMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    completedCalls.forEach(call => {
      const callDate = new Date(call.completedDate);
      const dayOfWeek = callDate.getDay();
      const dayName = dayMap[dayOfWeek];
      
      if(dayName) {
          if (call.clientResponded) {
            dayStats[dayName].responded++;
          } else {
            dayStats[dayName].notResponded++;
          }
      }
    });

    return Object.entries(dayStats).map(([day, stats]) => {
      const total = stats.responded + stats.notResponded;
      const rate = total > 0 ? (stats.responded / total) * 100 : 0;
      return {
        day,
        'Tasa de Respuesta': parseFloat(rate.toFixed(1)),
        'Llamadas Totales': total
      };
    });
  }, [allActivities]);
  
 const handleToggleActivityComplete = (activity: any, completed: boolean) => {
    if (!firestore) return;

    if (completed) {
      // Open the completion dialog
      setActivityToComplete(activity);
      setIsCompleteDialogOpen(true);
    } else {
      // If un-checking, just update the status without a dialog
      const activityRef = doc(firestore, 'activities', activity.id);
      updateDocumentNonBlocking(activityRef, { 
        completed: false, 
        completedDate: null,
        clientResponded: null,
        completionNotes: null,
      });
      toast({
        title: `Actividad Pendiente`,
        description: 'El seguimiento ha sido marcado como no completado.',
      });
    }
  };

  const handleCompletionConfirm = (payload: CompletionPayload) => {
    if (!firestore || !user || !userProfile || !activityToComplete) return;

    setIsSubmitting(true);
    const { activityId, clientResponded, completionNotes, scheduleNext, nextFollowUp } = payload;
    
    // 1. Update the completed activity
    const activityRef = doc(firestore, 'activities', activityId);
    updateDocumentNonBlocking(activityRef, {
      completed: true,
      completedDate: new Date().toISOString(),
      clientResponded,
      completionNotes,
    });

    // 2. Update the lead's tag based on response
    const leadRef = doc(firestore, 'leads', activityToComplete.leadId);
    const newTag = clientResponded ? 'success' : 'danger';
    updateDocumentNonBlocking(leadRef, { tag: newTag });

    // 3. Create new activity if scheduled
    if (scheduleNext && nextFollowUp) {
        addDocumentNonBlocking(collection(firestore, 'activities'), {
            leadId: activityToComplete.leadId,
            sellerId: user.uid,
            sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
            type: nextFollowUp.type,
            description: nextFollowUp.description,
            dueDate: nextFollowUp.dueDate ? nextFollowUp.dueDate.toISOString() : null,
            completed: false,
            createdDate: new Date().toISOString(),
        });
    }

    toast({ title: "Seguimiento completado", description: "El resultado ha sido guardado y el prospecto etiquetado." });
    
    setIsSubmitting(false);
    setIsCompleteDialogOpen(false);
    setActivityToComplete(null);
  };


  const handleEditActivityClick = (activity: any) => {
    setCurrentActivity(activity);
    setCurrentProspect(activity.prospect);
    setIsFollowUpDialogOpen(true);
  };

  const handleDeleteActivityClick = (activity: any) => {
    setActivityToDelete(activity);
    setIsDeleteDialogOpen(true);
  };
  
  const handleViewTimeline = (leadId: string) => {
    setTimelineLeadId(leadId);
    setIsTimelineOpen(true);
  };

  const handleDeleteActivityConfirm = () => {
    if (!activityToDelete || !firestore) return;
    setIsSubmitting(true);
    const activityRef = doc(firestore, 'activities', activityToDelete.id);
    deleteDocumentNonBlocking(activityRef);
    toast({ title: 'Seguimiento eliminado' });
    setIsDeleteDialogOpen(false);
    setActivityToDelete(null);
    setIsSubmitting(false);
  };
  
  const handleFollowUpSubmit = (payload: FollowUpSubmitPayload) => {
    if (!currentProspect || !firestore || !user || !userProfile) return;

    setIsSubmitting(true);
    const { id, observations, nextContactDate, nextContactType } = payload;
    
    const activityData: any = {
        leadId: currentProspect.id,
        sellerId: user.uid,
        sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
        type: nextContactType || 'Nota',
        description: observations || '',
        dueDate: nextContactDate ? nextContactDate.toISOString() : null,
        completed: payload.id ? currentActivity.completed : false,
        createdDate: payload.id ? currentActivity.createdDate : new Date().toISOString(),
        quotationId: payload.id ? currentActivity.quotationId : null,
    };

    if (payload.id) {
        updateDocumentNonBlocking(doc(firestore, 'activities', payload.id), activityData);
    } else {
        addDocumentNonBlocking(collection(firestore, 'activities'), activityData);
    }
    
    toast({ title: payload.id ? 'Seguimiento Actualizado' : 'Actividad Creada' });
    setIsFollowUpDialogOpen(false);
    setCurrentActivity(null);
    setCurrentProspect(null);
    setIsSubmitting(false);
  };

  const activityIcons: { [key: string]: React.ReactNode } = {
    'Llamada': <Phone className="h-5 w-5" />,
    'Correo': <Mail className="h-5 w-5" />,
    'Mensaje': <MessageSquare className="h-5 w-5" />,
    'Mensaje de Texto': <MessageCircle className="h-5 w-5" />,
    'Nota': <StickyNote className="h-5 w-5" />,
    'Reunión': <Users className="h-5 w-5" />,
  };


  return (
    <>
      <div className="grid gap-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-headline font-bold">Centro de Seguimiento</h1>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {userProfile?.role === 'manager' && (
              <Select onValueChange={setSelectedUserId} value={selectedUserId} disabled={isLoading}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Seleccionar vendedor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Mis Seguimientos</SelectItem>
                  <SelectItem value="all">Todos los Seguimientos</SelectItem>
                  {allUsers?.filter((u) => u.id !== user?.uid).map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {`${u.firstName} ${u.lastName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" onClick={() => setShowCompleted(prev => !prev)} className="w-full sm:w-auto justify-center">
                <History className="mr-2 h-4 w-4" />
                {showCompleted ? 'Ocultar Historial' : 'Ver Historial'}
            </Button>
          </div>
        </div>

        {holidayAlert && (
          <Alert variant="default" className="bg-yellow-100 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200 [&>svg]:text-yellow-600">
            <AlertOctagon className="h-4 w-4" />
            <AlertTitle className="font-bold">Aviso de Día Festivo</AlertTitle>
            <AlertDescription>
              {holidayAlert}
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                {Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
        ) : (
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                <Card className="bg-muted/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                        <CardTitle className="text-xs font-medium">Pendientes</CardTitle>
                        <ListTodo className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-lg font-bold">{followUpStats.totalPending}</div>
                    </CardContent>
                </Card>
                <Card className="bg-muted/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                        <CardTitle className="text-xs font-medium">Atrasados</CardTitle>
                        <AlertOctagon className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-lg font-bold text-destructive">{followUpStats.overdue}</div>
                    </CardContent>
                </Card>
                <Card className="bg-muted/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                        <CardTitle className="text-xs font-medium">Para Hoy</CardTitle>
                        <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-lg font-bold">{followUpStats.dueToday}</div>
                    </CardContent>
                </Card>
                <Card className="bg-muted/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                        <CardTitle className="text-xs font-medium">Completados</CardTitle>
                        <CheckCheck className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-lg font-bold text-green-600">{followUpStats.completed}</div>
                    </CardContent>
                </Card>
            </div>
        )}
        
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-primary" />
                        Asistente de Seguimiento
                    </CardTitle>
                    <CardDescription className="mt-1">
                        Un resumen de IA con tus prioridades y sugerencias.
                    </CardDescription>
                </div>
                <Button variant="outline" size="icon" onClick={fetchAssistantSummary} disabled={isSummaryLoading}>
                    <RefreshCcw className={cn("h-4 w-4", isSummaryLoading && "animate-spin")} />
                </Button>
            </CardHeader>
            <CardContent>
                {isSummaryLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-[80%]" />
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{assistantSummary}</p>
                )}
            </CardContent>
        </Card>

        <ResponseRateChart data={responseRateByDay} isLoading={isLoading} />

        {isLoading && !assistantSummary ? (
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
        ) : activityGroups.length > 0 ? (
          <div className="space-y-8">
            {activityGroups.map((group) => (
              <section key={group.title}>
                 <div className="flex items-center gap-3 mb-4">
                    <h2 className={cn("text-xl font-semibold", groupStyleKeys[group.styleKey].title)}>
                    {group.title}
                    </h2>
                    <Badge variant={groupStyleKeys[group.styleKey].badge}>{group.activities.length}</Badge>
                </div>
                <div className="space-y-3">
                  {group.activities.map((activity) => {
                      const dueDate = activity.dueDate ? new Date(activity.dueDate) : null;
                      const clientResponded = activity.clientResponded;
                      
                      let cardBackgroundClass = 'bg-card hover:bg-muted/60';
                      let cardBorderClass = 'border';
                      const isPendingInfo = activity.description === 'PENDIENTE ENVIAR INFORMACIÓN' && !activity.completed;

                      if (isPendingInfo) {
                        cardBackgroundClass = 'bg-yellow-100 dark:bg-yellow-950/40';
                        cardBorderClass = 'border-yellow-200 dark:border-yellow-800';
                      } else if (activity.completed) {
                          if (clientResponded === true) {
                            cardBackgroundClass = 'bg-green-50 dark:bg-green-950/40';
                            cardBorderClass = 'border-green-200 dark:border-green-800';
                          } else if (clientResponded === false) {
                            cardBackgroundClass = 'bg-red-50 dark:bg-red-950/40';
                            cardBorderClass = 'border-red-200 dark:border-red-800';
                          } else {
                            cardBackgroundClass = 'bg-muted/50';
                          }
                      }

                      return (
                        <div
                          key={activity.id}
                          className={cn(
                            'flex items-start gap-4 rounded-lg p-4 transition-all',
                            cardBorderClass,
                            cardBackgroundClass
                          )}
                        >
                            <span className={cn("flex h-10 w-10 items-center justify-center rounded-full mt-1 shrink-0", groupStyleKeys[group.styleKey].icon)}>
                                {activityIcons[activity.type] || <Calendar className="h-5 w-5" />}
                            </span>

                            <div className={cn("flex-grow grid gap-1", activity.completed && "text-muted-foreground")}>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className={cn("font-semibold", activity.completed ? 'line-through' : 'text-foreground')}>
                                        {activity.type}
                                        <span className="font-normal text-muted-foreground"> con </span> 
                                        <span className="font-medium">{activity.clientName.toUpperCase()}</span>
                                        {activity.prospect?.contactPerson && (
                                            <span className="text-sm font-normal text-muted-foreground"> ({activity.prospect.contactPerson.toUpperCase()})</span>
                                        )}
                                    </p>
                                    {activity.prospect?.opportunity?.stage && (
                                        <Badge variant="outline" className={cn('font-semibold uppercase text-[10px] px-1.5 py-0', getBadgeClass(getClassification(activity.prospect.opportunity.stage)))}>
                                            {activity.prospect.opportunity.stage}
                                        </Badge>
                                    )}
                                </div>
                                <p className={cn("text-sm", activity.completed ? 'line-through' : 'text-muted-foreground')}>{activity.description || 'Sin descripción.'}</p>
                                {dueDate && (
                                    <div className={cn("flex items-center gap-2 text-sm", activity.completed ? 'text-muted-foreground' : groupStyleKeys[group.styleKey].date)}>
                                        <Calendar className="h-4 w-4" />
                                        <span className="font-medium capitalize">
                                            {format(dueDate, "eeee, dd MMMM", { locale: es })}
                                        </span>
                                        {!activity.completed && (
                                          <span className="font-normal text-xs">
                                              ({formatDistanceToNow(dueDate, { locale: es, addSuffix: true })})
                                          </span>
                                        )}
                                    </div>
                                )}
                                <Collapsible className="pt-1">
                                    <CollapsibleTrigger asChild>
                                        <Button variant="ghost" className="w-full justify-start text-xs h-8 -ml-2 text-muted-foreground">
                                            <History className="h-4 w-4 mr-2" />
                                            Historial del Cliente ({activity.prospect.activities.length} {activity.prospect.activities.length === 1 ? 'actividad' : 'actividades'})
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="pl-4 pr-2">
                                        {activity.prospect.activities.length > 0 ? (
                                            <div className="space-y-2 mt-1 border-l-2 ml-2 pl-4 py-2">
                                                {activity.prospect.activities.slice(0, 5).map((act: any) => (
                                                    <div key={act.id} className="text-xs">
                                                        <p className="font-semibold">{act.type} - {format(new Date(act.createdDate), "dd/MM/yy")}</p>
                                                        <p className="text-muted-foreground italic">"{act.description || 'Sin descripción.'}"</p>
                                                    </div>
                                                ))}
                                                {activity.prospect.activities.length > 5 && <p className="text-xs text-muted-foreground mt-2">... y más.</p>}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground pl-4 py-2">No hay historial de actividades.</p>
                                        )}
                                        <Button variant="link" size="sm" className="w-full justify-start pl-3 text-xs h-auto mt-2 text-primary hover:underline" onClick={() => handleViewTimeline(activity.leadId)}>
                                            Ver línea de tiempo completa
                                        </Button>
                                    </CollapsibleContent>
                                </Collapsible>
                                <div className="flex items-center gap-4 pt-2 mt-2 border-t">
                                    <a 
                                        href={activity.prospect?.phone ? `https://wa.me/${(activity.prospect.country === 'US' ? '1' : '52')}${activity.prospect.phone.replace(/\D/g, '')}` : '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => !activity.prospect?.phone && e.preventDefault()}
                                        className={cn(
                                            "transition-colors",
                                            activity.prospect?.phone 
                                                ? "text-green-500 hover:text-green-600" 
                                                : "text-muted-foreground/40 cursor-not-allowed"
                                        )}
                                        title={activity.prospect?.phone || 'No hay teléfono para WhatsApp'}
                                    >
                                        <MessageSquare className="h-5 w-5" />
                                    </a>
                                    <a 
                                        href={activity.prospect?.phone ? `sms:${activity.prospect.phone.replace(/\D/g, '')}` : '#'}
                                        onClick={(e) => !activity.prospect?.phone && e.preventDefault()}
                                        className={cn(
                                            "transition-colors",
                                            activity.prospect?.phone 
                                                ? "text-foreground/80 hover:text-foreground" 
                                                : "text-muted-foreground/40 cursor-not-allowed"
                                        )}
                                         title={activity.prospect?.phone || 'No hay teléfono'}
                                    >
                                        <MessageCircle className="h-5 w-5" />
                                    </a>
                                    <a 
                                        href={activity.prospect?.email ? `https://mail.google.com/mail/?view=cm&fs=1&to=${activity.prospect.email}` : '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => !activity.prospect?.email && e.preventDefault()}
                                        className={cn(
                                            "transition-colors",
                                            activity.prospect?.email 
                                                ? "text-blue-500 hover:text-blue-600" 
                                                : "text-muted-foreground/40 cursor-not-allowed"
                                        )}
                                        title={activity.prospect?.email || 'No hay email'}
                                    >
                                        <Mail className="h-5 w-5" />
                                    </a>
                                    <a 
                                        href={activity.prospect?.phone ? `tel:${activity.prospect.phone}` : '#'}
                                        onClick={(e) => !activity.prospect?.phone && e.preventDefault()}
                                        className={cn(
                                            "transition-colors",
                                            activity.prospect?.phone 
                                                ? "text-foreground/80 hover:text-foreground" 
                                                : "text-muted-foreground/40 cursor-not-allowed"
                                        )}
                                         title={activity.prospect?.phone || 'No hay teléfono'}
                                    >
                                        <Phone className="h-5 w-5" />
                                    </a>
                                    <div className={cn(
                                        "flex items-center gap-1.5 text-xs ml-auto",
                                        activity.prospect?.language ? "text-muted-foreground" : "text-muted-foreground/40"
                                    )}>
                                        <Globe className="h-4 w-4" />
                                        <span>{activity.prospect?.language || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-1 sm:gap-2">
                                <Checkbox
                                    id={`activity-${activity.id}`}
                                    checked={activity.completed}
                                    onCheckedChange={(checked) => handleToggleActivityComplete(activity, !!checked)}
                                    className="h-5 w-5"
                                />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => handleEditActivityClick(activity)}>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleDeleteActivityClick(activity)} className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Eliminar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                      );
                    })}
                  </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/50">
            <h3 className="text-lg font-semibold">¡Todo al día!</h3>
            <p className="text-muted-foreground mt-1">No se encontraron seguimientos pendientes.</p>
          </div>
        )}
      </div>

       <ClientTimelineDialog 
        open={isTimelineOpen}
        onOpenChange={setIsTimelineOpen}
        leadId={timelineLeadId}
       />

       {currentProspect && (
            <FollowUpDialog
                open={isFollowUpDialogOpen}
                onOpenChange={(isOpen) => {
                    if (!isOpen) {
                        setCurrentActivity(null);
                        setCurrentProspect(null);
                    }
                    setIsFollowUpDialogOpen(isOpen);
                }}
                onConfirm={handleFollowUpSubmit}
                isSubmitting={isSubmitting}
                prospect={currentProspect}
                activity={currentActivity}
            />
        )}
        <CompleteFollowUpDialog
            open={isCompleteDialogOpen}
            onOpenChange={(isOpen) => {
                if (!isOpen) {
                    setActivityToComplete(null);
                }
                setIsCompleteDialogOpen(isOpen);
            }}
            onConfirm={handleCompletionConfirm}
            isSubmitting={isSubmitting}
            activity={activityToComplete}
        />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el registro de seguimiento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteActivityConfirm} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
              {isSubmitting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
