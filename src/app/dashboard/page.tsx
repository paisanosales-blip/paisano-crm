'use client';

import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Target, UserCheck, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';
import { getClassification } from '@/lib/types';


export default function DashboardPage() {
    const { user, isUserLoading: isUserAuthLoading } = useUser();
    const firestore = useFirestore();

    const activeUserId = user?.uid;

    const opportunitiesQuery = useMemoFirebase(() => {
        if (!activeUserId) return null;
        return query(collection(firestore, 'opportunities'), where('sellerId', '==', activeUserId));
    }, [firestore, activeUserId]);

    const { data: opportunities, isLoading: areOppsLoading } = useCollection(opportunitiesQuery);
    
    const isLoading = isUserAuthLoading || areOppsLoading;

    const dashboardStats = React.useMemo(() => {
        if (!opportunities) {
            return {
                prospectosActivos: 0,
                clientesPotenciales: 0,
                clientesGanados: 0,
                tasaDeConversion: 0,
                ingresosTotales: 0,
            };
        }
        
        let prospectosActivos = 0;
        let clientesPotenciales = 0;
        let clientesGanados = 0;
        let ingresosTotales = 0;
        
        (opportunities as any[]).forEach(opp => {
            const classification = getClassification(opp.stage);
            switch (classification) {
                case 'PROSPECTO':
                    prospectosActivos++;
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

        const totalOportunidades = opportunities.length;
        const tasaDeConversion = totalOportunidades > 0 ? (clientesGanados / totalOportunidades) * 100 : 0;

        return {
            prospectosActivos,
            clientesPotenciales,
            clientesGanados,
            tasaDeConversion: parseFloat(tasaDeConversion.toFixed(1)),
            ingresosTotales,
        };
    }, [opportunities]);

    return (
        <div className="grid gap-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-headline font-bold">Panel de Estadísticas</h1>
            </div>
            {isLoading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                    {Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Prospectos Activos</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.prospectosActivos}</div>
                            <p className="text-xs text-muted-foreground">En contacto o informados</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Clientes Potenciales</CardTitle>
                            <Target className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.clientesPotenciales}</div>
                            <p className="text-xs text-muted-foreground">Con cotización o en negociación</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.tasaDeConversion}%</div>
                            <p className="text-xs text-muted-foreground">De prospectos a clientes</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Nuevos Clientes</CardTitle>
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">+{dashboardStats.clientesGanados}</div>
                            <p className="text-xs text-muted-foreground">Oportunidades ganadas</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dashboardStats.ingresosTotales)}</div>
                            <p className="text-xs text-muted-foreground">De ventas cerradas</p>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
