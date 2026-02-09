'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useStorage } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import type { TaskCompletionData } from '@/lib/types';

const taskCompletionSchema = z.object({
  title: z.string().min(1, 'El título es requerido.'),
  text: z.string().min(1, 'El texto de la publicación es requerido.'),
  file: z.instanceof(File).optional(),
});

type TaskCompletionFormValues = z.infer<typeof taskCompletionSchema>;

interface MarketingTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: TaskCompletionData) => void;
  taskDescription: string;
  initialData?: TaskCompletionData | null;
}

export function MarketingTaskDialog({
  open,
  onOpenChange,
  onConfirm,
  taskDescription,
  initialData,
}: MarketingTaskDialogProps) {
  const storage = useStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const isEditing = !!initialData;

  const form = useForm<TaskCompletionFormValues>({
    resolver: zodResolver(taskCompletionSchema),
    defaultValues: {
      title: '',
      text: '',
      file: undefined,
    },
  });
  
  useEffect(() => {
    if(open) {
      if (isEditing && initialData) {
        form.reset({
          title: initialData.title,
          text: initialData.text,
          file: undefined,
        });
      } else {
        form.reset({title: '', text: '', file: undefined});
      }
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  }, [open, form, isEditing, initialData]);

  function onSubmit(values: TaskCompletionFormValues) {
    if (values.file && !storage) {
        toast({ variant: 'destructive', title: 'Error', description: 'Servicio de almacenamiento no disponible.' });
        return;
    }
    
    setIsSubmitting(true);
    
    const performConfirm = (fileUrl?: string, fileName?: string) => {
        onConfirm({
            title: values.title,
            text: values.text,
            fileUrl,
            fileName,
        });
        toast({ title: isEditing ? '¡Tarea Actualizada!' : '¡Tarea Completada!', description: 'El registro de la tarea ha sido guardado.' });
        onOpenChange(false);
    };
    
    if (values.file) {
      setUploadProgress(0);
      const file = values.file;
      const storageRef = ref(storage!, `marketing_uploads/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          toast({ variant: 'destructive', title: 'Error de Subida', description: 'No se pudo subir el archivo.' });
          setIsSubmitting(false);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            performConfirm(downloadURL, file.name);
          });
        }
      );
    } else {
        // If editing and no new file is provided, keep the old file info
        const existingFileUrl = isEditing ? initialData?.fileUrl : undefined;
        const existingFileName = isEditing ? initialData?.fileName : undefined;
        performConfirm(existingFileUrl, existingFileName);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Completar'} Tarea de Marketing</DialogTitle>
          <DialogDescription>
            <span className="font-semibold">Tarea:</span> "{taskDescription}"
            <br />
            {isEditing ? 'Modifique los detalles de la publicación.' : 'Llene los siguientes campos para marcar la tarea como completada.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título de la Publicación</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. ¡Conoce nuestro nuevo remolque!" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Texto de la Publicación</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe tu publicación aquí..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="file"
              render={({ field: { onChange, value, ...rest } }) => (
                <FormItem>
                  <FormLabel>{isEditing ? 'Reemplazar Foto o Video (Opcional)' : 'Adjuntar Foto o Video (Opcional)'}</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      {...rest}
                      onChange={(e) => {
                        onChange(e.target.files ? e.target.files[0] : null);
                      }}
                    />
                  </FormControl>
                  {isEditing && initialData?.fileUrl && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Archivo actual: <a href={initialData.fileUrl} target="_blank" rel="noopener noreferrer" className="underline">{initialData.fileName || 'Ver archivo'}</a>
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
             {isSubmitting && uploadProgress > 0 && <Progress value={uploadProgress} />}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Completar Tarea')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
