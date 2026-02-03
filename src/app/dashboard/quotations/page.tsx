'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal, PlusCircle, FileDown, Mail } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getClassification, getBadgeClass } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function QuotationsPage() {
    const { user, isUserLoading: isUserAuthLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedUserId, setSelectedUserId] = useState<string>('me');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [quotationToDelete, setQuotationToDelete] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

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

    // Query for quotations
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
    const { data: quotations, isLoading: areQuotsLoading } = useCollection(quotationsQuery);

    // Query for opportunities to link quotations to leads
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
    const { data: opportunities, isLoading: areOppsLoading } = useCollection(opportunitiesQuery);

    // Query for leads to get client names
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
    const { data: leads, isLoading: areLeadsLoading } = useCollection(leadsQuery);

    const isLoading = isUserAuthLoading || isProfileLoading || areUsersLoading || areQuotsLoading || areOppsLoading || areLeadsLoading;

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
                opportunityStage: opportunity ? opportunity.stage : null,
                clientEmail: lead ? lead.email : null,
                contactPerson: lead ? lead.contactPerson : 'Contacto',
            };
        }).sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());

    }, [quotations, opportunities, leads, isLoading]);

    const groupedQuotations = React.useMemo(() => {
        if (!enrichedQuotations) return {};
        const groups = enrichedQuotations.reduce((acc, quote) => {
            const clientName = quote.clientName || 'Cliente Desconocido';
            if (!acc[clientName]) {
                acc[clientName] = [];
            }
            acc[clientName].push(quote);
            return acc;
        }, {} as Record<string, any[]>);

        // Sort quotes within each group by version
        Object.values(groups).forEach(quotes => {
            quotes.sort((a, b) => Number(b.version) - Number(a.version));
        });

        return groups;
    }, [enrichedQuotations]);
    
    const handleSendEmail = (quotation: any) => {
        if (!quotation.clientEmail) {
            toast({
                variant: 'destructive',
                title: 'Correo no encontrado',
                description: `No se encontró una dirección de correo para ${quotation.clientName}.`,
            });
            return;
        }
        if (!quotation.pdfUrl) {
            toast({
                variant: 'destructive',
                title: 'PDF no encontrado',
                description: `No se encontró el archivo PDF para esta cotización.`,
            });
            return;
        }

        const subject = `Cotización de Paisano Trailer - ${quotation.clientName}`;
        const body = `Estimado/a ${quotation.contactPerson || quotation.clientName},\n\nAdjunto encontrará el enlace para descargar su cotización (versión ${quotation.version}).\n\nPor favor, haga clic en el siguiente enlace:\n${quotation.pdfUrl}\n\nSi tiene alguna pregunta, no dude en contactarnos.\n\nSaludos cordiales,\n${userProfile?.firstName || ''} ${userProfile?.lastName || ''}\nPaisano Trailer`;

        const mailtoLink = `mailto:${quotation.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        window.location.href = mailtoLink;
    };


    const handleDeleteClick = (quotation: any) => {
        setQuotationToDelete(quotation);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!quotationToDelete || !firestore) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo encontrar la cotización a eliminar.',
            });
            return;
        }

        setIsDeleting(true);

        try {
            deleteDocumentNonBlocking(doc(firestore, 'quotations', quotationToDelete.id));

            toast({
                title: 'Eliminación Iniciada',
                description: `La cotización para ${quotationToDelete.clientName} se está eliminando.`,
            });
        } catch (error) {
            console.error("Error deleting quotation:", error);
            toast({
                variant: 'destructive',
                title: 'Error al eliminar',
                description: 'Ocurrió un problema al eliminar la cotización.',
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setQuotationToDelete(null);
        }
    };

    return (
      <>
        <div className="grid gap-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-headline font-bold">Cotizaciones</h1>
                <div className="flex items-center gap-4">
                    {userProfile?.role === 'manager' && (
                        <Select onValueChange={setSelectedUserId} value={selectedUserId} disabled={isLoading}>
                            <SelectTrigger className="w-[220px]">
                                <SelectValue placeholder="Seleccionar vendedor..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="me">Mis Cotizaciones</SelectItem>
                                <SelectItem value="all">Todas las Cotizaciones</SelectItem>
                                {allUsers?.filter(u => u.id !== user?.uid).map((u: any) => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {`${u.firstName} ${u.lastName}`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Button asChild>
                        <Link href="/dashboard/quotations/new">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Nueva Cotización
                        </Link>
                    </Button>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Historial de Cotizaciones</CardTitle>
                    <CardDescription>Rastrea y gestiona todas las cotizaciones de clientes generadas desde el flujo de ventas.</CardDescription>
                </CardHeader>
                 <CardContent className="px-2 pt-2">
                    {isLoading ? (
                        <div className="p-4">
                            <Skeleton className="h-48 w-full" />
                        </div>
                    ) : Object.keys(groupedQuotations).length > 0 ? (
                        <Accordion type="multiple" className="w-full">
                            {Object.entries(groupedQuotations)
                            .sort((a, b) => a[0].localeCompare(b[0]))
                            .map(([clientName, quotes]) => {
                                const opportunityStage = quotes[0]?.opportunityStage;
                                const classification = opportunityStage ? getClassification(opportunityStage) : null;
                                
                                return (
                                <AccordionItem value={clientName} key={clientName}>
                                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-md">
                                        <div className="flex items-center gap-4">
                                            <span className="font-semibold text-base">{clientName}</span>
                                            <Badge variant="secondary">{quotes.length} {quotes.length === 1 ? 'cotización' : 'cotizaciones'}</Badge>
                                            {classification && (
                                                <Badge variant="outline" className={cn('font-bold uppercase text-xs', getBadgeClass(classification))}>
                                                    {classification}
                                                </Badge>
                                            )}
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-0">
                                        <div className="border-t">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[120px]">Valor</TableHead>
                                                        <TableHead>Estado</TableHead>
                                                        <TableHead>Versión</TableHead>
                                                        <TableHead>Fecha</TableHead>
                                                        <TableHead>PDF</TableHead>
                                                        <TableHead className="text-right">Acciones</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {quotes.map(quote => {
                                                        const statusVariant : 'default' | 'secondary' | 'destructive' | 'outline' = {
                                                            'Enviada': 'default',
                                                            'Aceptada': 'secondary',
                                                            'Rechazada': 'destructive',
                                                            'Borrador': 'outline',
                                                        }[quote.status as string] || 'default';
                    
                                                        return (
                                                        <TableRow key={quote.id}>
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
                                                                         <DropdownMenuItem onSelect={() => handleSendEmail(quote)}>
                                                                            <Mail className="mr-2 h-4 w-4"/>
                                                                            Enviar por Correo
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem disabled>Editar</DropdownMenuItem>
                                                                        <DropdownMenuItem disabled>Crear Nueva Versión</DropdownMenuItem>
                                                                        <DropdownMenuItem className="text-destructive" onSelect={() => handleDeleteClick(quote)}>Eliminar</DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </TableCell>
                                                        </TableRow>
                                                        )
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            )})}
                        </Accordion>
                    ) : (
                        <div className="h-24 text-center flex items-center justify-center p-6 pt-0">
                            <p>No se encontraron cotizaciones.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción no se puede deshacer. Se eliminará permanentemente la cotización.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting ? 'Eliminando...' : 'Eliminar Permanentemente'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </>
    );
}
