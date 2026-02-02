'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc, collection } from 'firebase/firestore';
import { useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
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
import { Textarea } from '@/components/ui/textarea';
import type { Product } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const productSchema = z.object({
  name: z.string().min(1, 'El nombre del producto es requerido.'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'El precio debe ser un número positivo.'),
  currency: z.string().min(2, 'La moneda es requerida.').default('USD'),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

export function ProductDialog({ open, onOpenChange, product }: ProductDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const isEditing = !!product;

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      currency: 'USD',
    },
  });

  useEffect(() => {
    if (open) {
      if (isEditing && product) {
        form.reset(product);
      } else {
        form.reset({
          name: '',
          description: '',
          price: 0,
          currency: 'USD',
        });
      }
    }
  }, [product, isEditing, open, form]);

  const handleClose = (isOpen: boolean) => {
    if (form.formState.isSubmitting) return;
    onOpenChange(isOpen);
  };

  function onSubmit(values: ProductFormValues) {
    if (!firestore || !user || !userProfile) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debe iniciar sesión para administrar productos.',
      });
      return;
    }

    if (isEditing && product) {
      const productRef = doc(firestore, 'products', product.id);
      updateDocumentNonBlocking(productRef, values);
      toast({
        title: '¡Producto Actualizado!',
        description: `El producto ${values.name} ha sido actualizado.`,
      });
    } else {
      const productData = {
        ...values,
        sellerId: user.uid,
        sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
        createdAt: new Date().toISOString(),
      };
      addDocumentNonBlocking(collection(firestore, 'products'), productData);
      toast({
        title: '¡Producto Creado!',
        description: `El producto ${values.name} ha sido agregado.`,
      });
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[525px]" onPointerDownOutside={(e) => { if (e.target instanceof HTMLElement && e.target.closest('[data-radix-popper-content-wrapper]')) { e.preventDefault(); } }}>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'EDITAR' : 'NUEVO'} PRODUCTO</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Actualice los detalles del producto.' : 'Complete los detalles para agregar un nuevo producto.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Producto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Remolque cuello de ganso" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describa las características del producto..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio</FormLabel>
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={form.formState.isSubmitting}>CANCELAR</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'GUARDANDO...' : (isEditing ? 'GUARDAR CAMBIOS' : 'CREAR PRODUCTO')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
