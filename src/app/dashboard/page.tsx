'use client';

import React, { useState, useMemo } from 'react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Target, UserCheck, Users, FileText, UserX, Landmark, ArchiveX } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { getClassification } from '@/lib/types';
import { DashboardCharts } from '@/components/dashboard-charts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LostOpportunitiesAnalysis } from '@/components/lost-opportunities-analysis';

export default function DashboardPage() {
    const { user, isUserLoading: isUserAuthLoading } = useUser();
    const firestore = useFirestore();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedUserId, setSelectedUserId] = useState<string>('me');

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);
    const { data: allUsers, isLoading: areUsersLoading } = useCollection(usersQuery);

    const activeUserId = selectedUserId === 'me' ? user?.uid : selectedUserId;

    const opportunitiesQuery = useMemoFirebase(() => {
        if (!activeUserId) return null;
        const baseCollection = collection(firestore, 'opportunities');
        if (activeUserId === 'all') {
            return query(baseCollection);
        }
        return query(baseCollection, where('sellerId', '==', activeUserId));
    }, [firestore, activeUserId]);

    const leadsQuery = useMemoFirebase(() => {
        if (!activeUserId) return null;
        const baseCollection = collection(firestore, 'leads');
        if (activeUserId === 'all') {
            return query(baseCollection);
        }
        return query(baseCollection, where('sellerId', '==', activeUserId));
    }, [firestore, activeUserId]);
    
    const quotationsQuery = useMemoFirebase(() => {
        if (!activeUserId) return null;
        const baseCollection = collection(firestore, 'quotations');
        if (activeUserId === 'all') {
            return query(baseCollection);
        }
        return query(baseCollection, where('sellerId', '==', activeUserId));
    }, [firestore, activeUserId]);

    const { data: allOpportunities, isLoading: areOppsLoading } = useCollection(opportunitiesQuery);
    const { data: allLeads, isLoading: areLeadsLoading } = useCollection(leadsQuery);
    const { data: allQuotations, isLoading: areQuotsLoading } = useCollection(quotationsQuery);
    
    const isLoading = isUserAuthLoading || areOppsLoading || areLeadsLoading || areQuotsLoading || areUsersLoading;

    const { monthlyData } = useMemo(() => {
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

        const emptyStats = {
            prospectosActivos: 0,
            clientesPotenciales: 0,
            clientesGanados: 0,
            tasaDeConversion: 0,
            ingresosTotalesUSD: 0,
            ingresosTotalesMXN: 0,
            clientesNoAtendidos: 0,
            cotizacionesHechas: 0,
            clientesEnFinanciamiento: 0,
            prospectosDescartados: 0,
        };
        
        if (!opportunities || !quotations || !closedOpportunities || !movedToFinancing || !discardedOpportunities || !allQuotations) {
            return emptyStats;
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
        
        const totalNewOpportunities = opportunities.length;
        const tasaDeConversion = totalNewOpportunities > 0 ? (clientesGanados / totalNewOpportunities) * 100 : 0;

        const revenue = closedOpportunities.reduce((acc, opp) => {
            const opportunityQuotes = (allQuotations as any[])
                .filter(q => q.opportunityId === opp.id)
                .sort((a, b) => Number(b.version) - Number(a.version));

            if (opportunityQuotes.length > 0) {
                const latestQuote = opportunityQuotes[0];
                if (latestQuote.currency === 'USD') {
                    acc.usd += latestQuote.value || 0;
                } else if (latestQuote.currency === 'MXN') {
                    acc.mxn += latestQuote.value || 0;
                }
            }
            return acc;
        }, { usd: 0, mxn: 0 });


        return {
            prospectosActivos: nuevosProspectos,
            clientesPotenciales: nuevosClientesPotenciales,
            clientesGanados,
            tasaDeConversion: parseFloat(tasaDeConversion.toFixed(1)),
            ingresosTotalesUSD: revenue.usd,
            ingresosTotalesMXN: revenue.mxn,
            clientesNoAtendidos: prospectosNoAtendidos,
            cotizacionesHechas: quotations.length,
            clientesEnFinanciamiento: movedToFinancing.length,
            prospectosDescartados: discardedOpportunities.length,
        };
    }, [monthlyData, allQuotations]);


    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    return (
        <div className="grid gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-headline font-bold">Panel de Estadísticas</h1>
                 <div className="flex items-center gap-4">
                     <Select onValueChange={setSelectedUserId} value={selectedUserId} disabled={isLoading}>
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Seleccionar usuario..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="me">Mis Estadísticas</SelectItem>
                            <SelectItem value="all">Todas las Estadísticas</SelectItem>
                            {allUsers?.filter(u => u.id !== user?.uid).map((u: any) => (
                                <SelectItem key={u.id} value={u.id}>
                                    {`${u.firstName} ${u.lastName}`}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
            </div>
            {isLoading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {Array.from({length: 9}).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
                            <div className="text-2xl font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dashboardStats.ingresosTotalesUSD)}</div>
                            <p className="text-sm text-muted-foreground">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(dashboardStats.ingresosTotalesMXN)}</p>
                            <p className="text-xs text-muted-foreground mt-1">De cotizaciones que se hicieron clientes en el mes.</p>
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
        </div>
    );
}
