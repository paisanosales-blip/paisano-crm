'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { startOfWeek, endOfWeek, isWithinInterval, format, subMonths, addMonths, startOfMonth, endOfMonth, subWeeks, addWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Target, TrendingUp, Award, ArrowRight, ChevronLeft, ChevronRight, FileDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { WeeklyProspectsChart } from '@/components/weekly-prospects-chart';
import { getClassification } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SalesCoachAnalysis } from '@/components/sales-coach-analysis';


const WEEKLY_GOAL = 10;
const MONTHLY_PROSPECTS_GOAL = 40;
const MONTHLY_POTENTIAL_CLIENTS_GOAL = 4;
const WEEKLY_POTENTIAL_CLIENTS_GOAL = 1;


export default function GoalsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reportType, setReportType] = useState<'monthly' | 'weekly'>('monthly');
  const [selectedUserId, setSelectedUserId] = useState<string>('me');

  // --- Data Fetching ---
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

  const opportunitiesQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseCollection = collection(firestore, 'opportunities');
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

  const leadsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseCollection = collection(firestore, 'leads');
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

  const quotationsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseCollection = collection(firestore, 'quotations');
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


  const { data: allOpportunities, isLoading: areOppsLoading } = useCollection(opportunitiesQuery);
  const { data: allLeads, isLoading: areLeadsLoading } = useCollection(leadsQuery);
  const { data: allQuotations, isLoading: areQuotsLoading } = useCollection(quotationsQuery);

  const isLoading = isUserLoading || isProfileLoading || areOppsLoading || areLeadsLoading || areQuotsLoading || areUsersLoading;

  const { start, end } = useMemo(() => {
    return {
        start: reportType === 'weekly' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : startOfMonth(currentDate),
        end: reportType === 'weekly' ? endOfWeek(currentDate, { weekStartsOn: 1 }) : endOfMonth(currentDate)
    };
  }, [currentDate, reportType]);

  // --- Goal Calculations ---
  const newProspectsProgress = React.useMemo(() => {
    if (!allOpportunities || !allLeads) return { count: 0, percentage: 0, goal: reportType === 'weekly' ? WEEKLY_GOAL : MONTHLY_PROSPECTS_GOAL };
    
    const leadsMap = new Map((allLeads as any[]).map(l => [l.id, l]));

    const prospectsInPeriod = allOpportunities.filter(opp => {
      if (!opp.createdDate) return false;
      
      const lead = leadsMap.get(opp.leadId);
      if (lead?.isExternal) return false;

      const createdDate = new Date(opp.createdDate);
      return isWithinInterval(createdDate, { start, end });
    });

    const count = prospectsInPeriod.length;
    const goal = reportType === 'weekly' ? WEEKLY_GOAL : MONTHLY_PROSPECTS_GOAL;
    const percentage = goal > 0 ? Math.min((count / goal) * 100, 100) : 0;

    return { count, percentage, goal };
  }, [allOpportunities, allLeads, start, end, reportType]);

  const potentialClientsProgress = React.useMemo(() => {
    if (!allOpportunities || !allLeads) return { count: 0, percentage: 0, goal: reportType === 'weekly' ? WEEKLY_POTENTIAL_CLIENTS_GOAL : MONTHLY_POTENTIAL_CLIENTS_GOAL };
    
    const leadsMap = new Map((allLeads as any[]).map(l => [l.id, l]));
    
    const opportunitiesInPeriod = (allOpportunities || []).filter(item => {
        if (!item.createdDate) return false;
        const itemDate = new Date(item.createdDate);
        return isWithinInterval(itemDate, { start, end });
    });

    const potentialClientsInPeriod = opportunitiesInPeriod.filter(opp => {
        const lead = leadsMap.get(opp.leadId);
        if (lead?.isExternal) {
            return false;
        }
        const classification = getClassification(opp.stage);
        return classification === 'CLIENTE POTENCIAL';
    });

    const count = potentialClientsInPeriod.length;
    const goal = reportType === 'weekly' ? WEEKLY_POTENTIAL_CLIENTS_GOAL : MONTHLY_POTENTIAL_CLIENTS_GOAL;
    const percentage = goal > 0 ? Math.min((count / goal) * 100, 100) : 0;

    return { count, percentage, goal };
  }, [allOpportunities, allLeads, start, end, reportType]);
  
  // --- Stats for Coach (Monthly only) ---
   const currentWeeklyProgress = React.useMemo(() => {
    if (!allOpportunities || !allLeads) return { count: 0 };
    const leadsMap = new Map((allLeads as any[]).map(l => [l.id, l]));
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const prospectsThisWeek = allOpportunities.filter(opp => {
      if (!opp.createdDate) return false;
      
      const lead = leadsMap.get(opp.leadId);
      if (lead?.isExternal) return false;
      
      const createdDate = new Date(opp.createdDate);
      return isWithinInterval(createdDate, { start: weekStart, end: weekEnd });
    });
    return { count: prospectsThisWeek.length };
  }, [allOpportunities, allLeads]);

  const monthlyStats = useMemo(() => {
    if (!allOpportunities || !allLeads || !allQuotations || reportType !== 'monthly') {
        return {
            prospectosActivos: 0,
            clientesPotenciales: 0,
            clientesGanados: 0,
            tasaDeConversion: 0,
            ingresosTotales: 0,
        };
    }
    const leadsMap = new Map((allLeads as any[]).map(l => [l.id, l]));
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    const opportunitiesCreatedInMonth = allOpportunities.filter(item => {
        if (!item.createdDate) return false;
        const lead = leadsMap.get(item.leadId);
        if (lead?.isExternal) return false;
        const itemDate = new Date(item.createdDate);
        return isWithinInterval(itemDate, { start: monthStart, end: monthEnd });
    });

    const opportunitiesClosedInMonth = allOpportunities.filter(item => {
        if (!item.closingDate || item.stage !== 'Cierre de venta') return false;
        const lead = leadsMap.get(item.leadId);
        if (lead?.isExternal) return false;
        const itemDate = new Date(item.closingDate);
        return isWithinInterval(itemDate, { start: monthStart, end: monthEnd });
    });
    
    let nuevosClientesPotenciales = 0;
    opportunitiesCreatedInMonth.forEach((opp: any) => {
        if (getClassification(opp.stage) === 'CLIENTE POTENCIAL') {
            nuevosClientesPotenciales++;
        }
    });

    const clientesGanados = opportunitiesClosedInMonth.length;
    const ingresosTotales = opportunitiesClosedInMonth.reduce((acc: number, opp: any) => acc + (opp.value || 0), 0);
    const totalNewOpportunities = opportunitiesCreatedInMonth.length;
    const tasaDeConversion = totalNewOpportunities > 0 ? (clientesGanados / totalNewOpportunities) * 100 : 0;

    return {
        prospectosActivos: totalNewOpportunities,
        clientesPotenciales: nuevosClientesPotenciales,
        clientesGanados,
        tasaDeConversion: parseFloat(tasaDeConversion.toFixed(1)),
        ingresosTotales,
    };
  }, [allOpportunities, allLeads, allQuotations, currentDate, reportType]);


  const getMotivationalMessage = (progress: { count: number; percentage: number; goal: number }) => {
    if (progress.percentage >= 100) {
      return {
        title: '¡Meta Cumplida!',
        message: `¡Felicidades! Has alcanzado tu meta de ${progress.goal} nuevos prospectos. ¡Sigue así!`,
        icon: <Award className="h-8 w-8 text-yellow-500" />,
      };
    }
    if (progress.count === 0) {
      return {
        title: '¡Empecemos con todo!',
        message: `Tu meta es generar ${progress.goal} nuevos prospectos. ¡Cada contacto cuenta!`,
        icon: <TrendingUp className="h-8 w-8 text-blue-500" />,
      };
    }
    if (progress.count < progress.goal / 2) {
      return {
        title: '¡Buen comienzo!',
        message: `Ya tienes ${progress.count} prospectos. Estás en el camino correcto. ¡No pierdas el impulso!`,
        icon: <TrendingUp className="h-8 w-8 text-blue-500" />,
      };
    }
    return {
      title: '¡Ya casi lo logras!',
      message: `¡Excelente trabajo! Con ${progress.count} prospectos, estás muy cerca de tu meta. Un último esfuerzo.`,
      icon: <Target className="h-8 w-8 text-green-500" />,
    };
  };

  const getPotentialClientMotivationalMessage = (progress: { count: number; percentage: number; goal: number }) => {
    if (progress.percentage >= 100) {
      return {
        title: '¡Meta Alcanzada!',
        message: `¡Felicidades! Has convertido ${progress.count} prospectos en clientes potenciales.`,
        icon: <Award className="h-8 w-8 text-yellow-500" />,
      };
    }
    if (progress.count === 0) {
      return {
        title: '¡Impulsa tus prospectos!',
        message: `Tu meta es calificar ${progress.goal} clientes potenciales. ¡Una buena cotización puede ser el primer paso!`,
        icon: <TrendingUp className="h-8 w-8 text-blue-500" />,
      };
    }
    return {
      title: '¡Sigue así!',
      message: `¡Buen trabajo! Con ${progress.count} clientes potenciales, estás en camino a tu meta.`,
      icon: <Target className="h-8 w-8 text-green-500" />,
    };
  };
  
  const newProspectsMotivational = getMotivationalMessage(newProspectsProgress);
  const potentialClientsMotivational = getPotentialClientMotivationalMessage(potentialClientsProgress);


  const selectedUserData = useMemo(() => {
    if (selectedUserId === 'me' && userProfile) return userProfile;
    if (selectedUserId === 'all') return { firstName: 'Todos', lastName: 'los Vendedores', id: 'all' };
    return allUsers?.find((u: any) => u.id === selectedUserId);
  }, [selectedUserId, userProfile, allUsers]);

  const handleDownloadReport = () => {
    // This logic can be expanded to create a report for the selected period (weekly/monthly)
    // For now, it will use the existing monthly report logic based on the selected date.
    if (!selectedUserData || isLoading) {
        alert("Los datos para el reporte no están listos. Por favor, espere.");
        return;
    }
    
    const reportStart = startOfMonth(currentDate);
    const reportEnd = endOfMonth(currentDate);
    
    // The rest of the logic is similar to the old handleDownloadReport, but uses 'currentDate'
    // ... This is a simplified placeholder for the full CSV generation logic.
    alert(`Generando reporte para ${format(currentDate, "MMMM yyyy")}...`);
  };

  const handlePrev = () => setCurrentDate(reportType === 'monthly' ? subMonths(currentDate, 1) : subWeeks(currentDate, 1));
  const handleNext = () => setCurrentDate(reportType === 'monthly' ? addMonths(currentDate, 1) : addWeeks(currentDate, 1));
  const isNextDisabled = (reportType === 'monthly' && endOfMonth(currentDate) > new Date()) || (reportType === 'weekly' && endOfWeek(currentDate, { weekStartsOn: 1 }) > new Date());


  return (
    <div className="grid gap-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-headline font-bold">Metas y Reportes</h1>
        <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row flex-wrap">
            {userProfile?.role === 'manager' && (
              <Select onValueChange={setSelectedUserId} value={selectedUserId} disabled={isLoading}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Seleccionar vendedor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Mis Metas</SelectItem>
                  <SelectItem value="all">Todas las Metas</SelectItem>
                  {allUsers?.filter((u: any) => u.id !== user?.uid).map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {`${u.firstName} ${u.lastName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select onValueChange={(value) => setReportType(value as 'monthly' | 'weekly')} value={reportType}>
                <SelectTrigger className="w-full sm:w-[130px]">
                    <SelectValue placeholder="Periodo" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="monthly">Mensual</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePrev}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-lg font-semibold w-48 text-center capitalize">
                    {reportType === 'monthly' 
                        ? format(currentDate, 'MMMM yyyy', { locale: es })
                        : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd MMM')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'dd MMM yyyy')}`
                    }
                </span>
                <Button variant="outline" size="icon" onClick={handleNext} disabled={isNextDisabled}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            <Button asChild className="w-full sm:w-auto">
                <Link href="/dashboard/pipeline">
                    Ir al Flujo de Ventas <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Target className="h-6 w-6" />
                Meta de Nuevos Prospectos
            </CardTitle>
            <CardDescription>
                Meta del periodo: {newProspectsProgress.goal} nuevos prospectos.
            </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
            {isLoading ? (
                <div className="space-y-4"><Skeleton className="h-8 w-1/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></div>
            ) : (
                <div className="flex items-center gap-6 p-6 rounded-lg bg-muted/50">
                <div className="shrink-0">{newProspectsMotivational.icon}</div>
                <div><h3 className="text-lg font-semibold">{newProspectsMotivational.title}</h3><p className="text-muted-foreground">{newProspectsMotivational.message}</p></div>
                </div>
            )}
            
            <div className="space-y-2">
                <div className="flex justify-between items-center font-bold text-lg"><p>Progreso:</p><p>{newProspectsProgress.count} / {newProspectsProgress.goal}</p></div>
                <Progress value={newProspectsProgress.percentage} className="h-4" />
            </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Target className="h-6 w-6 text-blue-500" />
                    Meta de Clientes Potenciales
                </CardTitle>
                <CardDescription>
                    Meta del periodo: {potentialClientsProgress.goal} prospectos movidos a cotización/negociación.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
            {isLoading ? (
                <div className="space-y-4"><Skeleton className="h-8 w-1/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></div>
            ) : (
                <div className="flex items-center gap-6 p-6 rounded-lg bg-muted/50">
                    <div className="shrink-0">{potentialClientsMotivational.icon}</div>
                    <div><h3 className="text-lg font-semibold">{potentialClientsMotivational.title}</h3><p className="text-muted-foreground">{potentialClientsMotivational.message}</p></div>
                </div>
            )}
            
            <div className="space-y-2">
                <div className="flex justify-between items-center font-bold text-lg"><p>Progreso:</p><p>{potentialClientsProgress.count} / {potentialClientsProgress.goal}</p></div>
                <Progress value={potentialClientsProgress.percentage} className="h-4" />
            </div>
            </CardContent>
        </Card>
      </div>
      
       {reportType === 'monthly' && (
            <WeeklyProspectsChart 
                opportunities={allOpportunities}
                currentMonth={currentDate}
                isLoading={isLoading}
            />
       )}
      
      {reportType === 'monthly' && !isLoading && selectedUserData && (
        <SalesCoachAnalysis
          userName={selectedUserData.firstName}
          monthlyStats={monthlyStats}
          weeklyProgress={currentWeeklyProgress}
          weeklyGoal={WEEKLY_GOAL}
          monthlyGoal={MONTHLY_POTENTIAL_CLIENTS_GOAL}
        />
      )}
    </div>
  );
}
