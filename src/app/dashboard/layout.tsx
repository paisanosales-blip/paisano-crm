'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home, GanttChartSquare, Users, FileText, Shield, CalendarCheck, Package } from 'lucide-react';
import { collection, query, where, doc } from 'firebase/firestore';
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
import { DashboardHeader } from '@/components/dashboard-header';
import { Skeleton } from '@/components/ui/skeleton';
import { IconSwitcher } from '@/components/icon-switcher';
import { DailySummaryDialog } from '@/components/daily-summary-dialog';
import { generateDailySummary } from '@/ai/flows/generate-daily-summary';

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

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/login');
    }
  }, [user, isUserLoading, router]);

  const isDataReady = !isUserLoading && !isProfileLoading && !areOppsLoading && !areActivitiesLoading;

  useEffect(() => {
    if (isDataReady && userProfile) {
      const today = new Date().toISOString().split('T')[0];
      const lastShown = localStorage.getItem('dailySummaryLastShown');

      if (lastShown !== today) {
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
            localStorage.setItem('dailySummaryLastShown', today);
          }
        };

        fetchSummary();
      }
    }
  }, [isDataReady, userProfile, activities, opportunities]);

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
              <SidebarMenuButton asChild tooltip="Flujo de Ventas">
                <Link href="/dashboard/pipeline">
                  <GanttChartSquare />
                  <span>Flujo de Ventas</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Clientes">
                <Link href="/dashboard/clients">
                  <Users />
                  <span>Clientes</span>
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
             {userProfile?.role?.toLowerCase() === 'manager' && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Usuarios">
                    <Link href="/dashboard/users">
                      <Shield />
                      <span>Usuarios</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <DashboardHeader />
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
