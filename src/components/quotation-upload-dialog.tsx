'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useStorage, useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
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

const quotationSchema = z.object({
    value: z.coerce.number().min(1, 'El valor es requerido.'),
    currency: z.string().min(2, 'La moneda es requerida.').default('USD'),
    pdf: z.instanceof(File).refine(file => file?.size > 0, 'Se requiere un archivo PDF.'),
});

type QuotationFormValues = z.infer<typeof quotationSchema>;

interface QuotationUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  opportunityName: string;
  opportunityId: string;
}

export function QuotationUploadDialog({
  open,
  onOpenChange,
  onConfirm,
  opportunityName,
  opportunityId,
}: QuotationUploadDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const [isUploading, setIsUploading] = useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const form = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      value: 0,
      currency: 'USD',
    },
  });

  async function onSubmit(values: QuotationFormValues) {
    if (!firestore || !storage || !user || !userProfile) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo conectar con Firebase.',
      });
      return;
    }

    setIsUploading(true);

    try {
      // 1. Upload PDF to Firebase Storage
      const pdfFile = values.pdf;
      const storageRef = ref(storage, `quotations/${opportunityId}/${pdfFile.name}`);
      const uploadResult = await uploadBytes(storageRef, pdfFile);
      const pdfUrl = await getDownloadURL(uploadResult.ref);

      // 2. Create Quotation document in Firestore
      const quotationData = {
        opportunityId,
        sellerId: user.uid,
        sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
        pdfUrl,
        value: values.value,
        currency: values.currency,
        version: '1', // Start with version 1
        status: 'Enviada',
        createdDate: new Date().toISOString(),
      };
      
      addDocumentNonBlocking(collection(firestore, 'quotations'), quotationData);

      // 3. Update Opportunity stage
      const opportunityRef = doc(firestore, 'opportunities', opportunityId);
      updateDocumentNonBlocking(opportunityRef, {
        stage: 'Envió de Cotización',
      });
      
      toast({
        title: '¡Cotización Enviada!',
        description: `La cotización para ${opportunityName} ha sido cargada y el prospecto movido.`,
      });

      onConfirm();
      form.reset();
      onOpenChange(false);

    } catch (error) {
      console.error('Error uploading quotation:', error);
      toast({
        variant: 'destructive',
        title: 'Error al cargar cotización',
        description:
          'Ocurrió un problema al guardar los datos. Por favor, inténtelo de nuevo.',
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cargar Cotización para {opportunityName}</DialogTitle>
          <DialogDescription>
            Complete los detalles y cargue el archivo PDF para mover el prospecto a la etapa de "Envió de Cotización".
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
              render={({ field: { onChange, value, ...rest } }) => (
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
                             {value?.name && <p className="text-xs font-semibold text-foreground">{value.name}</p>}
                        </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isUploading}>
                {isUploading ? 'Cargando...' : 'Confirmar y Mover'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
