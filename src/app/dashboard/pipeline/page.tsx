'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, PlusCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { opportunities as initialOpportunities, clients, users } from '@/lib/data';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

const stages: OpportunityStage[] = ['Prospecto', 'Calificación', 'Propuesta', 'Negociación', 'Ganada', 'Perdida'];

const opportunitySchema = z.object({
  name: z.string().min(1, { message: 'El nombre es requerido.' }),
  clientId: z.string().min(1, { message: 'Por favor seleccione un cliente.' }),
  sellerId: z.string().min(1, { message: 'Por favor seleccione un vendedor.' }),
  value: z.coerce.number().positive({ message: 'El valor debe ser un número positivo.' }),
  currency: z.enum(['USD', 'MXN']),
  closeDate: z.date({ required_error: 'La fecha de cierre es requerida.' }),
});

const sellerUsers = users.filter(u => u.role === 'seller');

export default function PipelinePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>(initialOpportunities);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof opportunitySchema>>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      name: '',
      clientId: '',
      sellerId: '',
      value: 0,
      currency: 'USD',
    },
  });

  const handleStageChange = (opportunityId: string, newStage: OpportunityStage) => {
    setOpportunities(prev =>
      prev.map(op => (op.id === opportunityId ? { ...op, stage: newStage } : op))
    );
  };

  function onSubmit(values: z.infer<typeof opportunitySchema>) {
    const newOpportunity: Opportunity = {
      id: `op-${Date.now()}`,
      stage: 'Prospecto',
      ...values,
      closeDate: format(values.closeDate, 'yyyy-MM-dd'),
    };
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
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Prospecto</DialogTitle>
              <DialogDescription>
                Complete los detalles de la nueva oportunidad de venta.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Oportunidad</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Proyecto Omega" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione un cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((client: Client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.nombreDelCliente}
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
                    name="value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="50000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Moneda</FormLabel>
                         <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione una moneda" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="MXN">MXN</SelectItem>
                            </SelectContent>
                          </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <FormField
                  control={form.control}
                  name="closeDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de Cierre Estimada</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: es })
                              ) : (
                                <span>Elige una fecha</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0,0,0,0))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
