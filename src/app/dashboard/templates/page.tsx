'use client';

import React, { useState } from 'react';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  deleteDocumentNonBlocking,
  useUser,
  useDoc
} from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
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
import { MoreHorizontal, PlusCircle, Mail, MessageSquare, MessageCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { TemplateDialog } from '@/components/template-dialog';
import type { Template } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const typeIcons = {
    'Email': <Mail className="h-4 w-4" />,
    'WhatsApp': <MessageSquare className="h-4 w-4" />,
    'SMS': <MessageCircle className="h-4 w-4" />,
};

const typeColors = {
    'Email': 'bg-blue-100 text-blue-800',
    'WhatsApp': 'bg-green-100 text-green-800',
    'SMS': 'bg-purple-100 text-purple-800',
};

export default function TemplatesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('me');

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || userProfile?.role !== 'manager') return null;
    return query(collection(firestore, 'users'));
  }, [firestore, userProfile]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection(usersQuery);


  const templatesQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseCollection = collection(firestore, 'templates');
    const isManager = userProfile.role === 'manager';

    if (isManager) {
        if (selectedUserId === 'all') {
            return query(baseCollection);
        }
        const userIdToFilter = selectedUserId === 'me' ? user.uid : selectedUserId;
        return query(baseCollection, where('sellerId', '==', userIdToFilter));
    }
    
    return query(baseCollection, where('sellerId', '==', user.uid));
  }, [firestore, user, userProfile, selectedUserId]);

  const { data: templates, isLoading } = useCollection(templatesQuery);

  const handleNewClick = () => {
    setSelectedTemplate(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (template: Template) => {
    setSelectedTemplate(template);
    setIsDialogOpen(true);
  };
  
  const handleDeleteClick = (template: Template) => {
    setTemplateToDelete(template);
    setIsDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (!templateToDelete || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo encontrar la plantilla a eliminar.',
      });
      return;
    }

    setIsDeleting(true);

    try {
      deleteDocumentNonBlocking(doc(firestore, 'templates', templateToDelete.id));

      toast({
        title: 'Eliminación Iniciada',
        description: `La plantilla ${templateToDelete.name} se está eliminando.`,
      });

    } catch (error) {
      console.error("Error deleting template:", error);
      toast({
        variant: 'destructive',
        title: 'Error al eliminar',
        description: 'Ocurrió un problema al eliminar la plantilla.',
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };
  
  return (
    <>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-headline font-bold">Plantillas de Mensajes</h1>
           <div className="flex items-center gap-4">
              {userProfile?.role === 'manager' && (
                  <Select onValueChange={setSelectedUserId} value={selectedUserId} disabled={isLoading || isProfileLoading || areUsersLoading}>
                      <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Seleccionar vendedor..." />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="me">Mis Plantillas</SelectItem>
                          <SelectItem value="all">Todas</SelectItem>
                          {allUsers?.filter(u => u.id !== user?.uid).map((u: any) => (
                              <SelectItem key={u.id} value={u.id}>
                                  {`${u.firstName} ${u.lastName}`}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              )}
              <Button onClick={handleNewClick}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nueva Plantilla
              </Button>
            </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Mis Plantillas</CardTitle>
            <CardDescription>
              Cree y administre plantillas de mensajes para agilizar su comunicación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Contenido</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : templates && templates.length > 0 ? (
                  templates.map((template: Template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-semibold">
                        {template.name}
                      </TableCell>
                       <TableCell>
                        <Badge variant="outline" className={typeColors[template.type]}>
                            {typeIcons[template.type]}
                            <span className="ml-2">{template.type}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-sm truncate">{template.content}</TableCell>
                      <TableCell>{template.sellerName || 'No asignado'}</TableCell>
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
                            <DropdownMenuItem onSelect={() => handleEditClick(template)}>Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onSelect={() => handleDeleteClick(template)}>
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center"
                    >
                      No se encontraron plantillas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      
      <TemplateDialog
        key={selectedTemplate?.id || 'new'}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        template={selectedTemplate}
      />
      
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la plantilla.
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
    </>
  );
}
