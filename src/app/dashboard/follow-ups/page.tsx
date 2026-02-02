'use client';

import React, { useState, useMemo } from 'react';
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
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, MoreVertical, Pencil, Trash2, Phone, Mail, MessageSquare, StickyNote, Users } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FollowUpDialog, type FollowUpSubmitPayload } from '@/components/follow-up-dialog';

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


  const isLoading = isUserAuthLoading || isProfileLoading || areUsersLoading || areActivitiesLoading || areLeadsLoading || areOppsLoading || areQuotsLoading;

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

    const filtered = showCompleted ? enriched : enriched.filter((act) => !act.completed);

    const overdue: any[] = [];
    const today: any[] = [];
    const tomorrow: any[] = [];
    const thisWeek: any[] = [];
    const upcoming: any[] = [];
    const noDate: any[] = [];

    filtered.forEach((activity) => {
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
    const sortByCreated = (a: any, b: any) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();

    return [
      { title: 'Atrasados', activities: overdue.sort(sortByDate), styleKey: 'destructive' },
      { title: 'Hoy', activities: today.sort(sortByDate), styleKey: 'primary' },
      { title: 'Mañana', activities: tomorrow.sort(sortByDate), styleKey: 'secondary' },
      { title: 'Esta Semana', activities: thisWeek.sort(sortByDate), styleKey: 'secondary' },
      { title: 'Próximamente', activities: upcoming.sort(sortByDate), styleKey: 'muted' },
      { title: 'Sin Fecha', activities: noDate.sort(sortByCreated), styleKey: 'muted' },
    ].filter(group => group.activities.length > 0);

  }, [activities, leads, opportunities, quotations, showCompleted]);
  
  const handleToggleActivityComplete = (activityId: string, completed: boolean) => {
    if (!firestore) return;
    const activityRef = doc(firestore, 'activities', activityId);
    
    updateDocumentNonBlocking(activityRef, { completed });
    toast({
      title: `Actividad ${completed ? 'Completada' : 'Pendiente'}`,
      description: 'El estado del seguimiento ha sido actualizado.',
    });
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
    const { id, observations, nextContactDate, nextContactType, contactChannels } = payload;
    const selectedChannels = contactChannels ? Object.entries(contactChannels).filter(([, value]) => value).map(([key]) => key) : [];
    
    const activityData: any = {
        leadId: currentProspect.id,
        sellerId: user.uid,
        sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
        type: nextContactType || 'Nota',
        description: observations || '',
        contactChannels: selectedChannels,
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
    'Nota': <StickyNote className="h-5 w-5" />,
    'Reunión': <Users className="h-5 w-5" />,
  };


  return (
    <>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-headline font-bold">Centro de Seguimiento</h1>
          <div className="flex items-center gap-4">
            {userProfile?.role === 'manager' && (
              <Select onValueChange={setSelectedUserId} value={selectedUserId} disabled={isLoading}>
                <SelectTrigger className="w-[220px]">
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
             <div className="flex items-center space-x-2">
                <Switch id="show-completed" checked={showCompleted} onCheckedChange={setShowCompleted} />
                <Label htmlFor="show-completed" className="text-sm">Mostrar completados</Label>
            </div>
          </div>
        </div>

        {isLoading ? (
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

                      return (
                        <div key={activity.id} className={cn(
                            "flex items-start gap-4 rounded-lg border p-4 transition-all",
                            activity.completed ? "bg-muted/50" : "bg-card hover:bg-muted/60",
                        )}>
                            <span className={cn("flex h-10 w-10 items-center justify-center rounded-full mt-1 shrink-0", groupStyleKeys[group.styleKey].icon)}>
                                {activityIcons[activity.type] || <Calendar className="h-5 w-5" />}
                            </span>

                            <div className={cn("flex-grow grid gap-1", activity.completed && "line-through text-muted-foreground")}>
                                <p className="font-semibold text-foreground">
                                    {activity.type}
                                    <span className="font-normal text-muted-foreground"> con </span> 
                                    <span className="font-medium">{activity.clientName}</span>
                                </p>
                                <p className="text-sm text-muted-foreground">{activity.description || 'Sin descripción.'}</p>
                                {dueDate && (
                                    <div className={cn("flex items-center gap-2 text-sm", groupStyleKeys[group.styleKey].date)}>
                                        <Calendar className="h-4 w-4" />
                                        <span className="font-medium capitalize">
                                            {format(dueDate, "eeee, dd MMMM", { locale: es })}
                                        </span>
                                        <span className="font-normal text-xs">
                                            ({formatDistanceToNow(dueDate, { locale: es, addSuffix: true })})
                                        </span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-1 sm:gap-2">
                                <Checkbox
                                    id={`activity-${activity.id}`}
                                    checked={activity.completed}
                                    onCheckedChange={(checked) => handleToggleActivityComplete(activity.id, !!checked)}
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
