'use client';

import {
  useUser,
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, orderBy, limit, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, FileText, DollarSign, UserX, Clock, Target } from 'lucide-react';
import { DashboardCharts } from '@/components/dashboard-charts';
import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';

export default function DashboardPage() {
    const { user, isUserLoading: isUserAuthLoading } = useUser();
    const firestore = useFirestore();

    // All queries will now be based directly on the logged-in user's ID.
    // This ensures stability and compliance with security rules.
    const activeUserId = user?.uid;

    const opportunitiesQuery = useMemoFirebase(() => {
        if (!activeUserId) return null;
        return query(collection(firestore, 'opportunities'), where('sellerId', '==', activeUserId));
    }, [firestore, activeUserId]);
    const { data: opportunities, isLoading: areOppsLoading } = useCollection(opportunitiesQuery);

    const leadsQuery = useMemoFirebase(() => {
        if (!activeUserId) return null;
        return query(collection(firestore, 'leads'), where('sellerId', '==', activeUserId));
    }, [firestore, activeUserId]);
    const { data: leads, isLoading: areLeadsLoading } = useCollection(leadsQuery);

    const quotationsQuery = useMemoFirebase(() => {
        if (!activeUserId) return null;
        return query(collection(firestore, 'quotations'), where('sellerId', '==', activeUserId));
    }, [firestore, activeUserId]);
    const { data: quotations, isLoading: areQuotsLoading } = useCollection(quotationsQuery);

    const activitiesQuery = useMemoFirebase(() => {
        if (!activeUserId) return null;
        return query(collection(firestore, 'activities'), where('sellerId', '==', activeUserId), orderBy('createdDate', 'desc'), limit(5));
    }, [firestore, activeUserId]);
    const { data: activities, isLoading: areActivitiesLoading } = useCollection(activitiesQuery);
    
    const leadsMap = React.useMemo(() => {
        if (!leads) return new Map();
        return new Map((leads as any[]).map(lead => [lead.id, lead]));
    }, [leads]);

    const isLoading = isUserAuthLoading || areOppsLoading || areLeadsLoading || areQuotsLoading || areActivitiesLoading;

    const dashboardStats = React.useMemo(() => {
        if (!opportunities || !quotations || !leads || !activities) {
            return {
                totalOpportunities: 0,
                closingRate: 0,
                generatedQuotations: 0,
                totalQuotedValue: 0,
                leadsWithoutFollowUp: 0,
                avgQuotationResponseTime: 'N/A',
            };
        }
        
        const totalOpportunities = opportunities.length;
        const closedWon = (opportunities as any[]).filter(o => o.stage === 'Cierre de venta').length;
        const closingRate = totalOpportunities > 0 ? (closedWon / totalOpportunities) * 100 : 0;
        
        const generatedQuotations = quotations.length;
        const totalQuotedValue = (quotations as any[]).reduce((sum, q) => sum + q.value, 0);

        const followedUpLeadIds = new Set((activities as any[]).map(a => a.leadId));
        const leadsWithoutFollowUp = (leads as any[]).filter(l => !followedUpLeadIds.has(l.id)).length;

        const opportunitiesMap = new Map((opportunities as any[]).map(o => [o.id, o]));
        const responseTimes = (quotations as any[]).map(q => {
            const opp = opportunitiesMap.get(q.opportunityId);
            if (opp && opp.infoSentDate && q.createdDate) {
                const quoteDate = new Date(q.createdDate).getTime();
                const infoDate = new Date(opp.infoSentDate).getTime();
                if (quoteDate > infoDate) {
                    return (quoteDate - infoDate) / (1000 * 60 * 60); // Time in hours
                }
            }
            return null;
        }).filter((t): t is number => t !== null);

        const avgHours = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
        const avgQuotationResponseTime = responseTimes.length > 0 ? `${avgHours.toFixed(1)} horas` : 'N/A';

        return {
            totalOpportunities,
            closingRate: parseFloat(closingRate.toFixed(1)),
            generatedQuotations,
            totalQuotedValue,
            leadsWithoutFollowUp,
            avgQuotationResponseTime,
        };
    }, [opportunities, quotations, leads, activities]);

    return (
        <div className="grid gap-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-headline font-bold">Panel de Estadísticas</h1>
            </div>
            {isLoading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({length: 6}).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Cotizaciones Generadas</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.generatedQuotations}</div>
                            <p className="text-xs text-muted-foreground">En el período seleccionado</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Valor Total Cotizado</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dashboardStats.totalQuotedValue)}</div>
                            <p className="text-xs text-muted-foreground">Suma de todas las cotizaciones</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tasa de Cierre</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.closingRate}%</div>
                            <p className="text-xs text-muted-foreground">De todas las oportunidades</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Leads sin Seguimiento</CardTitle>
                            <UserX className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.leadsWithoutFollowUp}</div>
                            <p className="text-xs text-muted-foreground">Prospectos sin actividad registrada</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tiempo Promedio de Cotización</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.avgQuotationResponseTime}</div>
                            <p className="text-xs text-muted-foreground">Desde envío de info a cotización</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Oportunidades Totales</CardTitle>
                            <Target className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.totalOpportunities}</div>
                            <p className="text-xs text-muted-foreground">En el flujo de ventas</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <DashboardCharts opportunities={opportunities as any[]} leads={leads as any[]} isLoading={isLoading}/>

            <Card>
                <CardHeader>
                    <CardTitle>Actividad Reciente</CardTitle>
                    <CardDescription>Un registro de las últimas interacciones y notas del equipo.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Vendedor</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Notas</TableHead>
                                <TableHead className="text-right">Fecha</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : activities && activities.length > 0 ? (
                                (activities as any[]).map((activity) => {
                                    const client = leadsMap.get(activity.leadId);
                                    return (
                                        <TableRow key={activity.id}>
                                            <TableCell className="font-medium">{client?.clientName || 'No disponible'}</TableCell>
                                            <TableCell>{activity.sellerName}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{activity.type}</Badge>
                                            </TableCell>
                                            <TableCell className="max-w-xs truncate">{activity.description}</TableCell>
                                            <TableCell className="text-right">{new Date(activity.createdDate).toLocaleDateString()}</TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">No hay actividad reciente.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
