'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { UploadCloud } from 'lucide-react';
import type { Quotation } from '@/lib/types';


const quotationSchema = z.object({
    value: z.coerce.number().min(1, 'El valor es requerido.'),
    currency: z.string().min(2, 'La moneda es requerida.').default('USD'),
    pdf: z.instanceof(File).optional(),
});

export type QuotationFormValues = z.infer<typeof quotationSchema>;

interface QuotationUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (values: QuotationFormValues) => void;
  opportunityName: string;
  quotation?: Quotation | null;
  isUploading: boolean;
}

export function QuotationUploadDialog({
  open,
  onOpenChange,
  onConfirm,
  opportunityName,
  quotation,
  isUploading,
}: QuotationUploadDialogProps) {
  const isEditing = !!quotation;
  
  const finalQuotationSchema = isEditing
    ? quotationSchema
    : quotationSchema.refine((data) => data.pdf, {
        message: 'Se requiere un archivo PDF.',
        path: ['pdf'],
      });


  const form = useForm<QuotationFormValues>({
    resolver: zodResolver(finalQuotationSchema),
    defaultValues: {
      value: 0,
      currency: 'USD',
    },
  });

  const { formState: { errors }, watch } = form;
  const pdfValue = watch('pdf');


  React.useEffect(() => {
    if (open) {
      if (isEditing && quotation) {
        form.reset({
          value: quotation.value,
          currency: quotation.currency,
          pdf: undefined,
        });
      } else {
        form.reset({
          value: 0,
          currency: 'USD',
          pdf: undefined,
        });
      }
    }
  }, [open, isEditing, quotation, form]);

  function onSubmit(values: QuotationFormValues) {
    onConfirm(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Cargar'} Cotización para {opportunityName}</DialogTitle>
          <DialogDescription>
            {isEditing 
                ? 'Actualice los detalles de la cotización. Puede cargar un nuevo PDF para reemplazar el existente.' 
                : 'Complete los detalles y cargue el archivo PDF para mover el prospecto a la etapa de "Envió de Cotización".'
            }
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    <FormControl>
                        <Input placeholder="USD" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            
            <FormField
              control={form.control}
              name="pdf"
              render={({ field: { onChange, ...rest } }) => (
                <FormItem>
                  <FormLabel>Archivo PDF de la Cotización</FormLabel>
                  <FormControl>
                     <div className="relative flex justify-center w-full h-32 px-6 pt-5 pb-6 border-2 border-dashed rounded-md border-border">
                        <div className="space-y-1 text-center">
                            <UploadCloud className="w-12 h-12 mx-auto text-muted-foreground" />
                            <div className="flex text-sm text-muted-foreground">
                                <label
                                htmlFor="file-upload"
                                className="relative font-medium bg-transparent rounded-md cursor-pointer text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:text-primary/80"
                                >
                                <span>Cargue un archivo</span>
                                <Input 
                                    id="file-upload" 
                                    type="file" 
                                    className="sr-only" 
                                    accept=".pdf"
                                    onChange={(e) => onChange(e.target.files?.[0])}
                                />
                                </label>
                                <p className="pl-1">o arrastre y suelte</p>
                            </div>
                            <p className="text-xs text-muted-foreground">PDF hasta 10MB</p>
                            {isEditing && !pdfValue?.name && quotation?.pdfUrl && (
                                <p className="text-xs font-semibold text-foreground mt-1">
                                    Archivo actual: <a href={quotation.pdfUrl} target="_blank" rel="noopener noreferrer" className="underline">Ver PDF</a>
                                </p>
                            )}
                             {pdfValue?.name && <p className="text-xs font-semibold text-foreground">{pdfValue.name}</p>}
                        </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isUploading}>
                {isUploading ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Confirmar y Mover')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
