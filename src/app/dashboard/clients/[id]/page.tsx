'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Briefcase, Send, FileText, Handshake, Award, ArchiveX, Landmark, Phone, Mail, MessageSquare, StickyNote, Users, ArrowLeft, CheckCircle2, FileDown, Globe
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getClassification, getBadgeClass } from '@/lib/types';
import type { Opportunity, Quotation, Activity } from '@/lib/types';

const stageIconMap: Record<string, React.ElementType> = {
    'Primer contacto': Briefcase,
    'Envió de Información': Send,
    'Envió de Cotización': FileText,
    'Negociación': Handshake,
    'Cierre de venta': Award,
    'Financiamiento Externo': Landmark,
    'Descartado': ArchiveX
};

const activityIconMap: Record<string, React.ElementType> = {
    'Llamada': Phone,
    'Correo': Mail,
    'Mensaje': MessageSquare,
    'Mensaje de Texto': MessageSquare,
    'Nota': StickyNote,
    'Reunión': Users,
};

type TimelineEvent = {
    id: string;
    date: Date;
    Icon: React.ElementType;
    title: string;
    description: string;
    data: any;
};


export default function ClientDetailPage() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const clientId = params.id as string;

    const leadRef = useMemoFirebase(() => doc(firestore, 'leads', clientId), [firestore, clientId]);
    const { data: lead, isLoading: isLeadLoading } = useDoc(leadRef);

    const opportunitiesQuery = useMemoFirebase(() => query(collection(firestore, 'opportunities'), where('leadId', '==', clientId)), [firestore, clientId]);
    const { data: opportunities, isLoading: areOppsLoading } = useCollection<Opportunity>(opportunitiesQuery);

    const activitiesQuery = useMemoFirebase(() => query(collection(firestore, 'activities'), where('leadId', '==', clientId)), [firestore, clientId]);
    const { data: activities, isLoading: areActivitiesLoading } = useCollection<Activity>(activitiesQuery);
    
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [areQuotsLoading, setAreQuotsLoading] = useState(true);

    useEffect(() => {
        if (opportunities && firestore) {
            const oppIds = opportunities.map(o => o.id);
            if (oppIds.length > 0) {
                const q = query(collection(firestore, 'quotations'), where('opportunityId', 'in', oppIds));
                getDocs(q).then(snapshot => {
                    const quots = snapshot.docs.map(d => ({...d.data(), id: d.id})) as Quotation[];
                    setQuotations(quots);
                    setAreQuotsLoading(false);
                });
            } else {
                setAreQuotsLoading(false);
            }
        } else if (opportunities === null) {
            setAreQuotsLoading(false);
        }
    }, [opportunities, firestore]);

    const timelineEvents = useMemo(() => {
        if (!lead && !opportunities && !activities && !quotations) return [];

        const events: TimelineEvent[] = [];

        // 1. Lead Creation
        if (lead && lead.createdDate) {
            events.push({
                id: `lead-created-${lead.id}`, date: new Date(lead.createdDate), Icon: Users,
                title: 'Prospecto Registrado', description: `Se registró a ${lead.clientName} como un nuevo prospecto.`, data: lead
            });
        }
        
        // 2. Opportunity Stage Changes
        opportunities?.forEach(opp => {
            if (opp.createdDate) {
                events.push({
                    id: `opp-created-${opp.id}`, date: new Date(opp.createdDate), Icon: Briefcase,
                    title: 'Oportunidad Creada', description: `Se creó la oportunidad "${opp.name}".`, data: opp
                });
            }
            if (opp.infoSentDate) {
                events.push({
                id: `opp-info-${opp.id}`, date: new Date(opp.infoSentDate), Icon: stageIconMap['Envió de Información'],
                title: 'Etapa: Envió de Información', description: opp.infoSentNotes || 'Se marcó como información enviada.', data: opp
                });
            }
            if (opp.negotiationDate) {
                events.push({
                id: `opp-neg-${opp.id}`, date: new Date(opp.negotiationDate), Icon: stageIconMap['Negociación'],
                title: 'Etapa: Negociación', description: opp.negotiationNotes || 'Se inició la negociación.', data: opp
                });
            }
            if (opp.closingDate) {
                events.push({
                id: `opp-close-${opp.id}`, date: new Date(opp.closingDate), Icon: stageIconMap['Cierre de venta'],
                title: 'Etapa: Cierre de Venta', description: '¡Oportunidad ganada!', data: opp
                });
            }
            if (opp.financiamientoExternoDate) {
                events.push({
                id: `opp-finance-${opp.id}`, date: new Date(opp.financiamientoExternoDate), Icon: stageIconMap['Financiamiento Externo'],
                title: 'Etapa: Financiamiento Externo', description: opp.financiamientoExternoNotes || 'Movido a financiamiento.', data: opp
                });
            }
            if (opp.discardedDate) {
                events.push({
                id: `opp-discard-${opp.id}`, date: new Date(opp.discardedDate), Icon: stageIconMap['Descartado'],
                title: 'Etapa: Descartado', description: `Motivo: ${opp.discardReason || 'No especificado.'}`, data: opp
                });
            }
        });

        // 3. Quotations
        quotations?.forEach(quot => {
            if(quot.createdAt) {
                events.push({
                    id: `quot-${quot.id}`, date: new Date(quot.createdAt), Icon: FileText,
                    title: `Cotización v${quot.version} Enviada`,
                    description: `Valor: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: quot.currency }).format(quot.value)}`,
                    data: quot
                });
            }
        });

        // 4. Activities
        activities?.forEach(act => {
            if (act.createdDate) {
                const ActivityIcon = activityIconMap[act.type] || StickyNote;
                events.push({
                    id: `act-created-${act.id}`, date: new Date(act.createdDate), Icon: ActivityIcon,
                    title: `Seguimiento: ${act.type}`, description: act.description || 'Sin descripción.', data: act
                });
            }
            if (act.completed && act.completedDate) {
                events.push({
                id: `act-completed-${act.id}`, date: new Date(act.completedDate), Icon: CheckCircle2,
                title: `Seguimiento Completado: ${act.type}`,
                description: `Respuesta: ${act.clientResponded ? 'Sí' : 'No'}. ${act.completionNotes ? `Notas: "${act.completionNotes}"` : ''}`,
                data: act
                });
            }
        });

        return events.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [lead, opportunities, quotations, activities]);
    
    const latestOpportunity = useMemo(() => {
        if (!opportunities || opportunities.length === 0) return null;
        return opportunities.sort((a, b) => {
            if (!a.createdDate || !b.createdDate) return 0;
            return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
        })[0];
    }, [opportunities]);

    const isLoading = isLeadLoading || areOppsLoading || areActivitiesLoading || areQuotsLoading;

    if (isLoading) {
        return <div className="p-6"><Skeleton className="h-screen w-full" /></div>;
    }
    
    if (!lead) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                 <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Prospecto no encontrado</CardTitle>
                        <CardDescription>No se pudo encontrar el prospecto que está buscando. Puede que haya sido eliminado.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => router.back()}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    const classification = latestOpportunity ? getClassification(latestOpportunity.stage) : null;
    
    return (
        <div className="p-4 md:p-6 space-y-6">
            <Button variant="outline" onClick={() => router.back()} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al Flujo de Ventas
            </Button>
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div>
                            <CardTitle className="text-2xl font-bold">{lead.clientName}</CardTitle>
                            <CardDescription className="text-base">{lead.contactPerson}</CardDescription>
                        </div>
                        {classification && (
                            <Badge variant="outline" className={cn('font-bold uppercase text-lg px-4 py-2', getBadgeClass(classification))}>
                                {classification}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-6 text-sm">
                    <div className="space-y-1">
                        <h4 className="font-semibold text-muted-foreground">Contacto</h4>
                        <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {lead.email || 'N/A'}</p>
                        <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {lead.phone || 'N/A'}</p>
                        <p className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /> {lead.website || 'N/A'}</p>
                    </div>
                     <div className="space-y-1">
                        <h4 className="font-semibold text-muted-foreground">Ubicación</h4>
                        <p>{lead.city}</p>
                        <p>{lead.state}, {lead.country}</p>
                    </div>
                     <div className="space-y-1">
                        <h4 className="font-semibold text-muted-foreground">Detalles</h4>
                        <p>Tipo: <span className="font-medium">{lead.clientType}</span></p>
                        <p>Vendedor: <span className="font-medium">{lead.sellerName}</span></p>
                    </div>
                </CardContent>
            </Card>

            <div>
                <h2 className="text-xl font-semibold mb-4">Línea de Tiempo del Cliente</h2>
                <div className="relative pl-6 space-y-8 border-l-2 border-border after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-border">
                    {timelineEvents.length > 0 ? (
                        timelineEvents.map((event) => (
                            <div key={event.id} className="relative">
                                <div className="absolute -left-[29px] top-1 flex h-10 w-10 items-center justify-center rounded-full bg-background border-2 border-border">
                                    <event.Icon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="pl-8">
                                    <p className="font-semibold text-foreground">{event.title}</p>
                                    <p className="text-sm text-muted-foreground">{event.description}</p>
                                     {event.title.startsWith('Cotización') && event.data.pdfUrl && (
                                        <Button asChild variant="link" size="sm" className="pl-0 h-auto text-xs mt-1">
                                            <a href={event.data.pdfUrl} target="_blank" rel="noopener noreferrer">
                                                <FileDown className="mr-1.5 h-3 w-3" /> Ver PDF (v{event.data.version})
                                            </a>
                                        </Button>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                                        {formatDistanceToNow(event.date, { addSuffix: true, locale: es })}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="pl-8 text-muted-foreground">No hay eventos en la línea de tiempo.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
