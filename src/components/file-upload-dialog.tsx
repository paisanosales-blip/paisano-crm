'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, doc } from 'firebase/firestore';
import { useFirestore, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, useStorage } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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
import { UploadCloud } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const fileUploadSchema = z.object({
  file: z.instanceof(File).optional(),
  description: z.string().optional(),
}).refine(data => !!data.file, {
  message: 'Se requiere un archivo.',
  path: ['file'],
});


type FileUploadFormValues = z.infer<typeof fileUploadSchema>;

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FileUploadDialog({ open, onOpenChange }: FileUploadDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const form = useForm<FileUploadFormValues>({
    resolver: zodResolver(fileUploadSchema),
  });

  const { watch, reset } = form;
  const selectedFile = watch('file');
  
  const handleClose = (isOpen: boolean) => {
    if (isSubmitting) return;
    if (!isOpen) {
      reset();
    }
    onOpenChange(isOpen);
  };

  function onSubmit(values: FileUploadFormValues) {
    if (!firestore || !user || !userProfile || !storage || !values.file) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se puede subir el archivo. Verifique su sesión y que haya seleccionado un archivo.',
      });
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    const file = values.file;
    const storageRef = ref(storage, `shared-files/${user.uid}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Upload failed:', error);
          toast({ variant: 'destructive', title: 'Error de Subida', description: 'No se pudo subir el archivo.' });
          setIsSubmitting(false);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            const fileData = {
              fileName: file.name,
              fileUrl: downloadURL,
              fileType: file.type,
              fileSize: file.size,
              uploadedByUserId: user.uid,
              uploadedByUserName: `${userProfile.firstName} ${userProfile.lastName}`,
              createdAt: new Date().toISOString(),
              description: values.description || '',
            };

            addDocumentNonBlocking(collection(firestore, 'sharedFiles'), fileData);

            toast({ title: '¡Archivo Subido!', description: `${file.name} ha sido compartido.` });
            onOpenChange(false);
          }).catch((urlError) => {
            console.error('Get URL failed:', urlError);
            toast({ variant: 'destructive', title: 'Error de Guardado', description: 'El archivo se subió pero no se pudo guardar el registro.' });
          }).finally(() => {
            setIsSubmitting(false);
            reset();
          });
        }
      );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Subir un Nuevo Archivo</DialogTitle>
          <DialogDescription>
            Seleccione un archivo y agregue una descripción opcional para compartirlo con el equipo.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
             <FormField
              control={form.control}
              name="file"
              render={({ field: { onChange } }) => (
                <FormItem>
                  <FormLabel>Archivo</FormLabel>
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
                                    onChange={(e) => onChange(e.target.files?.[0])}
                                    disabled={isSubmitting}
                                />
                                </label>
                            </div>
                            <p className="text-xs text-muted-foreground">Cualquier tipo de archivo, hasta 50MB</p>
                            {selectedFile?.name && <p className="text-xs font-semibold text-foreground">{selectedFile.name}</p>}
                        </div>
                    </div>
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
                    <Textarea placeholder="Breve descripción del contenido o propósito del archivo..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isSubmitting && <Progress value={uploadProgress} />}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={isSubmitting}>CANCELAR</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting || !selectedFile}>
                {isSubmitting ? 'Subiendo...' : 'SUBIR ARCHIVO'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
