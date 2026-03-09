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
import { TrendingUp, DollarSign, Target, UserCheck, Users, FileText, UserX, Landmark, ArchiveX, FileDown, ShieldCheck, ShieldOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { getClassification } from '@/lib/types';
import { DashboardCharts } from '@/components/dashboard-charts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';

export default function DashboardPage() {
    const { user, isUserLoading: isUserAuthLoading } = useUser();
    const firestore = useFirestore();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedUserId, setSelectedUserId] = useState<string>('me');
    const [reportType, setReportType] = useState<'monthly' | 'weekly'>('monthly');

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

    const activitiesQuery = useMemoFirebase(() => {
        if (!activeUserId) return null;
        const baseCollection = collection(firestore, 'activities');
        if (activeUserId === 'all') {
            return query(baseCollection);
        }
        return query(baseCollection, where('sellerId', '==', activeUserId));
    }, [firestore, activeUserId]);

    const { data: allOpportunities, isLoading: areOppsLoading } = useCollection(opportunitiesQuery);
    const { data: allLeads, isLoading: areLeadsLoading } = useCollection(leadsQuery);
    const { data: allQuotations, isLoading: areQuotsLoading } = useCollection(quotationsQuery);
    const { data: allActivities, isLoading: areActivitiesLoading } = useCollection(activitiesQuery);
    
    const isLoading = isUserAuthLoading || areOppsLoading || areLeadsLoading || areQuotsLoading || areUsersLoading || areActivitiesLoading;

    const { periodData } = useMemo(() => {
        const isWeekly = reportType === 'weekly';
        const reportDate = isWeekly ? new Date() : currentMonth;
        const start = isWeekly ? startOfWeek(reportDate, { weekStartsOn: 1 }) : startOfMonth(reportDate);
        const end = isWeekly ? endOfWeek(reportDate, { weekStartsOn: 1 }) : endOfMonth(reportDate);

        const opportunitiesCreatedInPeriod = (allOpportunities || []).filter(item => {
            const itemDate = new Date(item.createdDate);
            return isWithinInterval(itemDate, { start, end });
        });

        const quotationsCreatedInPeriod = (allQuotations || []).filter(item => {
            const itemDate = new Date(item.createdDate);
            return isWithinInterval(itemDate, { start, end });
        });
        
        const opportunitiesClosedInPeriod = (allOpportunities || []).filter(item => {
            if (!item.closingDate || item.stage !== 'Cierre de venta') return false;
            const itemDate = new Date(item.closingDate);
            return isWithinInterval(itemDate, { start, end });
        });

        const opportunitiesInFinancingInPeriod = (allOpportunities || []).filter(item => {
            if (item.stage !== 'Financiamiento Externo') return false;
            const dateToCheck = item.financiamientoExternoDate;
            if (!dateToCheck) return false;
            const itemDate = new Date(dateToCheck);
            return isWithinInterval(itemDate, { start, end });
        });

        const opportunitiesDiscardedInPeriod = (allOpportunities || []).filter(item => {
            if (!item.discardedDate || item.stage !== 'Descartado') return false;
            const itemDate = new Date(item.discardedDate);
            return isWithinInterval(itemDate, { start, end });
        });

        return {
            periodData: {
                opportunities: opportunitiesCreatedInPeriod,
                quotations: quotationsCreatedInPeriod,
                closedOpportunities: opportunitiesClosedInPeriod,
                opportunitiesInFinancing: opportunitiesInFinancingInPeriod,
                discardedOpportunities: opportunitiesDiscardedInPeriod,
            }
        }

    }, [currentMonth, allOpportunities, allQuotations, reportType]);

    const dashboardStats = React.useMemo(() => {
        const { opportunities, quotations, closedOpportunities, opportunitiesInFinancing, discardedOpportunities } = periodData;

        const emptyStats = {
            totalProspectosRegistrados: 0,
            prospectosActivos: 0,
            clientesPotenciales: 0,
            clientesGanados: 0,
            tasaDeConversion: 0,
            ingresosTotalesUSD: 0,
            ingresosTotalesMXN: 0,
            clientesNoAtendidos: 0,
            cotizacionesHechas: 0,
            clientesEnFinanciamiento: 0,
            financingApproved: 0,
            prospectosDescartados: 0,
        };
        
        if (!allOpportunities || !opportunities || !quotations || !closedOpportunities || !opportunitiesInFinancing || !discardedOpportunities || !allQuotations) {
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
            totalProspectosRegistrados: allOpportunities.length,
            prospectosActivos: nuevosProspectos,
            clientesPotenciales: nuevosClientesPotenciales,
            clientesGanados,
            tasaDeConversion: parseFloat(tasaDeConversion.toFixed(1)),
            ingresosTotalesUSD: revenue.usd,
            ingresosTotalesMXN: revenue.mxn,
            clientesNoAtendidos: prospectosNoAtendidos,
            cotizacionesHechas: quotations.length,
            clientesEnFinanciamiento: opportunitiesInFinancing.length,
            financingApproved: opportunitiesInFinancing.filter(opp => opp.financingStatus === 'Aprobado').length,
            prospectosDescartados: discardedOpportunities.length,
        };
    }, [periodData, allQuotations, allOpportunities]);
    
    const selectedUserData = useMemo(() => {
        if (!allUsers || !user) return null;
        const currentUserProfile = allUsers.find((u: any) => u.id === user.uid);
        if (selectedUserId === 'me') return currentUserProfile;
        if (selectedUserId === 'all') return { firstName: 'Todos', lastName: 'los Vendedores', id: 'all' };
        return allUsers.find((u: any) => u.id === selectedUserId);
    }, [selectedUserId, user, allUsers]);

    const handleDownloadReport = () => {
        if (!selectedUserData || isLoading) {
            alert("Los datos para el reporte no están listos. Por favor, espere.");
            return;
        }

        const isWeekly = reportType === 'weekly';
        const reportDate = isWeekly ? new Date() : currentMonth;
        const start = isWeekly ? startOfWeek(reportDate, { weekStartsOn: 1 }) : startOfMonth(reportDate);
        const end = isWeekly ? endOfWeek(reportDate, { weekStartsOn: 1 }) : endOfMonth(reportDate);
        
        const { opportunities, discardedOpportunities } = periodData;

        const csvRows = [];
        const EOL = "\r\n";

        const formatCell = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const formatRow = (row: any[]) => row.map(formatCell).join(',');
        
        csvRows.push(formatRow(["REPORTE DE RENDIMIENTO - PAISANO TRAILER"]));
        if (isWeekly) {
            csvRows.push(formatRow(["Semana:", `${format(start, "dd MMM yyyy", { locale: es })} - ${format(end, "dd MMM yyyy", { locale: es })}`]));
        } else {
            csvRows.push(formatRow(["Mes:", format(currentMonth, "MMMM yyyy", { locale: es })]));
        }
        csvRows.push(formatRow(["Vendedor:", `${selectedUserData.firstName} ${selectedUserData.lastName}`]));
        csvRows.push("");

        csvRows.push(formatRow(["RESUMEN DEL PERIODO"]));
        csvRows.push(formatRow(["Métrica", "Valor"]));
        csvRows.push(formatRow(["Nuevos Prospectos (Oportunidades Creadas)", dashboardStats.prospectosActivos]));
        csvRows.push(formatRow(["Nuevos Clientes Potenciales", dashboardStats.clientesPotenciales]));
        csvRows.push(formatRow(["Nuevos Clientes (Ganados)", dashboardStats.clientesGanados]));
        csvRows.push(formatRow(["Ingresos del Periodo (USD)", new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dashboardStats.ingresosTotalesUSD)]));
        csvRows.push(formatRow(["Ingresos del Periodo (MXN)", new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(dashboardStats.ingresosTotalesMXN)]));
        csvRows.push(formatRow(["Tasa de Conversión (%)", dashboardStats.tasaDeConversion]));
        csvRows.push(formatRow(["Cotizaciones Hechas", dashboardStats.cotizacionesHechas]));
        csvRows.push(formatRow(["Prospectos No Atendidos", dashboardStats.clientesNoAtendidos]));
        csvRows.push(formatRow(["Clientes en Financiamiento", dashboardStats.clientesEnFinanciamiento]));
        csvRows.push(formatRow(["Prospectos Descartados", dashboardStats.prospectosDescartados]));
        csvRows.push("");

        const leadsMap = new Map((allLeads || []).map(lead => [lead.id, lead]));
        csvRows.push(formatRow(["DETALLE DE OPORTUNIDADES DEL PERIODO"]));
        csvRows.push(formatRow(["Cliente", "Nombre Oportunidad", "Etapa", "Valor", "Moneda", "Fecha de Cierre Prevista", "Fecha de Creación"]));
        opportunities.forEach((opp: any) => {
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
        
        csvRows.push(formatRow(["DETALLE DE OPORTUNIDADES DESCARTADAS DEL PERIODO"]));
        csvRows.push(formatRow(["Cliente", "Nombre Oportunidad", "Motivo del Descarte", "Fecha de Descarte"]));
        discardedOpportunities.forEach((opp: any) => {
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
        const fileName = `Reporte_Panel_${isWeekly ? 'Semanal' : 'Mensual'}_${selectedUserData.firstName}.csv`;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    return (
        <div className="grid gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-headline font-bold">Panel de Estadísticas</h1>
                 <div className="flex flex-wrap items-center gap-4">
                     <Select onValueChange={setSelectedUserId} value={selectedUserId} disabled={isLoading}>
                        <SelectTrigger className="w-full sm:w-[220px]">
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
                     <Button onClick={handleDownloadReport} variant="outline" disabled={isLoading}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Descargar Reporte
                    </Button>
                    <div className="flex items-center gap-2">
                        <Select onValueChange={(value) => setReportType(value as 'monthly' | 'weekly')} value={reportType}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="monthly">Mensual</SelectItem>
                                <SelectItem value="weekly">Semanal</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" onClick={handlePrevMonth} disabled={reportType === 'weekly'}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-lg font-semibold w-40 text-center capitalize">
                            {reportType === 'monthly'
                                ? format(currentMonth, 'MMMM yyyy', { locale: es })
                                : 'Semana Actual'
                            }
                        </span>
                        <Button variant="outline" size="icon" onClick={handleNextMonth} disabled={reportType === 'weekly' || endOfMonth(currentMonth) >= endOfMonth(new Date())}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
            {isLoading ? (
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
                    {Array.from({length: 11}).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
            ) : (
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
                    <Card className="bg-muted/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                            <CardTitle className="text-xs font-medium">Total Prospectos</CardTitle>
                            <Users className="h-4 w-4 text-slate-500" />
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                            <div className="text-lg font-bold">{dashboardStats.totalProspectosRegistrados}</div>
                        </CardContent>
                    </Card>
                     <Card className="bg-muted/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                            <CardTitle className="text-xs font-medium">Nuevos ({reportType === 'monthly' ? 'Mes' : 'Semana'})</CardTitle>
                            <Users className="h-4 w-4 text-sky-500" />
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                            <div className="text-lg font-bold">{dashboardStats.prospectosActivos}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                            <CardTitle className="text-xs font-medium">Potenciales</CardTitle>
                            <Target className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                            <div className="text-lg font-bold">{dashboardStats.clientesPotenciales}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                            <CardTitle className="text-xs font-medium">Nuevos Clientes</CardTitle>
                            <UserCheck className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                            <div className="text-lg font-bold">+{dashboardStats.clientesGanados}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                            <CardTitle className="text-xs font-medium">Ingresos Periodo</CardTitle>
                            <DollarSign className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                            <div className="text-lg font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dashboardStats.ingresosTotalesUSD)}</div>
                            <p className="text-xs text-muted-foreground -mt-1">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(dashboardStats.ingresosTotalesMXN)}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                            <CardTitle className="text-xs font-medium">Tasa Conversión</CardTitle>
                            <TrendingUp className="h-4 w-4 text-indigo-500" />
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                            <div className="text-lg font-bold">{dashboardStats.tasaDeConversion}%</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                            <CardTitle className="text-xs font-medium">Cotizaciones</CardTitle>
                            <FileText className="h-4 w-4 text-violet-500" />
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                            <div className="text-lg font-bold">{dashboardStats.cotizacionesHechas}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                            <CardTitle className="text-xs font-medium">No Atendidos</CardTitle>
                            <UserX className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                            <div className="text-lg font-bold">{dashboardStats.clientesNoAtendidos}</div>
                        </CardContent>
                    </Card>
                     <Card className="bg-muted/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                            <CardTitle className="text-xs font-medium">Financiamiento</CardTitle>
                            <Landmark className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                            <div className="text-lg font-bold">{dashboardStats.clientesEnFinanciamiento}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                            <CardTitle className="text-xs font-medium">Financiamiento Aprobado</CardTitle>
                            <ShieldCheck className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                            <div className="text-lg font-bold">{dashboardStats.financingApproved}</div>
                        </CardContent>
                    </Card>
                     <Card className="bg-muted/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                            <CardTitle className="text-xs font-medium">Descartados</CardTitle>
                            <ArchiveX className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                            <div className="text-lg font-bold">{dashboardStats.prospectosDescartados}</div>
                        </CardContent>
                    </Card>
                </div>
            )}
            <div className="grid gap-6 mt-4">
                <DashboardCharts opportunities={allOpportunities} leads={allLeads} isLoading={isLoading} currentMonth={currentMonth} />
            </div>
        </div>
    );
}
