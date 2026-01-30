'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Target, UserCheck, Users, FileText, UserX } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { getClassification } from '@/lib/types';
import { DashboardCharts } from '@/components/dashboard-charts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DashboardPage() {
    const { user, isUserLoading: isUserAuthLoading } = useUser();
    const firestore = useFirestore();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    // Set the initial selected user to the current logged-in user
    useEffect(() => {
        if (user && !selectedUserId) {
            setSelectedUserId(user.uid);
        }
    }, [user]);

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);
    const { data: allUsers, isLoading: areUsersLoading } = useCollection(usersQuery);

    const activeUserId = selectedUserId;

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

    const { filteredOpportunities, filteredLeads, filteredQuotations } = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        
        const filterByDate = (items: any[]) => {
            if (!items) return [];
            return items.filter(item => {
                const itemDate = new Date(item.createdDate);
                return isWithinInterval(itemDate, { start, end });
            });
        };

        return {
            filteredOpportunities: filterByDate(allOpportunities || []),
            filteredLeads: filterByDate(allLeads || []),
            filteredQuotations: filterByDate(allQuotations || []),
        }

    }, [currentMonth, allOpportunities, allLeads, allQuotations]);

    const dashboardStats = React.useMemo(() => {
        if (!filteredOpportunities) {
            return {
                prospectosActivos: 0,
                clientesPotenciales: 0,
                clientesGanados: 0,
                tasaDeConversion: 0,
                ingresosTotales: 0,
                clientesNoAtendidos: 0,
                cotizacionesHechas: 0,
            };
        }
        
        let prospectosActivos = 0;
        let clientesPotenciales = 0;
        let clientesGanados = 0;
        let ingresosTotales = 0;
        let clientesNoAtendidos = 0;
        
        filteredOpportunities.forEach((opp: any) => {
            const classification = getClassification(opp.stage);
            switch (classification) {
                case 'PROSPECTO':
                    prospectosActivos++;
                    if (opp.stage === 'Primer contacto') {
                        clientesNoAtendidos++;
                    }
                    break;
                case 'CLIENTE POTENCIAL':
                    clientesPotenciales++;
                    break;
                case 'CLIENTE':
                    clientesGanados++;
                    ingresosTotales += opp.value || 0;
                    break;
            }
        });

        const totalOportunidades = filteredOpportunities.length;
        const tasaDeConversion = totalOportunidades > 0 ? (clientesGanados / totalOportunidades) * 100 : 0;

        return {
            prospectosActivos,
            clientesPotenciales,
            clientesGanados,
            tasaDeConversion: parseFloat(tasaDeConversion.toFixed(1)),
            ingresosTotales,
            clientesNoAtendidos,
            cotizacionesHechas: filteredQuotations.length,
        };
    }, [filteredOpportunities, filteredQuotations]);

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    return (
        <div className="grid gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-headline font-bold">Panel de Estadísticas</h1>
                 <div className="flex items-center gap-4">
                     <Select onValueChange={setSelectedUserId} value={selectedUserId || ''} disabled={isLoading}>
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Seleccionar usuario..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las Estadísticas</SelectItem>
                            {allUsers?.map((u: any) => (
                                <SelectItem key={u.id} value={u.id}>
                                    {u.id === user?.uid ? 'Mis Estadísticas' : `${u.firstName} ${u.lastName}`}
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
                    {Array.from({length: 7}).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Prospectos Activos</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.prospectosActivos}</div>
                            <p className="text-xs text-muted-foreground">Oportunidades en 'Primer contacto' o 'Info. Enviada'</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Clientes Potenciales</CardTitle>
                            <Target className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.clientesPotenciales}</div>
                            <p className="text-xs text-muted-foreground">Oportunidades en 'Cotización' o 'Negociación'</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Nuevos Clientes</CardTitle>
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">+{dashboardStats.clientesGanados}</div>
                            <p className="text-xs text-muted-foreground">Oportunidades en 'Cierre de venta'</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dashboardStats.ingresosTotales)}</div>
                            <p className="text-xs text-muted-foreground">De oportunidades en 'Cierre de venta'</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.tasaDeConversion}%</div>
                            <p className="text-xs text-muted-foreground">Clientes nuevos / Oportunidades totales</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Cotizaciones Hechas</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.cotizacionesHechas}</div>
                            <p className="text-xs text-muted-foreground">Generadas este mes</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Prospectos No Atendidos</CardTitle>
                            <UserX className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.clientesNoAtendidos}</div>
                            <p className="text-xs text-muted-foreground">Oportunidades en etapa 'Primer contacto'</p>
                        </CardContent>
                    </Card>
                </div>
            )}
            <div className="mt-4">
                <DashboardCharts opportunities={allOpportunities} leads={allLeads} isLoading={isLoading} />
            </div>
        </div>
    );
}
