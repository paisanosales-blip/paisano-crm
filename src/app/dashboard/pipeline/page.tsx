'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { PlusCircle } from 'lucide-react';

import { opportunities as initialOpportunities, clients as initialClients, users } from '@/lib/data';
import type { Opportunity, OpportunityStage, Client, User } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const stages: OpportunityStage[] = ['Prospecto', 'Calificación', 'Propuesta', 'Negociación', 'Ganada', 'Perdida'];

const prospectoSchema = z.object({
    clientName: z.string().min(1, 'El nombre del cliente es requerido.'),
    country: z.string().min(1, 'El país es requerido.'),
    city: z.string().min(1, 'La ciudad es requerida.'),
    companyName: z.string().min(1, 'El nombre de la empresa es requerido.'),
    contactMethod: z.enum(['REDES SOCIALES', 'PUBLICIDAD', 'BUSQUEDA EN GOOGLE', 'BUSQUEDA EN MAPS'], { required_error: "Debe seleccionar una forma de contacto."}),
    website: z.string().url({ message: "URL de página web inválida." }).optional().or(z.literal('')),
    phone: z.string().optional(),
    email: z.string().email('Email inválido.').optional().or(z.literal('')),
    language: z.string().min(1, 'El idioma es requerido.'),
    sellerId: z.string().min(1, { message: 'Por favor seleccione un vendedor.' }),
}).refine(data => {
    return !!data.website || !!data.phone || !!data.email;
}, {
    message: 'Debe proporcionar al menos una de las siguientes opciones: Página web, teléfono o email.',
    path: ['website'] // Attach error to a specific field for display
});


const sellerUsers = users.filter(u => u.role === 'seller');
const contactMethods = ['REDES SOCIALES', 'PUBLICIDAD', 'BUSQUEDA EN GOOGLE', 'BUSQUEDA EN MAPS'];

export default function PipelinePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>(initialOpportunities);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof prospectoSchema>>({
    resolver: zodResolver(prospectoSchema),
    defaultValues: {
      clientName: '',
      country: '',
      city: '',
      companyName: '',
      website: '',
      phone: '',
      email: '',
      language: '',
      sellerId: '',
    },
  });

  const handleStageChange = (opportunityId: string, newStage: OpportunityStage) => {
    setOpportunities(prev =>
      prev.map(op => (op.id === opportunityId ? { ...op, stage: newStage } : op))
    );
  };

  function onSubmit(values: z.infer<typeof prospectoSchema>) {
    const newClient: Client = {
        id: `c-${Date.now()}`,
        numeroDeCliente: `C${String(Date.now()).slice(-4)}`,
        nombreDelCliente: values.companyName,
        region: `${values.city}, ${values.country}`,
        sellerId: values.sellerId,
        createdAt: format(new Date(), 'yyyy-MM-dd'),
    };

    const newOpportunity: Opportunity = {
      id: `op-${Date.now()}`,
      name: `Oportunidad para ${values.companyName}`,
      clientId: newClient.id,
      sellerId: values.sellerId,
      stage: 'Prospecto',
      value: 0,
      currency: 'USD',
      closeDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    };
    
    setClients(prev => [newClient, ...prev]);
    setOpportunities(prev => [newOpportunity, ...prev]);

    setIsDialogOpen(false);
    form.reset();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-headline font-bold">Flujo de Ventas</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nuevo Prospecto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Prospecto</DialogTitle>
              <DialogDescription>
                Complete los detalles para crear un nuevo prospecto.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de Empresa</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Acme Inc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="clientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Cliente</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Juan Pérez" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>País</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: México" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ciudad</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Ciudad de México" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                 <FormField
                  control={form.control}
                  name="sellerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendedor Asignado</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione un vendedor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sellerUsers.map((user: User) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contactMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Forma de Contacto</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione un método" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {contactMethods.map((method) => (
                              <SelectItem key={method} value={method}>
                                {method}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Idioma</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Español" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                    <p className="text-xs text-muted-foreground mb-2">Proporcione al menos un método de contacto:</p>
                    <div className="grid gap-4">
                         <FormField
                            control={form.control}
                            name="website"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Página Web</FormLabel>
                                <FormControl>
                                <Input placeholder="https://ejemplo.com" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Teléfono</FormLabel>
                                <FormControl>
                                <Input placeholder="+52 55 1234 5678" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                <Input type="email" placeholder="contacto@ejemplo.com" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                     <Button type="button" variant="secondary">Cancelar</Button>
                  </DialogClose>
                  <Button type="submit">Guardar Prospecto</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-start overflow-x-auto">
        {stages.map(stage => (
          <div key={stage} className="bg-muted/50 rounded-lg h-full min-w-[280px]">
            <h2 className="p-4 text-lg font-semibold font-headline sticky top-0 bg-muted/80 backdrop-blur-sm z-10 rounded-t-lg">{stage}</h2>
            <div className="p-2 flex flex-col gap-4">
              {opportunities
                .filter(op => op.stage === stage)
                .map(op => {
                  const client = clients.find(c => c.id === op.clientId);
                  return (
                    <Card key={op.id} className="shadow-md hover:shadow-lg transition-shadow">
                      <CardHeader className="p-4">
                        <CardTitle className="text-base">{op.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 text-sm space-y-2">
                        <p className="text-muted-foreground">{client?.nombreDelCliente}</p>
                        <p className="font-semibold">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: op.currency }).format(op.value)}
                        </p>
                        <Select value={op.stage} onValueChange={(newStage: OpportunityStage) => handleStageChange(op.id, newStage)}>
                          <SelectTrigger className="mt-2 h-8 text-xs">
                            <SelectValue placeholder="Cambiar etapa" />
                          </SelectTrigger>
                          <SelectContent>
                            {stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
