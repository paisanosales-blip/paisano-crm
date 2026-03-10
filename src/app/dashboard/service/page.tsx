'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Wrench, Clock, CheckCircle, Hourglass } from 'lucide-react';
import type { ServiceTicket, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const statusConfig: { [key: string]: { label: string; color: string; icon: React.ElementType } } = {
  Abierto: { label: 'Abierto', color: 'bg-red-500', icon: Wrench },
  'En Progreso': { label: 'En Progreso', color: 'bg-yellow-500', icon: Hourglass },
  Solucionado: { label: 'Solucionado', color: 'bg-blue-500', icon: Clock },
  Cerrado: { label: 'Cerrado', color: 'bg-green-500', icon: CheckCircle },
};

const getSemaforoState = (ticket: ServiceTicket): { level: 'ok' | 'warning' | 'danger' | 'info' | 'neutral'; label: string; tooltip: string } => {
    if (!ticket) return { level: 'neutral', label: 'Desconocido', tooltip: 'Datos no disponibles' };
    const now = new Date();
    const hoursSinceReported = differenceInHours(now, new Date(ticket.reportedAt));

    switch(ticket.status) {
        case 'Cerrado':
            return { level: 'ok', label: 'Resuelto', tooltip: 'Ticket cerrado y resuelto.' };
        case 'Solucionado':
             return { level: 'info', label: 'Solucionado', tooltip: 'Ticket solucionado, pendiente de cierre.' };
        case 'En Progreso':
            if (ticket.lastInteractionAt) {
                const hoursSinceInteraction = differenceInHours(now, new Date(ticket.lastInteractionAt));
                if (hoursSinceInteraction <= 48) {
                    return { level: 'ok', label: 'Activo', tooltip: 'En progreso con actividad reciente.' };
                } else if (hoursSinceInteraction <= 72) {
                    return { level: 'warning', label: 'Inactivo', tooltip: 'En progreso, requiere atención pronto.' };
                } else {
                    return { level: 'danger', label: 'Crítico', tooltip: 'En progreso sin actividad por más de 3 días.' };
                }
            } else {
                return { level: 'warning', label: 'Inactivo', tooltip: 'En progreso, pero sin interacciones registradas.' };
            }
        case 'Abierto':
            if (ticket.lastInteractionAt) {
                 const hoursSinceInteraction = differenceInHours(now, new Date(ticket.lastInteractionAt));
                 if (hoursSinceInteraction <= 24) {
                    return { level: 'ok', label: 'Activo', tooltip: 'Ticket abierto con actividad reciente.' };
                 } else {
                    return { level: 'warning', label: 'Atención', tooltip: 'Ticket abierto sin actividad en las últimas 24h.' };
                 }
            } else {
                if (hoursSinceReported > 24) {
                    return { level: 'danger', label: 'Urgente', tooltip: 'Abierto por más de 24h sin interacción.' };
                } else {
                    return { level: 'warning', label: 'Nuevo', tooltip: 'Recién abierto, pendiente de primera interacción.' };
                }
            }
        default:
             return { level: 'neutral', label: 'Desconocido', tooltip: 'Estado desconocido.' };
    }
}

export default function CustomerServicePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  
  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const agentsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'users'), where('role', 'in', ['seller', 'manager']));
  }, [firestore]);
  const { data: agents, isLoading: areAgentsLoading } = useCollection<User>(agentsQuery);

  const ticketsQuery = useMemoFirebase(() => {
    if (!userProfile || !user) return null;
    let q = query(collection(firestore, 'serviceTickets'));
    
    if (userProfile.role === 'seller') {
        q = query(q, where('assignedAgentId', '==', user.uid));
    }

    if (statusFilter !== 'all') {
      q = query(q, where('status', '==', statusFilter));
    }
    if (agentFilter !== 'all' && userProfile.role === 'manager') {
      q = query(q, where('assignedAgentId', '==', agentFilter));
    }

    return q;
  }, [firestore, userProfile, user, statusFilter, agentFilter]);

  const { data: tickets, isLoading: areTicketsLoading } = useCollection<ServiceTicket>(ticketsQuery);

  const isLoading = isUserLoading || areTicketsLoading || areAgentsLoading;

  const stats = useMemo(() => {
    if (!tickets) return { open: 0, inProgress: 0, totalSolved: 0, avgResolutionHours: 0 };
    
    const solvedTickets = tickets.filter(t => t.solvedAt);
    const totalHours = solvedTickets.reduce((acc, t) => {
        const hours = differenceInHours(new Date(t.solvedAt!), new Date(t.reportedAt));
        return acc + hours;
    }, 0);

    return {
        open: tickets.filter(t => t.status === 'Abierto').length,
        inProgress: tickets.filter(t => t.status === 'En Progreso').length,
        totalSolved: solvedTickets.length,
        avgResolutionHours: solvedTickets.length > 0 ? Math.round(totalHours / solvedTickets.length) : 0,
    };
  }, [tickets]);


  return (
    <div className="grid gap-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-headline font-bold">Servicio al Cliente</h1>
        <Button onClick={() => router.push('/dashboard/service/new')}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuevo Ticket
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-muted/50"><CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2"><CardTitle className="text-xs font-medium">Abiertos</CardTitle><Wrench className="h-4 w-4 text-red-500" /></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold">{isLoading ? <Skeleton className="h-7 w-12" /> : stats.open}</div></CardContent></Card>
        <Card className="bg-muted/50"><CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2"><CardTitle className="text-xs font-medium">En Progreso</CardTitle><Hourglass className="h-4 w-4 text-yellow-500" /></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold">{isLoading ? <Skeleton className="h-7 w-12" /> : stats.inProgress}</div></CardContent></Card>
        <Card className="bg-muted/50"><CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2"><CardTitle className="text-xs font-medium">Total Solucionados</CardTitle><CheckCircle className="h-4 w-4 text-green-500" /></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold">{isLoading ? <Skeleton className="h-7 w-12" /> : stats.totalSolved}</div></CardContent></Card>
        <Card className="bg-muted/50"><CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2"><CardTitle className="text-xs font-medium">T. de Solución Prom.</CardTitle><Clock className="h-4 w-4 text-blue-500" /></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold">{isLoading ? <Skeleton className="h-7 w-12" /> : `${stats.avgResolutionHours}h`}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div>
              <CardTitle>Tickets de Servicio</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Estados</SelectItem>
                  {Object.keys(statusConfig).map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
              {userProfile?.role === 'manager' && (
                <Select value={agentFilter} onValueChange={setAgentFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar por agente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Agentes</SelectItem>
                    {agents?.map((agent: User) => <SelectItem key={agent.id} value={agent.id}>{agent.firstName} {agent.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Atención</TableHead><TableHead>Estado</TableHead><TableHead>Cliente / VIN</TableHead><TableHead>Incidente</TableHead><TableHead>Agente</TableHead><TableHead>Reportado</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-12 w-full" /></TableCell></TableRow>)
              ) : tickets && tickets.length > 0 ? (
                tickets.map((ticket: ServiceTicket) => (
                  <TableRow key={ticket.id} onClick={() => router.push(`/dashboard/service/${ticket.id}`)} className="cursor-pointer">
                    <TableCell>
                      {(() => {
                          const semaforo = getSemaforoState(ticket);
                          return (
                            <div className="flex items-center gap-2" title={semaforo.tooltip}>
                              <span className={cn("h-3 w-3 rounded-full", {
                                'bg-green-500': semaforo.level === 'ok',
                                'bg-sky-500': semaforo.level === 'info',
                                'bg-yellow-500': semaforo.level === 'warning',
                                'bg-red-500': semaforo.level === 'danger',
                                'bg-gray-400': semaforo.level === 'neutral',
                              })} />
                              <span className="font-medium text-sm">{semaforo.label}</span>
                            </div>
                          )
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-white", statusConfig[ticket.status].color)}>
                        {statusConfig[ticket.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{ticket.clientName}</div>
                      <div className="text-xs text-muted-foreground">{ticket.vin}</div>
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{ticket.incidentCause}</TableCell>
                    <TableCell>{ticket.assignedAgentName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(ticket.reportedAt), { addSuffix: true, locale: es })}</TableCell>
                    <TableCell className="text-right">
                       <Button size="sm" variant="ghost" asChild><Link href={`/dashboard/service/${ticket.id}`}>Ver</Link></Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">No se encontraron tickets.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
