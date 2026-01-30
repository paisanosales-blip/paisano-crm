'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { PlusCircle, MoreVertical } from 'lucide-react';

import { opportunities as initialOpportunities, clients as initialClients, users } from '@/lib/data';
import type { Opportunity, OpportunityStage, Client, User } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Data for selects
const countries = ['MEXICO', 'EUA'];
const languages = ['ESPAÑOL', 'INGLES'];
const usStates = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
    'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
    'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
    'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
    'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

const citiesByState: { [key: string]: string[] } = {
    'Alabama': ['Birmingham', 'Montgomery', 'Mobile', 'Huntsville'],
    'Alaska': ['Anchorage', 'Fairbanks', 'Juneau'],
    'Arizona': ['Phoenix', 'Tucson', 'Mesa', 'Chandler'],
    'Arkansas': ['Little Rock', 'Fort Smith', 'Fayetteville'],
    'California': ['Los Angeles', 'San Diego', 'San Jose', 'San Francisco', 'Fresno', 'Sacramento'],
    'Colorado': ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins'],
    'Connecticut': ['Bridgeport', 'New Haven', 'Stamford', 'Hartford'],
    'Delaware': ['Wilmington', 'Dover'],
    'Florida': ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg'],
    'Georgia': ['Atlanta', 'Augusta', 'Columbus', 'Macon', 'Savannah'],
    'Hawaii': ['Honolulu'],
    'Idaho': ['Boise'],
    'Illinois': ['Chicago', 'Aurora', 'Joliet', 'Naperville'],
    'Indiana': ['Indianapolis', 'Fort Wayne', 'Evansville'],
    'Iowa': ['Des Moines', 'Cedar Rapids'],
    'Kansas': ['Wichita', 'Overland Park'],
    'Kentucky': ['Louisville', 'Lexington'],
    'Louisiana': ['New Orleans', 'Baton Rouge', 'Shreveport'],
    'Maine': ['Portland'],
    'Maryland': ['Baltimore', 'Columbia'],
    'Massachusetts': ['Boston', 'Worcester', 'Springfield'],
    'Michigan': ['Detroit', 'Grand Rapids', 'Warren'],
    'Minnesota': ['Minneapolis', 'Saint Paul'],
    'Mississippi': ['Jackson'],
    'Missouri': ['Kansas City', 'Saint Louis'],
    'Montana': ['Billings'],
    'Nebraska': ['Omaha', 'Lincoln'],
    'Nevada': ['Las Vegas', 'Henderson', 'Reno'],
    'New Hampshire': ['Manchester'],
    'New Jersey': ['Newark', 'Jersey City'],
    'New Mexico': ['Albuquerque'],
    'New York': ['New York City', 'Buffalo', 'Rochester', 'Yonkers'],
    'North Carolina': ['Charlotte', 'Raleigh', 'Greensboro'],
    'North Dakota': ['Fargo'],
    'Ohio': ['Columbus', 'Cleveland', 'Cincinnati'],
    'Oklahoma': ['Oklahoma City', 'Tulsa'],
    'Oregon': ['Portland', 'Salem'],
    'Pennsylvania': ['Philadelphia', 'Pittsburgh', 'Allentown'],
    'Rhode Island': ['Providence'],
    'South Carolina': ['Charleston', 'Columbia'],
    'South Dakota': ['Sioux Falls'],
    'Tennessee': ['Nashville', 'Memphis', 'Knoxville'],
    'Texas': ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth'],
    'Utah': ['Salt Lake City'],
    'Vermont': ['Burlington'],
    'Virginia': ['Virginia Beach', 'Norfolk', 'Chesapeake'],
    'Washington': ['Seattle', 'Spokane', 'Tacoma'],
    'West Virginia': ['Charleston'],
    'Wisconsin': ['Milwaukee', 'Madison'],
    'Wyoming': ['Cheyenne'],
};


// New stages
const stages: OpportunityStage[] = ['Primer contacto', 'Envió de Información', 'Envió de Cotización', 'Negociación', 'Cierre de venta'];
type ClientClassification = 'Prospecto' | 'Cliente potencial' | 'CLIENTE';

const prospectoSchema = z.object({
    clientName: z.string().min(1, 'El nombre del cliente es requerido.'),
    country: z.enum(['MEXICO', 'EUA'], { required_error: "Debe seleccionar un país."}),
    state: z.string().optional(),
    city: z.string().min(1, 'La ciudad es requerida.'),
    companyName: z.string().min(1, 'El nombre de la empresa es requerido.'),
    contactMethod: z.enum(['REDES SOCIALES', 'PUBLICIDAD', 'BUSQUEDA EN GOOGLE', 'BUSQUEDA EN MAPS'], { required_error: "Debe seleccionar una forma de contacto."}),
    website: z.string().url({ message: "URL de página web inválida." }).optional().or(z.literal('')),
    phone: z.string().optional(),
    email: z.string().email('Email inválido.').optional().or(z.literal('')),
    language: z.enum(['ESPAÑOL', 'INGLES'], { required_error: "Debe seleccionar un idioma."}),
    sellerId: z.string().min(1, { message: 'Por favor seleccione un vendedor.' }),
}).refine(data => {
    if (data.country === 'EUA') {
        return data.state && data.state.length > 0;
    }
    return true;
}, {
    message: 'El estado es requerido para EUA.',
    path: ['state'],
}).refine(data => {
    return !!data.website || !!data.phone || !!data.email;
}, {
    message: 'Debe proporcionar al menos una de las siguientes opciones: Página web, teléfono o email.',
    path: ['website']
});

