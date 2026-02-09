'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  useFirestore,
  useUser,
  useCollection,
  useMemoFirebase,
  deleteDocumentNonBlocking,
  useDoc,
} from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { MoreHorizontal, PlusCircle, File, FileText, Image as ImageIcon, Download, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { FileUploadDialog } from '@/components/file-upload-dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { SharedFile } from '@/lib/types';

const FileTypeIcon = ({ fileType }: { fileType: string }) => {
  if (fileType.startsWith('image/')) {
    return <ImageIcon className="h-5 w-5 text-muted-foreground" />;
  }
  if (fileType === 'application/pdf') {
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  }
  return <File className="h-5 w-5 text-muted-foreground" />;
};

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function SharedFilesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<SharedFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<SharedFile | null>(null);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const filesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sharedFiles'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: files, isLoading } = useCollection<SharedFile>(filesQuery);

  const handlePreviewClick = (file: SharedFile) => {
    if (file.fileType.startsWith('image/')) {
        setPreviewFile(file);
        setIsPreviewOpen(true);
    } else {
        window.open(file.fileUrl, '_blank', 'noopener, noreferrer');
    }
  };

  const handleDeleteClick = (file: SharedFile) => {
    setFileToDelete(file);
    setIsDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (!fileToDelete || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo encontrar el archivo a eliminar.',
      });
      return;
    }

    setIsDeleting(true);

    try {
      // Note: This only deletes the Firestore record.
      // Deleting from storage would require more complex logic or a cloud function.
      // For this implementation, we'll just delete the reference.
      deleteDocumentNonBlocking(doc(firestore, 'sharedFiles', fileToDelete.id));

      toast({
        title: 'Eliminación Iniciada',
        description: `El archivo ${fileToDelete.fileName} se está eliminando.`,
      });

    } catch (error) {
      console.error("Error deleting file record:", error);
      toast({
        variant: 'destructive',
        title: 'Error al eliminar',
        description: 'Ocurrió un problema al eliminar el registro del archivo.',
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setFileToDelete(null);
    }
  };

  const isManager = userProfile?.role === 'manager';
  
  return (
    <>
      <div className="grid gap-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-headline font-bold">Archivos Compartidos</h1>
           <div className="flex w-full sm:w-auto">
              <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Subir Archivo
              </Button>
            </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Biblioteca de Archivos</CardTitle>
            <CardDescription>
              Encuentre y gestione los archivos compartidos por el equipo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Vista Previa</TableHead>
                  <TableHead>Nombre del Archivo</TableHead>
                  <TableHead>Tamaño</TableHead>
                  <TableHead>Subido por</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-12 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : files && files.length > 0 ? (
                  files.map((file: SharedFile) => (
                    <TableRow key={file.id}>
                       <TableCell>
                        <button
                          onClick={() => handlePreviewClick(file)}
                          className="w-16 h-12 flex items-center justify-center bg-muted rounded-md overflow-hidden relative group"
                        >
                          {file.fileType.startsWith('image/') ? (
                            <>
                              <Image
                                src={file.fileUrl}
                                alt={file.fileName}
                                fill
                                className="object-cover transition-transform group-hover:scale-110"
                              />
                            </>
                          ) : (
                            <FileTypeIcon fileType={file.fileType} />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="font-semibold">
                         <button onClick={() => handlePreviewClick(file)} className="text-left hover:underline">
                            {file.fileName}
                         </button>
                         {file.description && <p className="text-xs font-normal text-muted-foreground mt-1 max-w-xs truncate">{file.description}</p>}
                      </TableCell>
                      <TableCell>{formatFileSize(file.fileSize)}</TableCell>
                      <TableCell>{file.uploadedByUserName || 'N/A'}</TableCell>
                      <TableCell>{format(new Date(file.createdAt), "dd MMM, yyyy", { locale: es })}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-haspopup="true"
                              size="icon"
                              variant="ghost"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-2 h-4 w-4" />
                                Descargar
                              </a>
                            </DropdownMenuItem>
                            {(isManager || user?.uid === file.uploadedByUserId) && (
                              <DropdownMenuItem className="text-destructive" onSelect={() => handleDeleteClick(file)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center"
                    >
                      No se encontraron archivos.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      
      <FileUploadDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
      
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el registro del archivo. La eliminación del archivo en sí puede tardar unos minutos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? 'Eliminando...' : 'Eliminar Permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl h-[90vh]">
            <DialogHeader>
                <DialogTitle>{previewFile?.fileName}</DialogTitle>
                <DialogDescription>{previewFile?.description}</DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex-grow relative">
                {previewFile && previewFile.fileType.startsWith('image/') && (
                    <Image
                        src={previewFile.fileUrl}
                        alt={previewFile.fileName || 'Image preview'}
                        fill
                        className="object-contain"
                    />
                )}
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
