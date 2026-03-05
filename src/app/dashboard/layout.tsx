'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home, GanttChartSquare, Users, FileText, CalendarCheck, Package, ClipboardSignature, Target, Megaphone, Files, Clapperboard, Headset, Calculator } from 'lucide-react';
import { collection, query, where, doc, getDocs } from 'firebase/firestore';
import { isToday, isPast } from 'date-fns';

import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from '@/components/ui/sidebar';
import { DashboardHeader, type Notification } from '@/components/dashboard-header';
import { Skeleton } from '@/components/ui/skeleton';
import { IconSwitcher } from '@/components/icon-switcher';
import { DailySummaryDialog } from '@/components/daily-summary-dialog';
import { generateDailySummary } from '@/ai/flows/generate-daily-summary';
import type { CompletedMarketingTask } from '@/lib/types';


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const opportunitiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'opportunities'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  const { data: opportunities, isLoading: areOppsLoading } = useCollection(opportunitiesQuery);

  const activitiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'activities'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  const { data: activities, isLoading: areActivitiesLoading } = useCollection(activitiesQuery);

  const marketingPlansQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'marketingPlans');
  }, [firestore, user]);
  const { data: marketingPlans, isLoading: arePlansLoading } = useCollection<MarketingPlan>(marketingPlansQuery);
  
  useEffect(() => {
    if (user) {
      const storedIds = JSON.parse(localStorage.getItem(`readNotifications_${user.uid}`) || '[]');
      setReadNotificationIds(storedIds);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !userProfile || !firestore || areActivitiesLoading || arePlansLoading) return;

    const buildNotifications = async () => {
        const generatedNotifications: Notification[] = [];

        if (activities) {
            const overdueActivities = activities.filter(a => a.dueDate && isPast(new Date(a.dueDate)) && !isToday(new Date(a.dueDate)) && !a.completed);
            overdueActivities.forEach(act => {
                const notifId = `activity-${act.id}`;
                generatedNotifications.push({
                    id: notifId,
                    type: 'overdue_follow_up',
                    message: `Tienes un seguimiento atrasado.`,
                    link: '/dashboard/follow-ups',
                    timestamp: act.dueDate,
                    isRead: readNotificationIds.includes(notifId)
                });
            });
        }

        if (marketingPlans) {
            for (const plan of marketingPlans) {
                try {
                    const tasksSnapshot = await getDocs(collection(firestore, 'marketingPlans', plan.id, 'completedTasks'));
                    tasksSnapshot.forEach(taskDoc => {
                        const task = taskDoc.data() as CompletedMarketingTask;
                        
                        if (userProfile.role === 'manager' && task.reviewStatus === 'Pendiente') {
                            const notifId = `task-pending-${taskDoc.id}`;
                            generatedNotifications.push({
                                id: notifId,
                                type: 'new_submission',
                                message: `${task.userName} ha completado una tarea.`,
                                link: '/dashboard/marketing',
                                timestamp: task.completedAt,
                                isRead: readNotificationIds.includes(notifId)
                            });
                        }

                        if (task.userId === user.uid) {
                            if (task.reviewStatus === 'Requiere Cambios') {
                                const notifId = `task-changes-${taskDoc.id}`;
                                generatedNotifications.push({
                                    id: notifId,
                                    type: 'changes_requested',
                                    message: `Tu tarea "${task.taskDescription.substring(0, 30)}..." requiere cambios.`,
                                    link: '/dashboard/marketing',
                                    timestamp: task.completedAt,
                                    isRead: readNotificationIds.includes(notifId)
                                });
                            } else if (task.reviewStatus === 'Aprobado' && !readNotificationIds.includes(`task-approved-${taskDoc.id}`)) {
                               const notifId = `task-approved-${taskDoc.id}`;
                                 generatedNotifications.push({
                                    id: notifId,
                                    type: 'task_approved',
                                    message: `¡Tu tarea fue aprobada!`,
                                    link: '/dashboard/marketing',
                                    timestamp: task.completedAt,
                                    isRead: readNotificationIds.includes(notifId)
                                });
                            }
                        }
                    });
                } catch (e) {
                    console.warn(`Could not fetch tasks for plan ${plan.id}:`, e);
                }
            }
        }

        generatedNotifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setNotifications(generatedNotifications);
    };

    buildNotifications();

  }, [activities, marketingPlans, user, userProfile, firestore, areActivitiesLoading, arePlansLoading, readNotificationIds]);

  const handleOpenNotifications = () => {
    if (!user) return;
    const allNotificationIds = notifications.map(n => n.id);
    const newReadIds = [...new Set([...readNotificationIds, ...allNotificationIds])];
    localStorage.setItem(`readNotifications_${user.uid}`, JSON.stringify(newReadIds));
    setReadNotificationIds(newReadIds);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/login');
    }
  }, [user, isUserLoading, router]);

  const isDataReady = !isUserLoading && !isProfileLoading && !areOppsLoading && !areActivitiesLoading;

  useEffect(() => {
    if (isDataReady && userProfile) {
      const today = new Date().toISOString().split('T')[0];
      
      const goalsRedirectKey = `goalsRedirectLastShown_${userProfile.id}`;
      const lastGoalsRedirect = localStorage.getItem(goalsRedirectKey);
      if (userProfile.role === 'seller' && lastGoalsRedirect !== today) {
        localStorage.setItem(goalsRedirectKey, today);
        router.replace('/dashboard/goals');
        return; 
      }

      const summaryKey = `dailySummaryLastShown_${userProfile.id}`;
      const lastSummaryShown = localStorage.getItem(summaryKey);

      if (lastSummaryShown !== today) {
        const fetchSummary = async () => {
          setIsSummaryOpen(true);
          setIsSummaryLoading(true);

          const todaysFollowUps = activities?.filter(a => a.dueDate && isToday(new Date(a.dueDate)) && !a.completed).length || 0;
          const overdueFollowUps = activities?.filter(a => a.dueDate && isPast(new Date(a.dueDate)) && !isToday(new Date(a.dueDate)) && !a.completed).length || 0;
          const activeOpportunitiesCount = opportunities?.filter(o => o.stage !== 'Cierre de venta' && o.stage !== 'Descartado').length || 0;
          const newLeadsCount = opportunities?.filter(o => o.stage === 'Primer contacto').length || 0;
          const closingOpportunitiesCount = opportunities?.filter(o => o.stage === 'Negociación' || o.stage === 'Cierre de venta').length || 0;

          try {
            const result = await generateDailySummary({
              userName: userProfile.firstName,
              todaysFollowUps,
              overdueFollowUps,
              activeOpportunitiesCount,
              newLeadsCount,
              closingOpportunitiesCount,
            });
            setSummaryText(result.summary);
          } catch (error) {
            console.error("Failed to generate daily summary:", error);
            setSummaryText("No se pudo cargar tu resumen diario. ¡Pero te deseamos un gran día de ventas!");
          } finally {
            setIsSummaryLoading(false);
            localStorage.setItem(summaryKey, today);
          }
        };

        fetchSummary();
      }
    }
  }, [isDataReady, userProfile, activities, opportunities, router]);

  const isLoading = isUserLoading || (user && isProfileLoading);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center justify-center gap-2">
            <IconSwitcher className="h-8 w-8" />
            <Link href="/dashboard" className="group-data-[collapsible=icon]:hidden">
              <span className="text-xl font-semibold text-white font-headline">PAISANO TRAILER</span>
            </Link>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Panel">
                <Link href="/dashboard">
                  <Home />
                  <span>Panel</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Metas">
                <Link href="/dashboard/goals">
                  <Target />
                  <span>Metas</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Flujo de Ventas">
                <Link href="/dashboard/pipeline">
                  <GanttChartSquare />
                  <span>Flujo de Ventas</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Prospectos">
                <Link href="/dashboard/clients">
                  <Users />
                  <span>Prospectos</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Cotizaciones">
                <Link href="/dashboard/quotations">
                  <FileText />
                  <span>Cotizaciones</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Plantillas">
                <Link href="/dashboard/templates">
                  <ClipboardSignature />
                  <span>Plantillas</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Seguimientos">
                <Link href="/dashboard/follow-ups">
                  <CalendarCheck />
                  <span>Seguimientos</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Productos">
                <Link href="/dashboard/products">
                  <Package />
                  <span>Productos</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Archivos">
                <Link href="/dashboard/files">
                  <Files />
                  <span>Archivos</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Marketing">
                <Link href="/dashboard/marketing">
                  <Megaphone />
                  <span>Marketing</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Presentaciones">
                <Link href="/dashboard/presentations">
                  <Clapperboard />
                  <span>Presentaciones</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Servicio al Cliente">
                <Link href="/dashboard/service">
                  <Headset />
                  <span>Servicio al Cliente</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Comisiones">
                <Link href="/dashboard/commissions">
                  <Calculator />
                  <span>Comisiones</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <DashboardHeader notifications={notifications} onOpenNotifications={handleOpenNotifications} />
        <main className="flex-1 p-4 md:p-6 bg-muted/30">{children}</main>
      </SidebarInset>
       <DailySummaryDialog
        open={isSummaryOpen}
        onOpenChange={setIsSummaryOpen}
        summary={summaryText}
        isLoading={isSummaryLoading}
        userName={userProfile?.firstName || 'vendedor'}
      />
    </SidebarProvider>
  );
}