const sellerUsers = users.filter(u => u.role === 'seller');
const contactMethods = ['REDES SOCIALES', 'PUBLICIDAD', 'BUSQUEDA EN GOOGLE', 'BUSQUEDA EN MAPS'];

// Helper function to get classification
const getClassification = (stage: OpportunityStage): ClientClassification => {
    if (stage === 'Primer contacto' || stage === 'Envió de Información') {
        return 'Prospecto';
    }
    if (stage === 'Envió de Cotización' || stage === 'Negociación') {
        return 'Cliente potencial';
    }
    if (stage === 'Cierre de venta') {
        return 'CLIENTE';
    }
    return 'Prospecto'; // Default
};


export default function PipelinePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>(initialOpportunities);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof prospectoSchema>>({
    resolver: zodResolver(prospectoSchema),
    defaultValues: {
      clientName: '',
      country: undefined,
      state: '',
      city: '',
      companyName: '',
      website: '',
      phone: '',
      email: '',
      language: undefined,
      sellerId: '',
    },
  });

  const watchedCountry = form.watch('country');
  const watchedState = form.watch('state');

  React.useEffect(() => {
    if (watchedCountry === 'MEXICO') {
        form.setValue('state', '');
    }
    form.setValue('city', '');
  }, [watchedCountry, form]);

  React.useEffect(() => {
    form.setValue('city', '');
  }, [watchedState, form]);

  const handleStageChange = (opportunityId: string, newStage: OpportunityStage) => {
    setOpportunities(prev =>
      prev.map(op => (op.id === opportunityId ? { ...op, stage: newStage } : op))
    );
  };

  function onSubmit(values: z.infer<typeof prospectoSchema>) {
    const region = values.country === 'EUA' && values.state
    ? `${values.city}, ${values.state}`
    : values.city;

    const newClient: Client = {
        id: `c-${Date.now()}`,
        numeroDeCliente: `C${String(Date.now()).slice(-4)}`,
        nombreDelCliente: values.companyName,
        region: region,
        sellerId: values.sellerId,
        createdAt: format(new Date(), 'yyyy-MM-dd'),
    };

    const newOpportunity: Opportunity = {
      id: `op-${Date.now()}`,
      name: `Oportunidad para ${values.companyName}`,
      clientId: newClient.id,
      sellerId: values.sellerId,
      stage: 'Primer contacto', // Set to the first new stage
      value: 0,
      currency: 'USD',
      closeDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    };
    
    setClients(prev => [newClient, ...prev]);
    setOpportunities(prev => [newOpportunity, ...prev]);

    setIsDialogOpen(false);
    form.reset();
  }
  
  // Combine client and their opportunity for easy rendering
  const clientProspects = clients.map(client => {
      const opportunity = opportunities.find(op => op.clientId === client.id);
      return {
          ...client,
          opportunity
      }
  }).filter(item => item.opportunity); // Only show clients with opportunities

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
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-6">
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

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>País</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione un país" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {countries.map((country) => (
                            <SelectItem key={country} value={country}>
                              {country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchedCountry === 'EUA' && (
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione un estado" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {usStates.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ciudad</FormLabel>
                      {watchedCountry === 'EUA' && watchedState ? (
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione una ciudad" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(citiesByState[watchedState] || []).map((city) => (
                              <SelectItem key={city} value={city}>
                                {city}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <FormControl>
                          <Input placeholder="Ej: Ciudad de México" {...field} />
                        </FormControl>
                      )}
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione un idioma" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {languages.map((lang) => (
                              <SelectItem key={lang} value={lang}>
                                {lang}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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

                <DialogFooter className='pt-4'>
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
        <Card>
            <CardHeader>
                <CardTitle>Seguimiento de Prospectos</CardTitle>
                <CardDescription>
                Administra el ciclo de vida de tus clientes, desde el primer contacto hasta el cierre.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre del Cliente</TableHead>
                            <TableHead>Clasificación</TableHead>
                            <TableHead>Etapa Actual</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {clientProspects.map(prospect => (
                            <TableRow key={prospect.id}>
                                <TableCell className="font-medium">{prospect.nombreDelCliente}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{getClassification(prospect.opportunity!.stage)}</Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {stages.map((stage, index) => {
                                            const currentIndex = stages.indexOf(prospect.opportunity!.stage);
                                            const isCompleted = index < currentIndex;
                                            const isCurrent = index === currentIndex;
                                            return (
                                                <React.Fragment key={stage}>
                                                    <div className='flex flex-col items-center gap-1'>
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isCompleted || isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                                            {index + 1}
                                                        </div>
                                                        <span className={`text-xs text-center ${isCurrent ? 'font-bold text-primary' : 'text-muted-foreground'}`}>{stage}</span>
                                                    </div>
                                                    {index < stages.length - 1 && <div className="flex-1 h-px bg-border mt-[-1.25rem]" />}
                                                </React.Fragment>
                                            )
                                        })}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                        <Button size="icon" variant="ghost">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                        {stages.map(stage => (
                                            <DropdownMenuItem
                                                key={stage}
                                                onSelect={() => handleStageChange(prospect.opportunity!.id, stage)}
                                            >
                                                Mover a: {stage}
                                            </DropdownMenuItem>
                                        ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
