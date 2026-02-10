'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { File, Download } from 'lucide-react';
import type { SharedFile } from '@/lib/types';
import { PaisanoLogo } from '@/components/icons';

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function SharedFilePage() {
  const params = useParams();
  const fileId = params.id as string;
  const firestore = useFirestore();

  const fileRef = useMemoFirebase(() => {
    if (!firestore || !fileId) return null;
    return doc(firestore, 'sharedFiles', fileId);
  }, [firestore, fileId]);

  const { data: file, isLoading } = useDoc<SharedFile>(fileRef);

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="aspect-video w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-2xl text-center">
          <CardHeader>
            <CardTitle>Archivo no encontrado</CardTitle>
            <CardDescription>El enlace puede ser incorrecto o el archivo ha sido eliminado.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isImage = file.fileType.startsWith('image/');

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <PaisanoLogo className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>{file.fileName}</CardTitle>
            {file.description && <CardDescription>{file.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          {isImage ? (
            <div className="relative w-full aspect-video rounded-md overflow-hidden">
              <Image
                src={file.fileUrl}
                alt={file.fileName}
                fill
                className="object-contain"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center aspect-video w-full rounded-md border-2 border-dashed bg-muted">
                <File className="h-16 w-16 text-muted-foreground" />
                <p className="mt-4 text-lg font-semibold">{file.fileName}</p>
                <p className="text-muted-foreground">{formatFileSize(file.fileSize)}</p>
            </div>
          )}
           <Button asChild className="w-full mt-6">
                <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Descargar Archivo
                </a>
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
