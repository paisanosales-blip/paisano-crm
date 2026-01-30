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
  startOfDay,
  formatDistanceToNow,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, MoreVertical, Pencil, Trash2, Phone, Mail, MessageSquare, StickyNote, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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

export default function FollowUpsPage() {
  const { user, isUserLoading: isUserAuthLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedUserId, setSelectedUserId] = useState<string>('me');
  const [showCompleted, setShowCompleted] = useState(false);
  
  const [isFollowUpDialogOpen, setIsFollowUpDialogOpen] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<any | null>(null);
  const [currentClient, setCurrentClient] = useState<any | null>(null);

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
    if (!firestore) return null;
    return collection(firestore, 'leads');
  }, [firestore]);
  const { data: leads, isLoading: areLeadsLoading } = useCollection(leadsQuery);

  const isLoading = isUserAuthLoading || isProfileLoading || areUsersLoading || areActivitiesLoading || areLeadsLoading;

  const leadsMap = useMemo(() => {
    if (!leads) return new Map();
    return new Map((leads as any[]).map((l) => [l.id, l]));
  }, [leads]);

  const activityGroups = useMemo(() => {
    if (!activities) return [];
    
    const enriched = (activities as any[]).map((act) => ({
      ...act,
      clientName: leadsMap.get(act.leadId)?.clientName || 'Cliente no encontrado',
      client: leadsMap.get(act.leadId) || null,
    }));

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
    
    return [
      { title: 'Atrasados', activities: overdue.sort(sortByDate), variant: 'destructive' },
      { title: 'Hoy', activities: today.sort(sortByDate), variant: 'default' },
      { title: 'Mañana', activities: tomorrow.sort(sortByDate), variant: 'default' },
      { title: 'Esta Semana', activities: thisWeek.sort(sortByDate), variant: 'default' },
      { title: 'Próximamente', activities: upcoming.sort(sortByDate), variant: 'default' },
      { title: 'Sin Fecha', activities: noDate, variant: 'default' },
    ].filter(group => group.activities.length > 0);

  }, [activities, leadsMap, showCompleted]);
  
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
    setCurrentClient(activity.client);
    setIsFollowUpDialogOpen(true);
  };

  const handleDeleteActivityClick = (activity: any) => {
    setActivityToDelete(activity);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteActivityConfirm = () => {
    if (!activityToDelete || !firestore) return;
    const activityRef = doc(firestore, 'activities', activityToDelete.id);
    deleteDocumentNonBlocking(activityRef);
    toast({ title: 'Seguimiento eliminado' });
    setIsDeleteDialogOpen(false);
    setActivityToDelete(null);
  };
  
  const handleFollowUpSubmit = (payload: FollowUpSubmitPayload) => {
    if (!currentClient || !firestore || !user || !userProfile) return;

    setIsSubmitting(true);
    const { id, observations, nextContactDate, nextContactType, contactChannels } = payload;
    const selectedChannels = contactChannels ? Object.entries(contactChannels).filter(([, value]) => value).map(([key]) => key) : [];
    
    const activityData: any = {
        leadId: currentClient.id,
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
    setCurrentClient(null);
    setIsSubmitting(false);
  };

  const activityIcons: { [key: string]: React.ReactNode } = {
    'Llamada': <Phone className="h-4 w-4" />,
    'Correo': <Mail className="h-4 w-4" />,
    'Mensaje': <MessageSquare className="h-4 w-4" />,
    'Nota': <StickyNote className="h-4 w-4" />,
    'Reunión': <Users className="h-4 w-4" />,
  };


  return (
    <>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-headline font-bold">Seguimientos</h1>
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
          <Accordion type="multiple" defaultValue={activityGroups.map(g => g.title)} className="w-full space-y-4">
            {activityGroups.map((group) => (
              <Card key={group.title}>
                <AccordionItem value={group.title} className="border-b-0">
                  <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">
                    <div className="flex items-center gap-3">
                       <span className={cn(group.variant === 'destructive' && "text-destructive")}>{group.title}</span>
                       <Badge variant={group.variant === 'destructive' ? 'destructive' : 'secondary'}>{group.activities.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4">
                    <div className="flex flex-col gap-3">
                      {group.activities.map((activity) => {
                         const isOverdue = group.title === 'Atrasados' && !activity.completed;
                         const isTodayActivity = group.title === 'Hoy' && !activity.completed;
                         const dueDate = activity.dueDate ? new Date(activity.dueDate) : null;
                         const dateTextClass = cn({
                           'text-destructive': isOverdue,
                           'text-primary': isTodayActivity,
                           'text-muted-foreground': !isOverdue && !isTodayActivity,
                         });

                        return (
                          <div key={activity.id} className={cn("flex items-start gap-4 rounded-lg border p-3 transition-colors", activity.completed ? "bg-muted/50" : "bg-card")}>
                             <Checkbox
                                id={`activity-${activity.id}`}
                                checked={activity.completed}
                                onCheckedChange={(checked) => handleToggleActivityComplete(activity.id, !!checked)}
                                className="mt-1"
                              />
                            <div className={cn("flex-grow grid gap-1", activity.completed && "line-through text-muted-foreground")}>
                              <div className="flex items-center gap-2 text-sm">
                                {activityIcons[activity.type] || <Calendar className="h-4 w-4" />}
                                <span className="font-semibold">{activity.type}</span>
                                <span>con</span>
                                <span className="font-medium text-foreground">{activity.clientName}</span>
                              </div>
                              {activity.description && <p className="text-sm text-muted-foreground">{activity.description}</p>}
                               {dueDate && (
                                <div className={cn("flex items-center gap-1.5 text-xs font-medium", dateTextClass)}>
                                  <Calendar className="mr-1 h-3 w-3" />
                                  <span className="capitalize">
                                    {format(dueDate, "eeee dd 'de' MMMM", { locale: es })}
                                  </span>
                                  <span className="font-normal">
                                    ({formatDistanceToNow(dueDate, { locale: es, addSuffix: true })})
                                  </span>
                                </div>
                              )}
                            </div>
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
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Card>
            ))}
          </Accordion>
        ) : (
          <Card>
            <CardContent className="h-48 flex items-center justify-center">
              <p className="text-muted-foreground">No se encontraron seguimientos pendientes.</p>
            </CardContent>
          </Card>
        )}
      </div>

       {currentClient && (
            <FollowUpDialog
                open={isFollowUpDialogOpen}
                onOpenChange={(isOpen) => {
                    if (!isOpen) {
                        setCurrentActivity(null);
                        setCurrentClient(null);
                    }
                    setIsFollowUpDialogOpen(isOpen);
                }}
                onConfirm={handleFollowUpSubmit}
                isSubmitting={isSubmitting}
                prospectName={currentClient.clientName}
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
            <AlertDialogAction onClick={handleDeleteActivityConfirm} disabled={isSubmitting}>
              {isSubmitting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
