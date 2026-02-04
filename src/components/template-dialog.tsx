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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Template } from '@/lib/types';

const templateSchema = z.object({
  name: z.string().min(1, 'El nombre de la plantilla es requerido.'),
  type: z.enum(['Email', 'WhatsApp', 'SMS'], { required_error: 'El tipo es requerido.' }),
  subject: z.string().optional(),
  content: z.string().min(1, 'El contenido no puede estar vacío.'),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Template | null;
}

export function TemplateDialog({ open, onOpenChange, template }: TemplateDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const isEditing = !!template;

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      type: 'Email',
      subject: '',
      content: '',
    },
  });

  const typeValue = form.watch('type');

  useEffect(() => {
    if (open) {
      if (isEditing && template) {
        form.reset(template);
      } else {
        form.reset({
          name: '',
          type: 'Email',
          subject: '',
          content: '',
        });
      }
    }
  }, [template, isEditing, open, form]);

  const handleClose = (isOpen: boolean) => {
    if (form.formState.isSubmitting) return;
    onOpenChange(isOpen);
  };

  function onSubmit(values: TemplateFormValues) {
    if (!firestore || !user || !userProfile) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debe iniciar sesión para administrar plantillas.',
      });
      return;
    }

    if (isEditing && template) {
      const templateRef = doc(firestore, 'templates', template.id);
      updateDocumentNonBlocking(templateRef, values);
      toast({
        title: '¡Plantilla Actualizada!',
        description: `La plantilla ${values.name} ha sido actualizada.`,
      });
    } else {
      const templateData = {
        ...values,
        sellerId: user.uid,
        sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
        createdAt: new Date().toISOString(),
      };
      addDocumentNonBlocking(collection(firestore, 'templates'), templateData);
      toast({
        title: '¡Plantilla Creada!',
        description: `La plantilla ${values.name} ha sido agregada.`,
      });
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl" onPointerDownOutside={(e) => { if (e.target instanceof HTMLElement && e.target.closest('[data-radix-popper-content-wrapper]')) { e.preventDefault(); } }}>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'EDITAR' : 'NUEVA'} PLANTILLA DE MENSAJE</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Actualice los detalles de la plantilla.' : 'Cree una nueva plantilla para usar en correos, WhatsApp, etc.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Plantilla</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Primer Contacto - Email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Seleccione un tipo" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="Email">Email</SelectItem>
                            <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                            <SelectItem value="SMS">SMS</SelectItem>
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            {typeValue === 'Email' && (
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asunto del Correo (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Información sobre nuestros productos" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contenido de la Plantilla</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Escriba aquí el cuerpo del mensaje..." {...field} className="min-h-[200px]" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={form.formState.isSubmitting}>CANCELAR</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'GUARDANDO...' : (isEditing ? 'GUARDAR CAMBIOS' : 'CREAR PLANTILLA')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
