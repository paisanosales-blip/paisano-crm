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
  updateDocumentNonBlocking,
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
import { MoreHorizontal, PlusCircle, FileDown, Mail, DollarSign, Send, FileCheck, FileX, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getClassification, getBadgeClass } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

export default function QuotationsPage() {
    const { user, isUserLoading: isUserAuthLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedUserId, setSelectedUserId] = useState<string>('me');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [quotationToDelete, setQuotationToDelete] = useState<any | null>(null);
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<string>>(new Set());

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

    const quotationStats = React.useMemo(() => {
        if (!enrichedQuotations) return { sentValueUSD: 0, acceptedValueUSD: 0, sentValueMXN: 0, acceptedValueMXN: 0, sentCount: 0, acceptedCount: 0, rejectedCount: 0, draftCount: 0 };
    
        return enrichedQuotations.reduce((acc, quote) => {
            const value = quote.value || 0;
            const isUSD = quote.currency === 'USD';
            switch (quote.status) {
                case 'Enviada':
                    acc.sentCount++;
                    if (isUSD) acc.sentValueUSD += value; else acc.sentValueMXN += value;
                    break;
                case 'Aceptada':
                    acc.acceptedCount++;
                    if (isUSD) acc.acceptedValueUSD += value; else acc.acceptedValueMXN += value;
                    break;
                case 'Rechazada': acc.rejectedCount++; break;
                case 'Borrador': acc.draftCount++; break;
            }
            return acc;
        }, { sentValueUSD: 0, acceptedValueUSD: 0, sentValueMXN: 0, acceptedValueMXN: 0, sentCount: 0, acceptedCount: 0, rejectedCount: 0, draftCount: 0 });
    }, [enrichedQuotations]);

    const groupedQuotations = React.useMemo(() => {
        if (!enrichedQuotations) return {};
        const groups = enrichedQuotations.reduce((acc, quote) => {
            const clientName = quote.clientName || 'Cliente Desconocido';
            if (!acc[clientName]) acc[clientName] = [];
            acc[clientName].push(quote);
            return acc;
        }, {} as Record<string, any[]>);

        Object.values(groups).forEach(quotes => quotes.sort((a, b) => Number(b.version) - Number(a.version)));
        return groups;
    }, [enrichedQuotations]);

    const handleSelectQuote = (quoteId: string, checked: boolean) => {
        setSelectedQuoteIds(prev => {
            const newSet = new Set(prev);
            if (checked) newSet.add(quoteId); else newSet.delete(quoteId);
            return newSet;
        });
    };

    const handleSelectClientQuotes = (clientName: string, checked: boolean) => {
        const clientQuoteIds = groupedQuotations[clientName]?.map(q => q.id) || [];
        setSelectedQuoteIds(prev => {
            const newSet = new Set(prev);
            if (checked) clientQuoteIds.forEach(id => newSet.add(id));
            else clientQuoteIds.forEach(id => newSet.delete(id));
            return newSet;
        });
    };
    
    const areAllClientQuotesSelected = (clientName: string) => {
        const clientQuoteIds = groupedQuotations[clientName]?.map(q => q.id) || [];
        if (clientQuoteIds.length === 0) return false;
        return clientQuoteIds.every(id => selectedQuoteIds.has(id));
    };

    const isAnyClientQuoteSelected = (clientName: string) => {
        const clientQuoteIds = groupedQuotations[clientName]?.map(q => q.id) || [];
        return clientQuoteIds.some(id => selectedQuoteIds.has(id));
    };
    
    const handleSendEmail = (quotation: any) => {
        if (!quotation.clientEmail) { toast({ variant: 'destructive', title: 'Correo no encontrado', description: `No se encontró una dirección de correo para ${quotation.clientName}.` }); return; }
        if (!quotation.pdfUrl) { toast({ variant: 'destructive', title: 'PDF no encontrado', description: `No se encontró el archivo PDF para esta cotización.` }); return; }
        const subject = `Cotización de Paisano Trailer - ${quotation.clientName}`;
        const body = `Estimado/a ${quotation.contactPerson || quotation.clientName},\n\nAdjunto encontrará el enlace para descargar su cotización (versión ${quotation.version}).\n\nPor favor, haga clic en el siguiente enlace:\n${quotation.pdfUrl}\n\nSi tiene alguna pregunta, no dude en contactarnos.\n\nSaludos cordiales,\n${userProfile?.firstName || ''} ${userProfile?.lastName || ''}\nPaisano Trailer`;
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${quotation.clientEmail}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    };

    const handleDeleteClick = (quotation: any) => {
        setQuotationToDelete(quotation);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!quotationToDelete || !firestore) { toast({ variant: 'destructive', title: 'Error', description: 'No se pudo encontrar la cotización a eliminar.' }); return; }
        setIsDeleting(true);
        try {
            deleteDocumentNonBlocking(doc(firestore, 'quotations', quotationToDelete.id));
            toast({ title: 'Eliminación Iniciada', description: `La cotización para ${quotationToDelete.clientName} se está eliminando.` });
        } catch (error) {
            console.error("Error deleting quotation:", error);
            toast({ variant: 'destructive', title: 'Error al eliminar', description: 'Ocurrió un problema al eliminar la cotización.' });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setQuotationToDelete(null);
        }
    };
    
    const handleBulkDeleteClick = () => setIsBulkDeleteOpen(true);

    const handleBulkDeleteConfirm = () => {
        if (!firestore) return;
        setIsDeleting(true);
        try {
            selectedQuoteIds.forEach(id => deleteDocumentNonBlocking(doc(firestore, 'quotations', id)));
            toast({ title: 'Eliminación en Proceso', description: `${selectedQuoteIds.size} cotizaciones se están eliminando.` });
        } catch (error) {
            console.error("Error bulk deleting quotations:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Ocurrió un problema al eliminar las cotizaciones.' });
        } finally {
            setIsDeleting(false);
            setIsBulkDeleteOpen(false);
            setSelectedQuoteIds(new Set());
        }
    };

    const handleStatusChange = (quotationId: string, status: 'Aceptada' | 'Rechazada' | 'Enviada' | 'Borrador') => {
        if (!firestore) return;
        const quotationRef = doc(firestore, 'quotations', quotationId);
        updateDocumentNonBlocking(quotationRef, { status });
        toast({ title: 'Estado Actualizado', description: `La cotización ha sido marcada como ${status.toLowerCase()}.` });
    };

    return (
      <>
        <div className="grid gap-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-headline font-bold">Cotizaciones</h1>
                <div className="flex items-center gap-4">
                    {selectedQuoteIds.size > 0 && (
                        <Button variant="destructive" onClick={handleBulkDeleteClick} disabled={isDeleting}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar ({selectedQuoteIds.size})
                        </Button>
                    )}
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

            {isLoading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
                    {Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
                    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Valor Total Enviado</CardTitle><Send className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(quotationStats.sentValueUSD)}</div><p className="text-xs text-muted-foreground">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(quotationStats.sentValueMXN)}</p><p className="text-xs text-muted-foreground mt-1">en {quotationStats.sentCount} cotizaciones</p></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Valor Total Aceptado</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(quotationStats.acceptedValueUSD)}</div><p className="text-xs text-muted-foreground">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(quotationStats.acceptedValueMXN)}</p><p className="text-xs text-muted-foreground mt-1">de {quotationStats.acceptedCount} cotizaciones</p></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Cotizaciones Aceptadas</CardTitle><FileCheck className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{quotationStats.acceptedCount}</div><p className="text-xs text-muted-foreground">De un total de {enrichedQuotations.length} cotizaciones</p></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Rechazadas / Borrador</CardTitle><FileX className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{quotationStats.rejectedCount}</div><p className="text-xs text-muted-foreground">{quotationStats.draftCount} en borrador</p></CardContent></Card>
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Historial de Cotizaciones</CardTitle>
                    <CardDescription>Rastrea y gestiona todas las cotizaciones de clientes generadas desde el flujo de ventas.</CardDescription>
                </CardHeader>
                 <CardContent className="px-2 pt-2">
                    {isLoading ? (
                        <div className="p-4"><Skeleton className="h-48 w-full" /></div>
                    ) : Object.keys(groupedQuotations).length > 0 ? (
                        <Accordion type="multiple" className="w-full">
                            {Object.entries(groupedQuotations)
                            .sort((a, b) => a[0].localeCompare(b[0]))
                            .map(([clientName, quotes]) => {
                                const opportunityStage = quotes[0]?.opportunityStage;
                                const classification = opportunityStage ? getClassification(opportunityStage) : null;
                                return (
                                <AccordionItem value={clientName} key={clientName}>
                                    <div className="flex items-center px-4 hover:bg-muted/50 rounded-md">
                                        <Checkbox
                                            className="mr-4"
                                            onCheckedChange={(checked) => handleSelectClientQuotes(clientName, !!checked)}
                                            checked={areAllClientQuotesSelected(clientName)}
                                            aria-label={`Seleccionar todas las cotizaciones de ${clientName}`}
                                        />
                                        <AccordionTrigger className="flex-1 py-3 px-0 hover:no-underline">
                                            <div className="flex items-center gap-4 flex-grow">
                                                <span className="font-semibold text-base">{clientName}</span>
                                                <Badge variant="secondary">{quotes.length} {quotes.length === 1 ? 'cotización' : 'cotizaciones'}</Badge>
                                                {classification && (
                                                    <Badge variant="outline" className={cn('font-bold uppercase text-xs', getBadgeClass(classification))}>{classification}</Badge>
                                                )}
                                            </div>
                                        </AccordionTrigger>
                                    </div>
                                    <AccordionContent className="pt-0 pl-8">
                                        <div className="border-t">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[50px]"><span className="sr-only">Seleccionar</span></TableHead>
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
                                                            'Enviada': 'default', 'Aceptada': 'secondary', 'Rechazada': 'destructive', 'Borrador': 'outline',
                                                        }[quote.status as string] || 'default';
                                                        return (
                                                        <TableRow key={quote.id}>
                                                            <TableCell><Checkbox checked={selectedQuoteIds.has(quote.id)} onCheckedChange={(checked) => handleSelectQuote(quote.id, !!checked)} aria-label={`Seleccionar cotización ${quote.id}`} /></TableCell>
                                                            <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency }).format(quote.value)}</TableCell>
                                                            <TableCell><Badge variant={statusVariant}>{quote.status}</Badge></TableCell>
                                                            <TableCell className="text-center">v{quote.version}</TableCell>
                                                            <TableCell>{new Date(quote.createdDate).toLocaleDateString()}</TableCell>
                                                            <TableCell>
                                                                <Button asChild variant="outline" size="sm" disabled={!quote.pdfUrl}>
                                                                    <a href={quote.pdfUrl} target="_blank" rel="noopener noreferrer"><FileDown className="mr-2 h-3 w-3"/>Descargar</a>
                                                                </Button>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <Button variant="ghost" size="icon" onClick={() => handleSendEmail(quote)} disabled={!quote.clientEmail} title={quote.clientEmail ? 'Enviar por correo' : 'Correo no disponible'}><Mail className="h-4 w-4" /><span className="sr-only">Enviar por Correo</span></Button>
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end">
                                                                            <DropdownMenuLabel>Cambiar Estado</DropdownMenuLabel>
                                                                            <DropdownMenuItem onSelect={() => handleStatusChange(quote.id, 'Aceptada')} disabled={quote.status === 'Aceptada'}><FileCheck className="mr-2 h-4 w-4" /><span>Aceptada</span></DropdownMenuItem>
                                                                            <DropdownMenuItem onSelect={() => handleStatusChange(quote.id, 'Rechazada')} disabled={quote.status === 'Rechazada'}><FileX className="mr-2 h-4 w-4" /><span>Rechazada</span></DropdownMenuItem>
                                                                            <DropdownMenuItem onSelect={() => handleStatusChange(quote.id, 'Enviada')} disabled={quote.status === 'Enviada'}><Send className="mr-2 h-4 w-4" /><span>Enviada</span></DropdownMenuItem>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuLabel>Otras Acciones</DropdownMenuLabel>
                                                                            <DropdownMenuItem disabled>Editar</DropdownMenuItem>
                                                                            <DropdownMenuItem disabled>Crear Nueva Versión</DropdownMenuItem>
                                                                            <DropdownMenuItem className="text-destructive" onSelect={() => handleDeleteClick(quote)}>Eliminar</DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>
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
                        <div className="h-24 text-center flex items-center justify-center p-6 pt-0"><p>No se encontraron cotizaciones.</p></div>
                    )}
                </CardContent>
            </Card>
        </div>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>¿Está seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará permanentemente la cotización.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">{isDeleting ? 'Eliminando...' : 'Eliminar Permanentemente'}</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>¿Eliminar Cotizaciones Seleccionadas?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer. Se eliminarán permanentemente {selectedQuoteIds.size} cotizaciones.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDeleteConfirm} disabled={isDeleting} variant="destructive">{isDeleting ? 'Eliminando...' : `Sí, eliminar ${selectedQuoteIds.size}`}</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </>
    );
}
