'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, getDocs } from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Briefcase, Send, FileText, Handshake, Award, ArchiveX, Landmark, Phone, Mail, MessageSquare, StickyNote, Users, CheckCircle2, FileDown
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
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

interface ClientTimelineDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    leadId: string | null;
}

export function ClientTimelineDialog({ open, onOpenChange, leadId }: ClientTimelineDialogProps) {
    const firestore = useFirestore();

    const leadRef = useMemoFirebase(() => leadId ? doc(firestore, 'leads', leadId) : null, [firestore, leadId]);
    const { data: lead, isLoading: isLeadLoading } = useDoc(leadRef);

    const opportunitiesQuery = useMemoFirebase(() => leadId ? query(collection(firestore, 'opportunities'), where('leadId', '==', leadId)) : null, [firestore, leadId]);
    const { data: opportunities, isLoading: areOppsLoading } = useCollection<Opportunity>(opportunitiesQuery);

    const activitiesQuery = useMemoFirebase(() => leadId ? query(collection(firestore, 'activities'), where('leadId', '==', leadId)) : null, [firestore, leadId]);
    const { data: activities, isLoading: areActivitiesLoading } = useCollection<Activity>(activitiesQuery);
    
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [areQuotsLoading, setAreQuotsLoading] = useState(true);

    useEffect(() => {
        if (!leadId) {
            setAreQuotsLoading(false);
            return;
        }

        if (opportunities && firestore) {
            const oppIds = opportunities.map(o => o.id);
            if (oppIds.length > 0) {
                setAreQuotsLoading(true);
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
    }, [opportunities, firestore, leadId]);
    
    useEffect(() => {
        if (!open) {
            setQuotations([]);
            setAreQuotsLoading(true);
        }
    }, [open]);

    const timelineEvents = useMemo(() => {
        if (!lead && !opportunities && !activities && !quotations) return [];

        const events: TimelineEvent[] = [];

        if (lead && lead.createdDate) {
            events.push({
                id: `lead-created-${lead.id}`, date: new Date(lead.createdDate), Icon: Users,
                title: 'Prospecto Registrado', description: `Se registró a ${lead.clientName} como un nuevo prospecto.`, data: lead
            });
        }
        
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

        quotations?.forEach(quot => {
            if (quot.createdDate) {
                events.push({
                    id: `quot-${quot.id}`, date: new Date(quot.createdDate), Icon: FileText,
                    title: `Cotización v${quot.version} Enviada`,
                    description: `Valor: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: quot.currency }).format(quot.value)}`,
                    data: quot
                });
            }
        });

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

    const isLoading = !leadId || isLeadLoading || areOppsLoading || areActivitiesLoading || areQuotsLoading;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Línea de Tiempo de {lead?.clientName || 'Cliente'}</DialogTitle>
                    <DialogDescription>
                        Un historial cronológico de todas las interacciones con este prospecto.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto pr-6 -mr-6">
                    {isLoading ? (
                        <div className="space-y-4 p-4">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : (
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
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
