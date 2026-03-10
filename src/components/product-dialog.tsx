'use client';

import { useEffect, useState } from 'react';
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
import { generateProductSummary } from '@/ai/flows/generate-product-summary';
import { Sparkles, Loader2 } from 'lucide-react';

const productSchema = z.object({
  name: z.string().min(1, 'El nombre del producto es requerido.'),
  description: z.string().optional(),
  summary: z.string().optional(),
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
  const [isGenerating, setIsGenerating] = useState(false);

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
      summary: '',
      price: 0,
      currency: 'USD',
    },
  });
  
  const descriptionValue = form.watch('description');

  useEffect(() => {
    if (open) {
      if (isEditing && product) {
        form.reset(product);
      } else {
        form.reset({
          name: '',
          description: '',
          summary: '',
          price: 0,
          currency: 'USD',
        });
      }
    }
  }, [product, isEditing, open, form]);

  const handleClose = (isOpen: boolean) => {
    if (form.formState.isSubmitting || isGenerating) return;
    onOpenChange(isOpen);
  };
  
  const handleGenerateSummary = async () => {
    const description = form.getValues('description');
    if (!description) {
      toast({
        variant: 'destructive',
        title: 'Descripción requerida',
        description: 'Por favor, escriba una descripción antes de generar un resumen.',
      });
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generateProductSummary({ description });
      form.setValue('summary', result.summary);
      toast({
        title: 'Resumen generado',
        description: 'La IA ha creado un resumen del producto.',
      });
    } catch (error) {
      console.error("Error generating summary:", error);
      toast({
        variant: 'destructive',
        title: 'Error de IA',
        description: 'No se pudo generar el resumen.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  function onSubmit(values: ProductFormValues) {
    if (!firestore || !user || !userProfile) {
      return;
    }

    if (isEditing && product) {
      const productRef = doc(firestore, 'products', product.id);
      updateDocumentNonBlocking(productRef, values);
    } else {
      const productData = {
        ...values,
        sellerId: user.uid,
        sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
        createdAt: new Date().toISOString(),
      };
      addDocumentNonBlocking(collection(firestore, 'products'), productData);
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
             <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                   <div className="flex justify-between items-center">
                    <FormLabel>Resumen para Cotización (IA)</FormLabel>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateSummary}
                        disabled={isGenerating || !descriptionValue}
                    >
                        {isGenerating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        Generar Resumen
                    </Button>
                  </div>
                  <FormControl>
                    <Textarea placeholder="Resumen generado por IA para mostrar en la cotización..." {...field} />
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
                <Button type="button" variant="secondary" disabled={form.formState.isSubmitting || isGenerating}>CANCELAR</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting || isGenerating}>
                {form.formState.isSubmitting ? 'GUARDANDO...' : (isEditing ? 'GUARDAR CAMBIOS' : 'CREAR PRODUCTO')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
