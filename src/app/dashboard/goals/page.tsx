'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { startOfWeek, endOfWeek, isWithinInterval, format, subMonths, addMonths, startOfMonth, endOfMonth } from 'date-fns';
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
const MONTHLY_POTENTIAL_CLIENTS_GOAL = 4;

export default function GoalsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
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

  // --- Weekly Goal Calculation ---
  const weeklyProgress = React.useMemo(() => {
    if (!allOpportunities) {
      return { count: 0, percentage: 0 };
    }
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const end = endOfWeek(today, { weekStartsOn: 1 });

    const prospectsThisWeek = allOpportunities.filter(opp => {
      if (!opp.createdDate) return false;
      const createdDate = new Date(opp.createdDate);
      return isWithinInterval(createdDate, { start, end });
    });

    const count = prospectsThisWeek.length;
    const percentage = Math.min((count / WEEKLY_GOAL) * 100, 100);

    return { count, percentage };
  }, [allOpportunities]);
  
    // --- Monthly Potential Clients Goal Calculation ---
  const monthlyPotentialClientsProgress = React.useMemo(() => {
    if (!allOpportunities) {
      return { count: 0, percentage: 0 };
    }
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    // Filter opportunities created within the current month
    const opportunitiesInMonth = (allOpportunities || []).filter(item => {
        if (!item.createdDate) return false;
        const itemDate = new Date(item.createdDate);
        return isWithinInterval(itemDate, { start, end });
    });

    // From those, filter the ones that are "potential clients"
    const potentialClientsThisMonth = opportunitiesInMonth.filter(opp => {
        const classification = getClassification(opp.stage);
        return classification === 'CLIENTE POTENCIAL';
    });

    const count = potentialClientsThisMonth.length;
    const percentage = Math.min((count / MONTHLY_POTENTIAL_CLIENTS_GOAL) * 100, 100);

    return { count, percentage };
  }, [allOpportunities, currentMonth]);
  
  // --- Monthly Stats Calculation for Coach ---
  const monthlyStats = useMemo(() => {
    if (!allOpportunities || !allLeads || !allQuotations) {
        return {
            prospectosActivos: 0,
            clientesPotenciales: 0,
            clientesGanados: 0,
            tasaDeConversion: 0,
            ingresosTotales: 0,
        };
    }
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const opportunitiesCreatedInMonth = allOpportunities.filter(item => {
        const itemDate = new Date(item.createdDate);
        return isWithinInterval(itemDate, { start, end });
    });

    const opportunitiesClosedInMonth = allOpportunities.filter(item => {
        if (!item.closingDate || item.stage !== 'Cierre de venta') return false;
        const itemDate = new Date(item.closingDate);
        return isWithinInterval(itemDate, { start, end });
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
  }, [allOpportunities, allLeads, allQuotations, currentMonth]);

  const getMotivationalMessage = () => {
    if (weeklyProgress.percentage === 100) {
      return {
        title: '¡Meta Cumplida!',
        message: '¡Felicidades! Has alcanzado tu meta semanal de 10 nuevos prospectos. ¡Sigue así y prepárate para superar nuevos récords!',
        icon: <Award className="h-8 w-8 text-yellow-500" />,
      };
    }
    if (weeklyProgress.count === 0) {
      return {
        title: '¡Empecemos la semana con todo!',
        message: 'Tu meta es generar 10 nuevos prospectos. ¡Cada llamada, cada correo, cada contacto cuenta! Vamos por el primero.',
        icon: <TrendingUp className="h-8 w-8 text-blue-500" />,
      };
    }
    if (weeklyProgress.count < 5) {
      return {
        title: '¡Buen comienzo!',
        message: `Ya tienes ${weeklyProgress.count} prospectos. Estás en el camino correcto. ¡No pierdas el impulso y sigue adelante!`,
        icon: <TrendingUp className="h-8 w-8 text-blue-500" />,
      };
    }
    return {
      title: '¡Ya casi lo logras!',
      message: `¡Excelente trabajo! Con ${weeklyProgress.count} prospectos, estás muy cerca de tu meta. Un último esfuerzo y lo conseguirás.`,
      icon: <Target className="h-8 w-8 text-green-500" />,
    };
  };
  const motivational = getMotivationalMessage();

  const getPotentialClientMotivationalMessage = () => {
    const { count, percentage } = monthlyPotentialClientsProgress;
    if (percentage >= 100) {
      return {
        title: '¡Meta Mensual Alcanzada!',
        message: `¡Felicidades! Has convertido ${count} prospectos en clientes potenciales este mes.`,
        icon: <Award className="h-8 w-8 text-yellow-500" />,
      };
    }
    if (count === 0) {
      return {
        title: '¡Impulsa tus prospectos!',
        message: 'Tu meta es calificar 4 prospectos a clientes potenciales. ¡Una buena cotización puede ser el primer paso!',
        icon: <TrendingUp className="h-8 w-8 text-blue-500" />,
      };
    }
    return {
      title: '¡Sigue así!',
      message: `¡Buen trabajo! Con ${count} clientes potenciales, estás en camino a tu meta mensual.`,
      icon: <Target className="h-8 w-8 text-green-500" />,
    };
  };
  const potentialClientMotivational = getPotentialClientMotivationalMessage();

  const selectedUserData = useMemo(() => {
    if (selectedUserId === 'me' && userProfile) return userProfile;
    if (selectedUserId === 'all') return { firstName: 'Todos', lastName: 'los Vendedores', id: 'all' };
    return allUsers?.find((u: any) => u.id === selectedUserId);
  }, [selectedUserId, userProfile, allUsers]);

  const handleDownloadReport = () => {
    if (!selectedUserData || !allOpportunities || !allLeads || !allQuotations) {
        alert("Los datos para el reporte no están listos. Por favor, espere.");
        return;
    }
    
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    
    const opportunitiesCreatedInMonth = (allOpportunities || []).filter(item => {
        const itemDate = new Date(item.createdDate);
        return isWithinInterval(itemDate, { start, end });
    });

    const quotationsCreatedInMonth = (allQuotations || []).filter(item => {
        const itemDate = new Date(item.createdDate);
        return isWithinInterval(itemDate, { start, end });
    });
    
    const opportunitiesClosedInMonth = (allOpportunities || []).filter(item => {
        if (!item.closingDate || item.stage !== 'Cierre de venta') return false;
        const itemDate = new Date(item.closingDate);
        return isWithinInterval(itemDate, { start, end });
    });

    const opportunitiesMovedToFinancingInMonth = (allOpportunities || []).filter(item => {
        if (!item.financiamientoExternoDate || item.stage !== 'Financiamiento Externo') return false;
        const itemDate = new Date(item.financiamientoExternoDate);
        return isWithinInterval(itemDate, { start, end });
    });

    const opportunitiesDiscardedInMonth = (allOpportunities || []).filter(item => {
        if (!item.discardedDate || item.stage !== 'Descartado') return false;
        const itemDate = new Date(item.discardedDate);
        return isWithinInterval(itemDate, { start, end });
    });

    let nuevosProspectos = 0;
    let nuevosClientesPotenciales = 0;
    let prospectosNoAtendidos = 0;
    
    opportunitiesCreatedInMonth.forEach((opp: any) => {
        const classification = getClassification(opp.stage);
        switch (classification) {
            case 'PROSPECTO':
                nuevosProspectos++;
                if (opp.stage === 'Primer contacto') {
                    prospectosNoAtendidos++;
                }
                break;
            case 'CLIENTE POTENCIAL':
                nuevosClientesPotenciales++;
                break;
        }
    });

    const clientesGanados = opportunitiesClosedInMonth.length;
    const ingresosTotales = opportunitiesClosedInMonth.reduce((acc: number, opp: any) => acc + (opp.value || 0), 0);
    
    const totalNewOpportunities = opportunitiesCreatedInMonth.length;
    const tasaDeConversion = totalNewOpportunities > 0 ? (clientesGanados / totalNewOpportunities) * 100 : 0;
    
    const localMonthlyStats = {
        prospectosActivos: nuevosProspectos,
        clientesPotenciales: nuevosClientesPotenciales,
        clientesGanados,
        tasaDeConversion: parseFloat(tasaDeConversion.toFixed(1)),
        ingresosTotales,
        clientesNoAtendidos: prospectosNoAtendidos,
        cotizacionesHechas: quotationsCreatedInMonth.length,
        clientesEnFinanciamiento: opportunitiesMovedToFinancingInMonth.length,
        prospectosDescartados: opportunitiesDiscardedInMonth.length,
    };

    const csvRows = [];
    const EOL = "\r\n";

    const formatCell = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const formatRow = (row: any[]) => row.map(formatCell).join(',');
    
    csvRows.push(formatRow(["REPORTE DE RENDIMIENTO - PAISANO TRAILER"]));
    csvRows.push(formatRow(["Mes:", format(currentMonth, "MMMM yyyy", { locale: es })]));
    csvRows.push(formatRow(["Vendedor:", `${selectedUserData.firstName} ${selectedUserData.lastName}`]));
    csvRows.push("");

    csvRows.push(formatRow(["RESUMEN DEL MES"]));
    csvRows.push(formatRow(["Métrica", "Valor"]));
    csvRows.push(formatRow(["Nuevos Prospectos (Oportunidades Creadas)", localMonthlyStats.prospectosActivos]));
    csvRows.push(formatRow(["Nuevos Clientes Potenciales", localMonthlyStats.clientesPotenciales]));
    csvRows.push(formatRow(["Nuevos Clientes (Ganados)", localMonthlyStats.clientesGanados]));
    csvRows.push(formatRow(["Ingresos del Mes (USD)", new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(localMonthlyStats.ingresosTotales)]));
    csvRows.push(formatRow(["Tasa de Conversión (%)", localMonthlyStats.tasaDeConversion]));
    csvRows.push(formatRow(["Cotizaciones Hechas", localMonthlyStats.cotizacionesHechas]));
    csvRows.push(formatRow(["Prospectos No Atendidos", localMonthlyStats.clientesNoAtendidos]));
    csvRows.push(formatRow(["Clientes en Financiamiento", localMonthlyStats.clientesEnFinanciamiento]));
    csvRows.push(formatRow(["Prospectos Descartados", localMonthlyStats.prospectosDescartados]));
    csvRows.push("");

    csvRows.push(formatRow(["META SEMANAL (Semana Actual)"]));
    csvRows.push(formatRow(["Métrica", "Valor"]));
    csvRows.push(formatRow(["Meta de Prospectos", WEEKLY_GOAL]));
    csvRows.push(formatRow(["Prospectos Generados", weeklyProgress.count]));
    csvRows.push(formatRow(["Progreso (%)", weeklyProgress.percentage]));
    csvRows.push("");
    
    const leadsMap = new Map((allLeads || []).map(lead => [lead.id, lead]));
    csvRows.push(formatRow(["DETALLE DE OPORTUNIDADES DEL MES"]));
    csvRows.push(formatRow(["Cliente", "Nombre Oportunidad", "Etapa", "Valor", "Moneda", "Fecha de Cierre Prevista", "Fecha de Creación"]));
    opportunitiesCreatedInMonth.forEach((opp: any) => {
      const lead = leadsMap.get(opp.leadId);
      csvRows.push(formatRow([
        lead?.clientName || 'N/A',
        opp.name,
        opp.stage,
        opp.value,
        opp.currency,
        format(new Date(opp.expectedCloseDate), "yyyy-MM-dd"),
        format(new Date(opp.createdDate), "yyyy-MM-dd")
      ]));
    });
    csvRows.push("");
    
    csvRows.push(formatRow(["DETALLE DE OPORTUNIDADES DESCARTADAS DEL MES"]));
    csvRows.push(formatRow(["Cliente", "Nombre Oportunidad", "Motivo del Descarte", "Fecha de Descarte"]));
    opportunitiesDiscardedInMonth.forEach((opp: any) => {
        const lead = leadsMap.get(opp.leadId);
        csvRows.push(formatRow([
            lead?.clientName || 'N/A',
            opp.name,
            opp.discardReason || 'Sin motivo',
            format(new Date(opp.discardedDate), "yyyy-MM-dd")
        ]));
    });

    const csvContent = csvRows.join(EOL);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const fileName = `Reporte_${format(currentMonth, "yyyy_MM")}_${selectedUserData.firstName}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <div className="grid gap-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-headline font-bold">Metas y Reportes</h1>
        <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row">
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
            <Button onClick={handleDownloadReport} variant="outline" disabled={isLoading} className="w-full sm:w-auto">
                <FileDown className="mr-2 h-4 w-4" />
                Descargar Reporte
            </Button>
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
                Meta Semanal: 10 Nuevos Prospectos
            </CardTitle>
            <CardDescription>
                Tu progreso para la semana actual. La semana comienza el lunes.
            </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
            {isLoading ? (
                <div className="space-y-4">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                </div>
            ) : (
                <div className="flex items-center gap-6 p-6 rounded-lg bg-muted/50">
                <div className="shrink-0">{motivational.icon}</div>
                <div>
                    <h3 className="text-lg font-semibold">{motivational.title}</h3>
                    <p className="text-muted-foreground">{motivational.message}</p>
                </div>
                </div>
            )}
            
            <div className="space-y-2">
                <div className="flex justify-between items-center font-bold text-lg">
                    <p>Progreso:</p>
                    <p>{weeklyProgress.count} / {WEEKLY_GOAL}</p>
                </div>
                <Progress value={weeklyProgress.percentage} className="h-4" />
            </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Target className="h-6 w-6 text-blue-500" />
                    Meta Mensual: 4 Clientes Potenciales
                </CardTitle>
                <CardDescription>
                    Prospectos movidos a "Cotización" o "Negociación" este mes.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-8 w-1/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                </div>
            ) : (
                <div className="flex items-center gap-6 p-6 rounded-lg bg-muted/50">
                    <div className="shrink-0">{potentialClientMotivational.icon}</div>
                    <div>
                        <h3 className="text-lg font-semibold">{potentialClientMotivational.title}</h3>
                        <p className="text-muted-foreground">{potentialClientMotivational.message}</p>
                    </div>
                </div>
            )}
            
            <div className="space-y-2">
                <div className="flex justify-between items-center font-bold text-lg">
                    <p>Progreso:</p>
                    <p>{monthlyPotentialClientsProgress.count} / {MONTHLY_POTENTIAL_CLIENTS_GOAL}</p>
                </div>
                <Progress value={monthlyPotentialClientsProgress.percentage} className="h-4" />
            </div>
            </CardContent>
        </Card>
      </div>
      
       <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <CardTitle>Análisis Mensual de Rendimiento</CardTitle>
                    <CardDescription className="mt-1">
                        Tu rendimiento de generación de prospectos semana a semana.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-lg font-semibold w-40 text-center capitalize">
                        {format(currentMonth, 'MMMM yyyy', { locale: es })}
                    </span>
                    <Button variant="outline" size="icon" onClick={handleNextMonth} disabled={endOfMonth(currentMonth) > new Date()}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <WeeklyProspectsChart 
                opportunities={allOpportunities}
                currentMonth={currentMonth}
                isLoading={isLoading}
            />
        </CardContent>
      </Card>
      
      {!isLoading && selectedUserData && (
        <SalesCoachAnalysis
          userName={selectedUserData.firstName}
          monthlyStats={monthlyStats}
          weeklyProgress={weeklyProgress}
          weeklyGoal={WEEKLY_GOAL}
          monthlyGoal={MONTHLY_POTENTIAL_CLIENTS_GOAL}
        />
      )}
    </div>
  );
}
