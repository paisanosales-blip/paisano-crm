'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { Upload } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useUser,
  useFirestore,
  useStorage,
  useDoc,
  useMemoFirebase,
  setDocumentNonBlocking,
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';

export function IconSwitcher({ className }: { className?: string }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);
  const isManager = userProfile?.role?.toLowerCase() === 'manager';

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'app');
  }, [firestore]);
  const { data: appSettings, isLoading } = useDoc(settingsRef);

  React.useEffect(() => {
    if (appSettings) {
      if (appSettings.logoUrl) {
        localStorage.setItem('sidebarLogo', appSettings.logoUrl);
      } else {
        localStorage.removeItem('sidebarLogo');
      }
    }
  }, [appSettings]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isManager) {
      toast({
        variant: 'destructive',
        title: 'Permiso denegado',
        description: 'Solo los gerentes pueden cambiar el logo.',
      });
      return;
    }
    const file = event.target.files?.[0];
    if (file && storage && settingsRef) {
      const storageRef = ref(storage, 'app/logo/sidebar-logo');
      const uploadTask = uploadBytesResumable(storageRef, file);

      toast({
        title: 'Subiendo logo...',
        description: 'Por favor espere.',
      });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Optional: handle progress
        },
        (error) => {
          console.error("Upload failed:", error);
          toast({
            variant: 'destructive',
            title: 'Error al subir',
            description: 'No se pudo subir el logo. Verifique los permisos de Storage.',
          });
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            setDocumentNonBlocking(settingsRef, { logoUrl: downloadURL }, { merge: true });
            toast({
              title: 'Logo actualizado',
              description: 'El nuevo logo será visible para todos los usuarios.',
            });
          });
        }
      );
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  if (isLoading) {
    return <Skeleton className={cn('h-8 w-8 rounded-full', className)} />;
  }

  const logoUrl = appSettings?.logoUrl;
  const buttonContent = logoUrl ? (
    <Image
      src={logoUrl}
      alt="Logo"
      width={32}
      height={32}
      className="rounded-full object-cover h-8 w-8"
    />
  ) : (
    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
      <Upload className="h-5 w-5" />
    </div>
  );

  if (isManager) {
    return (
      <div className="relative group/logo-uploader" title="Cambiar logo">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
        />
        <button
          onClick={handleUploadClick}
          className={cn(
            "rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
            "h-8 w-8 flex items-center justify-center",
            className
          )}
        >
          {buttonContent}
          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/logo-uploader:opacity-100 transition-opacity cursor-pointer">
            <Upload className="h-5 w-5 text-white" />
          </div>
        </button>
      </div>
    );
  }

  // Non-manager view
  return (
    <div className={cn("h-8 w-8 flex items-center justify-center", className)}>
      {buttonContent}
    </div>
  );
}
