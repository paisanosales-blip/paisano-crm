'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusCircle } from 'lucide-react';
import { collection, doc, addDoc } from 'firebase/firestore';

import {
  useFirestore,
  useUser,
  useDoc,
  useMemoFirebase,
  errorEmitter,
  FirestorePermissionError,
  useCollection,
} from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { countries, states, cities } from '@/lib/geography';
import type { ExternalSeller } from '@/lib/types';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from './ui/checkbox';

const contactMethods = [
  'REDES SOCIALES',
  'PUBLICIDAD',
  'BUSQUEDA EN GOOGLE',
  'BUSQUEDA EN MAPS',
];

const prospectSchema = z
  .object({
    contactPerson: z.string().min(1, 'El nombre del cliente es requerido.'),
    clientName: z.string().min(1, 'El nombre de la empresa es requerido.'),
    secondContact: z.boolean().default(false),
    secondContactName: z.string().optional(),
    secondContactPhone: z.string().optional(),
    isExternal: z.boolean().default(false),
    externalSellerId: z.string().optional(),
    country: z.string().min(1, 'El país es requerido.'),
    state: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    contactMethod: z.string().optional(),
    language: z.string().min(1, 'El idioma es requerido.'),
    clientType: z.string().min(1, 'El tipo de cliente es requerido.'),
    website: z.preprocess(
      (val) => {
        if (typeof val !== 'string' || !val) {
          return val;
        }
        if (!val.startsWith('http://') && !val.startsWith('https://')) {
          return `https://${val}`;
        }
        return val;
      },
      z.string().url({ message: 'URL de sitio web inválida.' }).optional().or(z.literal(''))
    ),
    phone: z.string().optional(),
    email: z.string().email({ message: 'Correo electrónico inválido.' }).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (!data.website && !data.phone && !data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'], // Add error to one of the fields
        message:
          'Se requiere al menos un método de contacto (email, teléfono o sitio web).',
      });
    }
    if (data.secondContact && !data.secondContactName) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['secondContactName'],
            message: 'El nombre del segundo contacto es requerido si la opción está activada.',
        });
    }
    if (data.isExternal && !data.externalSellerId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['externalSellerId'],
            message: 'Debe seleccionar un vendedor externo.',
        });
    }
    if (!data.isExternal && !data.contactMethod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contactMethod'],
        message: 'La forma de contacto es requerida.',
      });
    }
  });

type ProspectFormValues = z.infer<typeof prospectSchema>;

interface NewProspectDialogProps {
  onSuccess: (lead: any) => void;
}

