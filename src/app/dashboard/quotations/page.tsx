'use client';

import React from 'react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, FileDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';


export default function QuotationsPage() {
    const { user, isUserLoading: isUserAuthLoading } = useUser();
    const firestore = useFirestore();

    // Query for quotations
    const quotationsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'quotations'), where('sellerId', '==', user.uid));
    }, [firestore, user]);
    const { data: quotations, isLoading: areQuotsLoading } = useCollection(quotationsQuery);

    // Query for opportunities to link quotations to leads
    const opportunitiesQuery = useMemoFirebase(() => {
        if (!user) return null;
        // Fetch all opportunities for the seller to create a map
        return query(collection(firestore, 'opportunities'), where('sellerId', '==', user.uid));
    }, [firestore, user]);
    const { data: opportunities, isLoading: areOppsLoading } = useCollection(opportunitiesQuery);

    // Query for leads to get client names
    const leadsQuery = useMemoFirebase(() => {
        if (!user) return null;
        // Fetch all leads for the seller to create a map
        return query(collection(firestore, 'leads'), where('sellerId', '==', user.uid));
    }, [firestore, user]);
    const { data: leads, isLoading: areLeadsLoading } = useCollection(leadsQuery);

    const isLoading = isUserAuthLoading || areQuotsLoading || areOppsLoading || areLeadsLoading;

    // Memoize the joined data to avoid re-computation on every render
    const enrichedQuotations = React.useMemo(() => {
        if (isLoading || !quotations || !opportunities || !leads) return [];
        
        const opportunitiesMap = new Map((opportunities as any[]).map(op => [op.id, op]));
        const leadsMap = new Map((leads as any[]).map(l => [l.id, l]));

        return (quotations as any[]).map(quote => {
            const opportunity = opportunitiesMap.get(quote.opportunityId);
            const lead = opportunity ? leadsMap.get(opportunity.leadId) : null;
            return {
                ...quote,
                clientName: lead ? lead.clientName : 'Cliente no encontrado',
            };
        }).sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());

    }, [quotations, opportunities, leads, isLoading]);

    return (
        <div className="grid gap-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-headline font-bold">Cotizaciones</h1>
                <Button disabled>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nueva Cotización
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Historial de Cotizaciones</CardTitle>
                    <CardDescription>Rastrea y gestiona todas las cotizaciones de clientes generadas desde el flujo de ventas.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Versión</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>PDF</TableHead>
                                <TableHead><span className="sr-only">Acciones</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                    <TableCell colSpan={7}>
                                        <Skeleton className="h-10 w-full" />
                                    </TableCell>
                                    </TableRow>
                                ))
                            ) : enrichedQuotations.length > 0 ? (
                                enrichedQuotations.map(quote => {
                                    const statusVariant : 'default' | 'secondary' | 'destructive' | 'outline' = {
                                        'Enviada': 'default',
                                        'Aceptada': 'secondary',
                                        'Rechazada': 'destructive',
                                        'Borrador': 'outline',
                                    }[quote.status as string] || 'default';

                                    return (
                                    <TableRow key={quote.id}>
                                        <TableCell className="font-semibold">{quote.clientName}</TableCell>
                                        <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency }).format(quote.value)}</TableCell>
                                        <TableCell><Badge variant={statusVariant}>{quote.status}</Badge></TableCell>
                                        <TableCell className="text-center">v{quote.version}</TableCell>
                                        <TableCell>{new Date(quote.createdDate).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <Button asChild variant="outline" size="sm" disabled={!quote.pdfUrl}>
                                                <a href={quote.pdfUrl} target="_blank" rel="noopener noreferrer">
                                                    <FileDown className="mr-2 h-3 w-3"/>
                                                    Descargar
                                                </a>
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button aria-haspopup="true" size="icon" variant="ghost">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Toggle menu</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                    <DropdownMenuItem disabled>Editar</DropdownMenuItem>
                                                    <DropdownMenuItem disabled>Crear Nueva Versión</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive" disabled>Eliminar</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                    )
                                })
                             ) : (
                                <TableRow>
                                    <TableCell
                                    colSpan={7}
                                    className="h-24 text-center"
                                    >
                                    No se encontraron cotizaciones.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
