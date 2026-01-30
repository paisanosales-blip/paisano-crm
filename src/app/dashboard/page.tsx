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
import { Users, TrendingUp, UserCheck, Target } from 'lucide-react';
import { DashboardCharts } from '@/components/dashboard-charts';
import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';

export default function DashboardPage() {
    const { user, isUserLoading: isUserAuthLoading } = useUser();
    const firestore = useFirestore();

    const userProfileRef = useMemoFirebase(() => {
        if (!user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);
    
    // Fetch opportunities
    const opportunitiesQuery = useMemoFirebase(() => {
        if (!user || !userProfile) return null;
        if (userProfile.role?.toLowerCase() === 'admin' || userProfile.role?.toLowerCase() === 'manager') {
            return query(collection(firestore, 'opportunities'));
        }
        return query(collection(firestore, 'opportunities'), where('sellerId', '==', user.uid));
    }, [firestore, user, userProfile]);
    const { data: opportunities, isLoading: areOppsLoading } = useCollection(opportunitiesQuery);
    
    // Fetch recent activities
    const activitiesQuery = useMemoFirebase(() => {
        if (!user || !userProfile) return null;
        if (userProfile.role?.toLowerCase() === 'admin' || userProfile.role?.toLowerCase() === 'manager') {
            return query(collection(firestore, 'activities'), orderBy('createdDate', 'desc'), limit(5));
        }
        return query(collection(firestore, 'activities'), where('sellerId', '==', user.uid), orderBy('createdDate', 'desc'), limit(5));
    }, [firestore, user, userProfile]);
    const { data: activities, isLoading: areActivitiesLoading } = useCollection(activitiesQuery);

    // Fetch all leads to map activities to client names
    const leadsQuery = useMemoFirebase(() => {
        if (!user || !userProfile) return null;
        if (userProfile.role?.toLowerCase() === 'admin' || userProfile.role?.toLowerCase() === 'manager') {
            return query(collection(firestore, 'leads'));
        }
        return query(collection(firestore, 'leads'), where('sellerId', '==', user.uid));
    }, [firestore, user, userProfile]);
    const { data: leads, isLoading: areLeadsLoading } = useCollection(leadsQuery);

    const isLoading = isUserAuthLoading || isProfileLoading || areOppsLoading || areActivitiesLoading || areLeadsLoading;

    const leadsMap = React.useMemo(() => {
        if (!leads) return new Map();
        return new Map((leads as any[]).map(lead => [lead.id, lead]));
    }, [leads]);

    const dashboardStats = React.useMemo(() => {
        if (!opportunities) {
            return {
                totalOpportunities: 0,
                activeProspects: 0,
                potentialClients: 0,
                closingRate: 0,
            };
        }
        
        const totalOpportunities = opportunities.length;
        const closedWon = opportunities.filter(o => o.stage === 'Cierre de venta').length;
        const activeProspects = opportunities.filter(o => o.stage === 'Primer contacto' || o.stage === 'Envió de Información').length;
        const potentialClients = opportunities.filter(o => o.stage === 'Envió de Cotización' || o.stage === 'Negociación').length;
        const closingRate = totalOpportunities > 0 ? (closedWon / totalOpportunities) * 100 : 0;

        return {
            totalOpportunities,
            activeProspects,
            potentialClients,
            closingRate: parseFloat(closingRate.toFixed(1)),
        };
    }, [opportunities]);

    return (
        <div className="grid gap-6">
            {isLoading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Oportunidades Totales</CardTitle>
                            <Target className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.totalOpportunities}</div>
                            <p className="text-xs text-muted-foreground">En tu flujo de ventas</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Prospectos Activos</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.activeProspects}</div>
                            <p className="text-xs text-muted-foreground">En contacto e información</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Clientes Potenciales</CardTitle>
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.potentialClients}</div>
                            <p className="text-xs text-muted-foreground">En cotización y negociación</p>
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
                </div>
            )}

            <DashboardCharts opportunities={opportunities as any[]} leads={leads as any[]} isLoading={isLoading}/>

            <Card>
                <CardHeader>
                    <CardTitle>Actividad Reciente</CardTitle>
                    <CardDescription>Un registro de las últimas interacciones y notas.</CardDescription>
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
