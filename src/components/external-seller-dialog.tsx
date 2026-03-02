'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc, collection } from 'firebase/firestore';

import { useFirestore, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

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
import type { ExternalSeller } from '@/lib/types';


const externalSellerSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido.'),
  lastName: z.string().min(1, 'El apellido es requerido.'),
  phone: z.string().optional(),
});

type ExternalSellerFormValues = z.infer<typeof externalSellerSchema>;

interface ExternalSellerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seller?: ExternalSeller | null;
}

export function ExternalSellerDialog({ open, onOpenChange, seller }: ExternalSellerDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const isEditing = !!seller;

  const form = useForm<ExternalSellerFormValues>({
    resolver: zodResolver(externalSellerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (isEditing && seller) {
        form.reset(seller);
      } else {
        form.reset({
          firstName: '',
          lastName: '',
          phone: '',
        });
      }
    }
  }, [seller, isEditing, open, form]);

  const handleClose = (isOpen: boolean) => {
    if (form.formState.isSubmitting) return;
    onOpenChange(isOpen);
  };

  function onSubmit(values: ExternalSellerFormValues) {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo conectar a la base de datos.' });
      return;
    }

    if (isEditing && seller) {
      const sellerRef = doc(firestore, 'externalSellers', seller.id);
      updateDocumentNonBlocking(sellerRef, values);
      toast({
        title: '¡Vendedor Actualizado!',
        description: `Los datos de ${values.firstName} ${values.lastName} han sido actualizados.`,
      });
    } else {
      addDocumentNonBlocking(collection(firestore, 'externalSellers'), values);
      toast({
        title: '¡Vendedor Creado!',
        description: `${values.firstName} ${values.lastName} ha sido agregado como vendedor externo.`,
      });
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Vendedor Externo</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Actualice los detalles del vendedor.' : 'Complete los detalles para agregar un nuevo vendedor externo.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                        <Input {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Apellido</FormLabel>
                    <FormControl>
                        <Input {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 (555) 123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
                <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={form.formState.isSubmitting}>CANCELAR</Button>
                </DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? 'GUARDANDO...' : (isEditing ? 'GUARDAR CAMBIOS' : 'CREAR VENDEDOR')}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
