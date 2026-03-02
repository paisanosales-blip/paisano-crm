'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc, collection } from 'firebase/firestore';

import {
  useFirestore,
  updateDocumentNonBlocking,
  useUser,
  useDoc,
  useMemoFirebase,
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
    state: z.string().optional(),
    city: z.string().optional(),
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

interface EditClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
}

export function EditClientDialog({ open, onOpenChange, client }: EditClientDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
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
      contactPerson: '', clientName: '', secondContact: false, secondContactName: '', secondContactPhone: '', isExternal: false, externalSellerId: '',
      country: '', state: '', city: '', contactMethod: '', language: '', clientType: '', website: '', phone: '', email: '',
    },
  });

  const externalSellerForClient = useMemo(() => {
    if (!client?.isExternal || !externalSellers) return null;
    return externalSellers.find(s => `${s.firstName} ${s.lastName}` === client.sellerName);
  }, [client, externalSellers]);


  useEffect(() => {
    if (client) {
      form.reset({
        ...client,
        isExternal: client.isExternal || false,
        externalSellerId: client.isExternal ? externalSellerForClient?.id : '',
        secondContact: !!client.secondContactName,
      });
    }
  }, [client, externalSellerForClient, form]);

  const { watch } = form;
  const selectedCountry = watch('country');
  const selectedState = watch('state');
  const isExternal = watch('isExternal');

  const availableStates = selectedCountry ? states[selectedCountry] || [] : [];
  const availableCities = selectedState ? cities[selectedState] || [] : [];

  function onSubmit(values: ProspectFormValues) {
    if (!firestore || !client?.id || !userProfile) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo encontrar el cliente para actualizar.' });
      return;
    }
    const leadRef = doc(firestore, 'leads', client.id);

    const { secondContact, externalSellerId, ...dataToUpdate } = values;

    let finalSellerName;
    if (values.isExternal && externalSellerId) {
        const selectedSeller = externalSellers?.find(s => s.id === externalSellerId);
        if (selectedSeller) {
            finalSellerName = `${selectedSeller.firstName} ${selectedSeller.lastName}`;
        } else {
            finalSellerName = client.sellerName; // Keep old name if new one not found
        }
    } else if (!values.isExternal && client.isExternal) { // Was external, now internal
        finalSellerName = `${userProfile.firstName} ${userProfile.lastName}`;
    } else {
        finalSellerName = client.sellerName; // No change
    }

    const finalData: any = {
        ...dataToUpdate,
        sellerName: finalSellerName
    };
    
    if (!secondContact) {
      finalData.secondContactName = '';
      finalData.secondContactPhone = '';
    }
    
    if (values.isExternal) {
      finalData.contactMethod = '';
    }

    updateDocumentNonBlocking(leadRef, finalData);
    
    toast({
      title: '¡Cliente Actualizado!',
      description: `${values.clientName} ha sido actualizado correctamente.`,
    });
    onOpenChange(false);
    form.reset();
  }
  
  const handleClose = (isOpen: boolean) => {
    if (form.formState.isSubmitting) return;
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl" onPointerDownOutside={(e) => { if (e.target instanceof HTMLElement && e.target.closest('[data-radix-popper-content-wrapper]')) { e.preventDefault(); } }}>
        <DialogHeader>
          <DialogTitle>EDITAR CLIENTE</DialogTitle>
          <DialogDescription>
            Actualice los detalles del cliente. Los cambios se guardarán automáticamente.
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
                    <FormLabel>Añadir Segundo Contacto</FormLabel>
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
                        <Input placeholder="Jane Doe" {...field} value={field.value || ''}/>
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
                        <Input placeholder="+1 (555) 987-6543" {...field} value={field.value || ''}/>
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
                        <Select onValueChange={field.onChange} value={field.value || ''}>
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
                  }} value={field.value}>
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
                  }} value={field.value} disabled={!selectedCountry}>
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
                      <Select onValueChange={field.onChange} value={field.value} >
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
                    <Button type="button" variant="secondary" disabled={form.formState.isSubmitting}>CANCELAR</Button>
                </DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
