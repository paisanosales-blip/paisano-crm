'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useFirestore,
  useUser,
  useCollection,
  useMemoFirebase,
  addDocumentNonBlocking,
  useDoc
} from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import type { User, ServiceTicket } from '@/lib/types';


const ticketSchema = z.object({
  clientName: z.string().min(1, "El nombre del cliente es requerido."),
  clientPhone: z.string().optional(),
  clientEmail: z.string().email("Correo inválido.").optional(),
  vin: z.string().min(1, "El VIN es requerido."),
  incidentCause: z.string().min(1, "La causa del incidente es requerida."),
  usageTime: z.string().min(1, "El tiempo de uso es requerido."),
  purchaseMethod: z.enum(['Directo', 'Dealer'], { required_error: 'El método de compra es requerido.' }),
  purchaseSource: z.string().min(1, "La fuente de compra es requerida."),
  assignedAgentId: z.string().min(1, "Debe asignar un agente."),
});

type TicketFormValues = z.infer<typeof ticketSchema>;


export default function NewServiceTicketPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);
  
  const agentsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'users'), where('role', 'in', ['seller', 'manager']));
  }, [firestore]);
  const { data: agents, isLoading: areAgentsLoading } = useCollection<User>(agentsQuery);

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      vin: '',
      incidentCause: '',
      usageTime: '',
      purchaseMethod: undefined,
      purchaseSource: '',
      assignedAgentId: '',
    },
  });

  async function onSubmit(values: TicketFormValues) {
    if (!firestore || !user || !userProfile) return;

    setIsSubmitting(true);
    
    const selectedAgent = agents?.find(a => a.id === values.assignedAgentId);
    if (!selectedAgent) {
        toast({ variant: 'destructive', title: 'Error', description: 'Agente seleccionado no válido.' });
        setIsSubmitting(false);
        return;
    }

    const ticketData: Omit<ServiceTicket, 'id'> = {
      ...values,
      isWarranty: false, // Default value
      status: 'Abierto',
      reportedAt: new Date().toISOString(),
      assignedAgentName: `${selectedAgent.firstName} ${selectedAgent.lastName}`,
    };

    try {
      const newDocRef = await addDocumentNonBlocking(collection(firestore, 'serviceTickets'), ticketData);
      toast({ title: 'Ticket Creado', description: 'El nuevo ticket de servicio ha sido registrado.' });
      router.push(`/dashboard/service/${newDocRef.id}`);
    } catch (error) {
      console.error("Error creating ticket:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear el ticket.' });
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-2">
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver a Servicio al Cliente
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Registrar Nuevo Ticket de Servicio</CardTitle>
          <CardDescription>Complete los campos para crear un nuevo caso de atención al cliente.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-6 p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg border-b pb-2">Información del Cliente</h3>
                    <FormField control={form.control} name="clientName" render={({ field }) => ( <FormItem><FormLabel>Nombre del Cliente</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="clientPhone" render={({ field }) => ( <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input placeholder="+1 555 123 4567" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="clientEmail" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="john.doe@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                 <div className="space-y-6 p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg border-b pb-2">Detalles de la Compra</h3>
                    <FormField control={form.control} name="purchaseMethod" render={({ field }) => (<FormItem><FormLabel>Método de Compra</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Directo">Directo (Paisano)</SelectItem><SelectItem value="Dealer">Dealer</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="purchaseSource" render={({ field }) => ( <FormItem><FormLabel>Vendido por</FormLabel><FormControl><Input placeholder="Nombre del Dealer o 'Paisano'" {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
              </div>
              <div className="p-4 border rounded-lg space-y-6">
                <h3 className="font-semibold text-lg border-b pb-2">Detalles del Incidente</h3>
                <FormField control={form.control} name="vin" render={({ field }) => ( <FormItem><FormLabel>VIN (Número de Serie)</FormLabel><FormControl><Input placeholder="Ingrese el VIN del remolque" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="usageTime" render={({ field }) => ( <FormItem><FormLabel>Tiempo de Uso</FormLabel><FormControl><Input placeholder="Ej: 3 meses, 1 año" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="incidentCause" render={({ field }) => ( <FormItem><FormLabel>Causa del Incidente</FormLabel><FormControl><Textarea placeholder="Describa el problema reportado por el cliente..." className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>

               <div className="p-4 border rounded-lg space-y-6">
                  <h3 className="font-semibold text-lg border-b pb-2">Asignación</h3>
                  <FormField control={form.control} name="assignedAgentId" render={({ field }) => ( <FormItem><FormLabel>Asignar a Agente</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={areAgentsLoading}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar un agente..." /></SelectTrigger></FormControl><SelectContent>{agents?.map(agent => <SelectItem key={agent.id} value={agent.id}>{agent.firstName} {agent.lastName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              </div>

              <div className="flex justify-end gap-4 pt-4">
                  <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>Cancelar</Button>
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creando Ticket...' : 'Crear Ticket'}</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

    