export function NewProspectDialog({ onSuccess }: NewProspectDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [open, setOpen] = useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const externalSellersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'externalSellers');
  }, [firestore]);
  const { data: externalSellers } = useCollection<ExternalSeller>(externalSellersQuery);

  const form = useForm<ProspectFormValues>({
    resolver: zodResolver(prospectSchema),
    defaultValues: {
      contactPerson: '',
      clientName: '',
      secondContact: false,
      secondContactName: '',
      secondContactPhone: '',
      isExternal: false,
      externalSellerId: '',
      country: '',
      state: '',
      city: '',
      contactMethod: '',
      language: 'Español',
      clientType: '',
      website: '',
      phone: '',
      email: '',
    },
  });

  const { watch } = form;
  const selectedCountry = watch('country');
  const selectedState = watch('state');
  const isExternal = watch('isExternal');

  const availableStates = selectedCountry ? states[selectedCountry] || [] : [];
  const availableCities = selectedState ? cities[selectedState] || [] : [];

  async function onSubmit(values: ProspectFormValues) {
    if (!firestore || !user || !userProfile) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debe iniciar sesión para crear un prospecto.',
      });
      return;
    }
    
    form.clearErrors();
    
    const { secondContact, externalSellerId, ...dataToSubmit } = values;

    let sellerName;
    if (values.isExternal) {
        const selectedExternalSeller = externalSellers?.find(s => s.id === externalSellerId);
        sellerName = selectedExternalSeller ? `${selectedExternalSeller.firstName} ${selectedExternalSeller.lastName}` : 'Vendedor Externo';
    } else {
        sellerName = `${userProfile.firstName} ${userProfile.lastName}`;
    }

    const leadData: any = {
      ...dataToSubmit,
      sellerId: user.uid,
      sellerName,
      status: 'New',
      createdDate: new Date().toISOString(),
      clienteNumber: '',
      region: '',
    };
    
    if (!secondContact) {
        leadData.secondContactName = '';
        leadData.secondContactPhone = '';
    }
    
    if (values.isExternal) {
      leadData.contactMethod = '';
    }
    
    try {
      const leadRef = await addDoc(collection(firestore, 'leads'), leadData);

      toast({
        title: '¡Prospecto Creado!',
        description: `${values.clientName.toUpperCase()} ha sido agregado. Ahora registre el primer contacto.`,
      });
      onSuccess({ ...leadData, id: leadRef.id });
      setOpen(false);
      form.reset();
    } catch (error) {
        const permissionError = new FirestorePermissionError({
          path: 'leads',
          operation: 'create',
          requestResourceData: leadData,
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'Error al crear prospecto',
          description: 'Ocurrió un problema al guardar los datos. Por favor, inténtelo de nuevo.',
        });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          NUEVO PROSPECTO
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl" onPointerDownOutside={(e) => { if (e.target instanceof HTMLElement && e.target.closest('[data-radix-popper-content-wrapper]')) { e.preventDefault(); } }}>
        <DialogHeader>
          <DialogTitle>CREAR NUEVO PROSPECTO</DialogTitle>
          <DialogDescription>
            Complete los detalles a continuación para agregar un nuevo prospecto a su flujo de ventas.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-6 gap-x-4 gap-y-6 py-4">
            <FormField
              control={form.control}
              name="contactPerson"
              render={({ field }) => (
                <FormItem className="col-span-6 sm:col-span-3">
                  <FormLabel>NOMBRE DEL CLIENTE</FormLabel>
                  <FormControl>
                    <Input placeholder="Juan Pérez" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem className="col-span-6 sm:col-span-3">
                  <FormLabel>NOMBRE DE EMPRESA</FormLabel>
                  <FormControl>
                    <Input placeholder="Constructora Acme" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="col-span-6">
              <FormField
                control={form.control}
                name="secondContact"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0 pt-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel>SEGUNDO CONTACTO</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            {form.watch('secondContact') && (
              <>
                <FormField
                  control={form.control}
                  name="secondContactName"
                  render={({ field }) => (
                    <FormItem className="col-span-6 sm:col-span-3">
                      <FormLabel>NOMBRE SEGUNDO CONTACTO</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="secondContactPhone"
                  render={({ field }) => (
                    <FormItem className="col-span-6 sm:col-span-3">
                      <FormLabel>TELÉFONO SEGUNDO CONTACTO</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 (555) 987-6543" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            
            <div className="col-span-6">
              <FormField
                control={form.control}
                name="isExternal"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0 pt-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel>Vendedor Externo (No cuenta como cliente propio)</FormLabel>
                  </FormItem>
                )}
              />
            </div>

             {form.watch('isExternal') && (
                <FormField
                    control={form.control}
                    name="externalSellerId"
                    render={({ field }) => (
                    <FormItem className="col-span-6 sm:col-span-3">
                        <FormLabel>Vendedor Externo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Seleccione un vendedor externo" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {externalSellers?.map(seller => (
                                <SelectItem key={seller.id} value={seller.id}>{seller.firstName} {seller.lastName}</SelectItem>
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
              name="country"
              render={({ field }) => (
                <FormItem className="col-span-6 sm:col-span-2">
                  <FormLabel>PAÍS</FormLabel>
                  <Select onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue('state', '');
                    form.setValue('city', '');
                  }} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un país" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name}
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
              name="state"
              render={({ field }) => (
                <FormItem className="col-span-6 sm:col-span-2">
                  <FormLabel>ESTADO</FormLabel>
                  <Select onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue('city', '');
                  }} value={field.value || ''} disabled={!selectedCountry}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un estado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableStates.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.name}
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
                name="city"
                render={({ field }) => (
                  <FormItem key={selectedState} className="col-span-6 sm:col-span-2">
                    <FormLabel>CIUDAD</FormLabel>
                    {selectedState && availableCities.length > 0 ? (
                      <Select onValueChange={field.onChange} value={field.value || ''} >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione una ciudad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableCities.map(city => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl>
                        <Input placeholder="Ciudad" {...field} value={field.value || ''} disabled={!selectedState} />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            
            {!isExternal && (
              <FormField
                control={form.control}
                name="contactMethod"
                render={({ field }) => (
                  <FormItem className="col-span-6 sm:col-span-2">
                    <FormLabel>FORMA DE CONTACTO</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione una opción" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contactMethods.map((method) => (
                          <SelectItem key={method} value={method}>{method}</SelectItem>
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
              name="language"
              render={({ field }) => (
                <FormItem className={cn("col-span-6", isExternal ? "sm:col-span-3" : "sm:col-span-2")}>
                  <FormLabel>IDIOMA</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un idioma" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Español">ESPAÑOL</SelectItem>
                      <SelectItem value="Inglés">INGLÉS</SelectItem>
                      <SelectItem value="Bilingüe">BILINGÜE</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
              <FormField
              control={form.control}
              name="clientType"
              render={({ field }) => (
                <FormItem className={cn("col-span-6", isExternal ? "sm:col-span-3" : "sm:col-span-2")}>
                  <FormLabel>TIPO DE CLIENTE</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Dealer">Dealer</SelectItem>
                      <SelectItem value="EMPRESA DE TRANSPORTE">EMPRESA DE TRANSPORTE</SelectItem>
                      <SelectItem value="Sand Industry">Sand Industry</SelectItem>
                      <SelectItem value="USUARIO FINAL">USUARIO FINAL</SelectItem>
                      <SelectItem value="De construccion">De construccion</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem className="col-span-6 sm:col-span-2">
                  <FormLabel>PÁGINA WEB</FormLabel>
                  <FormControl>
                    <Input placeholder="ejemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem className="col-span-6 sm:col-span-2">
                  <FormLabel>TELÉFONO</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 (555) 123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="col-span-6 sm:col-span-2">
                  <FormLabel>EMAIL</FormLabel>
                  <FormControl>
                    <Input placeholder="contacto@ejemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="col-span-6 pt-4">
                <DialogClose asChild>
                    <Button type="button" variant="secondary">CANCELAR</Button>
                </DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? 'GUARDANDO...' : 'GUARDAR PROSPECTO'}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
