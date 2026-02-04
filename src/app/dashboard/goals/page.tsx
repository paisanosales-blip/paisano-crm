'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { startOfWeek, endOfWeek, isWithinInterval, format, subMonths, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Target, TrendingUp, Award, ArrowRight, DollarSign, UserCheck, Users, FileText, UserX, Landmark, ArchiveX, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getClassification } from '@/lib/types';
import { DashboardCharts } from '@/components/dashboard-charts';
import { LostOpportunitiesAnalysis } from '@/components/lost-opportunities-analysis';


const WEEKLY_GOAL = 10;

export default function GoalsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // --- Data Fetching ---
  const opportunitiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'opportunities'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const leadsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'leads'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const quotationsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'quotations'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: allOpportunities, isLoading: areOppsLoading } = useCollection(opportunitiesQuery);
  const { data: allLeads, isLoading: areLeadsLoading } = useCollection(leadsQuery);
  const { data: allQuotations, isLoading: areQuotsLoading } = useCollection(quotationsQuery);

  const isLoading = isUserLoading || areOppsLoading || areLeadsLoading || areQuotsLoading;

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


  // --- Monthly Report Calculation ---
  const { monthlyData } = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const opportunitiesCreatedInMonth = (allOpportunities || []).filter(item => {
        if (!item.createdDate) return false;
        const itemDate = new Date(item.createdDate);
        return isWithinInterval(itemDate, { start, end });
    });

    const quotationsCreatedInMonth = (allQuotations || []).filter(item => {
        if (!item.createdDate) return false;
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

    return {
        monthlyData: {
            opportunities: opportunitiesCreatedInMonth,
            quotations: quotationsCreatedInMonth,
            closedOpportunities: opportunitiesClosedInMonth,
            movedToFinancing: opportunitiesMovedToFinancingInMonth,
            discardedOpportunities: opportunitiesDiscardedInMonth,
        }
    }
  }, [currentMonth, allOpportunities, allQuotations]);

  const dashboardStats = React.useMemo(() => {
    const { opportunities, quotations, closedOpportunities, movedToFinancing, discardedOpportunities } = monthlyData;

    if (!opportunities || !quotations || !closedOpportunities || !movedToFinancing || !discardedOpportunities) {
        return {
            prospectosActivos: 0,
            clientesPotenciales: 0,
            clientesGanados: 0,
            tasaDeConversion: 0,
            ingresosTotales: 0,
            clientesNoAtendidos: 0,
            cotizacionesHechas: 0,
            clientesEnFinanciamiento: 0,
            prospectosDescartados: 0,
        };
    }
    
    let nuevosProspectos = 0;
    let nuevosClientesPotenciales = 0;
    let prospectosNoAtendidos = 0;
    
    opportunities.forEach((opp: any) => {
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

    const clientesGanados = closedOpportunities.length;
    const ingresosTotales = closedOpportunities.reduce((acc: number, opp: any) => acc + (opp.value || 0), 0);
    
    const totalNewOpportunities = opportunities.length;
    const tasaDeConversion = totalNewOpportunities > 0 ? (clientesGanados / totalNewOpportunities) * 100 : 0;

    return {
        prospectosActivos: nuevosProspectos,
        clientesPotenciales: nuevosClientesPotenciales,
        clientesGanados,
        tasaDeConversion: parseFloat(tasaDeConversion.toFixed(1)),
        ingresosTotales,
        clientesNoAtendidos: prospectosNoAtendidos,
        cotizacionesHechas: quotations.length,
        clientesEnFinanciamiento: movedToFinancing.length,
        prospectosDescartados: discardedOpportunities.length,
    };
  }, [monthlyData]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-bold">Mis Metas y Reportes</h1>
        <Button asChild>
          <Link href="/dashboard/pipeline">
            Ir al Flujo de Ventas <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <CardTitle>Reporte Mensual de Rendimiento</CardTitle>
                    <CardDescription className="mt-1">
                        Tus resultados, comparativas y análisis de rendimiento para el mes seleccionado.
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
            {isLoading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({length: 9}).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Nuevos Prospectos</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.prospectosActivos}</div>
                            <p className="text-xs text-muted-foreground">Oportunidades creadas en el mes.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Nuevos Clientes Potenciales</CardTitle>
                            <Target className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.clientesPotenciales}</div>
                            <p className="text-xs text-muted-foreground">Nuevas oportunidades en cotización o negociación.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Nuevos Clientes</CardTitle>
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">+{dashboardStats.clientesGanados}</div>
                            <p className="text-xs text-muted-foreground">Oportunidades cerradas como ganadas en el mes.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dashboardStats.ingresosTotales)}</div>
                            <p className="text-xs text-muted-foreground">De oportunidades cerradas en el mes.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.tasaDeConversion}%</div>
                            <p className="text-xs text-muted-foreground">Nuevos clientes / Nuevas oportunidades del mes.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Cotizaciones Hechas</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.cotizacionesHechas}</div>
                            <p className="text-xs text-muted-foreground">Generadas este mes.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Prospectos No Atendidos</CardTitle>
                            <UserX className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.clientesNoAtendidos}</div>
                            <p className="text-xs text-muted-foreground">Nuevas oportunidades que siguen en 'Primer contacto'.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Financiamiento Externo</CardTitle>
                            <Landmark className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.clientesEnFinanciamiento}</div>
                            <p className="text-xs text-muted-foreground">Movidos a financiamiento este mes.</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Prospectos Descartados</CardTitle>
                            <ArchiveX className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.prospectosDescartados}</div>
                            <p className="text-xs text-muted-foreground">Prospectos marcados como perdidos en el mes.</p>
                        </CardContent>
                    </Card>
                </div>
            )}
             <div className="grid gap-6 mt-4">
                <DashboardCharts opportunities={allOpportunities} leads={allLeads} isLoading={isLoading} />
                {!isLoading && (
                  <LostOpportunitiesAnalysis discardedOpportunities={monthlyData.discardedOpportunities} />
                )}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
