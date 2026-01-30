'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useUser, useFirestore, useStorage, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Progress } from '@/components/ui/progress';

const profileSchema = z.object({
  picture: z.instanceof(File).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSettingsDialog({
  open,
  onOpenChange,
}: ProfileSettingsDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile } = useDoc(userProfileRef);
  
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  });

  const { watch } = form;
  const pictureFile = watch('picture');

  React.useEffect(() => {
    if (open) {
      form.reset({ picture: undefined });
    }
  }, [open, form]);
  
  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName) return '...';
    return `${firstName.charAt(0)}${lastName ? lastName.charAt(0) : ''}`.toUpperCase();
  };

  function onSubmit(values: ProfileFormValues) {
    if (!values.picture) {
        toast({
            variant: 'destructive',
            title: 'No se seleccionó ninguna imagen',
            description: 'Por favor, elija un archivo para cargar.',
        });
        return;
    }
    if (!firestore || !storage || !user) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo conectar con Firebase.' });
      return;
    }
  
    setIsSubmitting(true);
    setUploadProgress(0);

    const file = values.picture;
    const storageRef = ref(storage, `profile-pictures/${user.uid}/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        toast({ variant: 'destructive', title: 'Error de Subida', description: 'Ocurrió un problema al subir el archivo. Inténtelo de nuevo.' });
        setIsSubmitting(false);
        setUploadProgress(0);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            const userDocRef = doc(firestore, 'users', user.uid);
            updateDocumentNonBlocking(userDocRef, { avatarUrl: downloadURL });
            toast({
                title: '¡Foto de Perfil Actualizada!',
                description: 'Tu nueva foto de perfil se ha guardado.',
            });
            onOpenChange(false);
            setIsSubmitting(false);
            setUploadProgress(0);
        }).catch((urlError) => {
            toast({ variant: 'destructive', title: 'Error al obtener URL', description: 'La imagen se subió, pero falló el guardado en la base de datos.' });
            setIsSubmitting(false);
            setUploadProgress(0);
        });
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configuración de Perfil</DialogTitle>
          <DialogDescription>
            Actualice su información personal y foto de perfil.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-4 py-4">
            <Avatar className="h-20 w-20">
                <AvatarImage src={userProfile?.avatarUrl} alt={userProfile?.firstName} />
                <AvatarFallback className="text-3xl">
                    {getInitials(userProfile?.firstName, userProfile?.lastName)}
                </AvatarFallback>
            </Avatar>
            <div>
                <p className="font-semibold">{userProfile?.firstName} {userProfile?.lastName}</p>
                <p className="text-sm text-muted-foreground">{userProfile?.email}</p>
            </div>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="picture"
              render={({ field: { onChange } }) => (
                <FormItem>
                  <FormLabel>Foto de Perfil</FormLabel>
                  <FormControl>
                     <div className="relative flex justify-center w-full h-32 px-6 pt-5 pb-6 border-2 border-dashed rounded-md border-border">
                        <div className="space-y-1 text-center">
                            <UploadCloud className="w-12 h-12 mx-auto text-muted-foreground" />
                            <div className="flex text-sm text-muted-foreground">
                                <label
                                htmlFor="picture-upload"
                                className="relative font-medium bg-transparent rounded-md cursor-pointer text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:text-primary/80"
                                >
                                <span>Cargue un archivo</span>
                                <Input 
                                    id="picture-upload" 
                                    type="file" 
                                    className="sr-only" 
                                    accept="image/*"
                                    onChange={(e) => onChange(e.target.files?.[0])}
                                    disabled={isSubmitting}
                                />
                                </label>
                                <p className="pl-1">o arrastre y suelte</p>
                            </div>
                            <p className="text-xs text-muted-foreground">PNG, JPG, GIF hasta 10MB</p>
                            {pictureFile?.name && <p className="text-xs font-semibold text-foreground">{pictureFile.name}</p>}
                        </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {isSubmitting && <Progress value={uploadProgress} className="w-full mt-2" />}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || !pictureFile}>
                {isSubmitting ? `Guardando... ${Math.round(uploadProgress)}%` : 'Guardar Foto'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    