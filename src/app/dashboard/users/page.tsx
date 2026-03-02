'use client';

import React, { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { MoreHorizontal, PlusCircle, User as UserIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { EditUserDialog } from '@/components/edit-user-dialog';
import { Badge } from '@/components/ui/badge';
import type { User, ExternalSeller } from '@/lib/types';
import { ExternalSellerDialog } from '@/components/external-seller-dialog';


const ROLES = ['seller', 'manager'];

export default function UsersPage() {
  const { user: currentUser, isUserLoading: isUserAuthLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<any | null>(null);
  
  const [isExternalSellerDialogOpen, setIsExternalSellerDialogOpen] = useState(false);
  const [externalSellerToEdit, setExternalSellerToEdit] = useState<any | null>(null);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);
  const { data: users, isLoading: areUsersLoading } = useCollection<User>(usersQuery);
  
  const externalSellersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'externalSellers');
  }, [firestore]);
  const { data: externalSellers, isLoading: areExternalSellersLoading } = useCollection<ExternalSeller>(externalSellersQuery);


  const isLoading = isUserAuthLoading || areUsersLoading || areExternalSellersLoading;

  const displayUsers = useMemo(() => {
    const internal = users ? users.map(u => ({ ...u, isExternal: false })) : [];
    const external = externalSellers ? externalSellers.map(s => ({ ...s, isExternal: true, role: 'vendedor_externo' })) : [];
    return [...internal, ...external].sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
  }, [users, externalSellers]);


  const handleRoleChange = (userId: string, newRole: string) => {
    if (!firestore) return;
    const userDocRef = doc(firestore, 'users', userId);
    setDocumentNonBlocking(userDocRef, { role: newRole }, { merge: true });
    toast({
      title: 'Rol actualizado',
      description: `El rol del usuario ha sido cambiado a ${newRole}.`,
    });
  };
  
  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName) return 'U';
    return `${firstName.charAt(0)}${lastName ? lastName.charAt(0) : ''}`.toUpperCase();
  };

  const handleEditClick = (user: any) => {
    if (user.isExternal) {
        setExternalSellerToEdit(user);
        setIsExternalSellerDialogOpen(true);
    } else {
        setUserToEdit(user);
        setIsEditUserDialogOpen(true);
    }
  };
  
  const handleNewExternalClick = () => {
    setExternalSellerToEdit(null);
    setIsExternalSellerDialogOpen(true);
  };

  const handleDeleteClick = (user: any) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (!userToDelete || !firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo encontrar el registro a eliminar.' });
      return;
    }

    setIsDeleting(true);

    try {
      const collectionName = userToDelete.isExternal ? 'externalSellers' : 'users';
      deleteDocumentNonBlocking(doc(firestore, collectionName, userToDelete.id));

      toast({
        title: 'Eliminación Iniciada',
        description: `El registro de ${userToDelete.firstName} ${userToDelete.lastName} se está eliminando.`,
      });

    } catch (error) {
      console.error("Error deleting record:", error);
      toast({ variant: 'destructive', title: 'Error al eliminar', description: 'Ocurrió un problema al eliminar el registro.' });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };


  // This check should be handled by routing/layout, but as a fallback:
  if (!isLoading && currentUser) {
      const currentUserProfile = users?.find((u: any) => u.id === currentUser.id);
      if (currentUserProfile && currentUserProfile.role.toLowerCase() !== 'manager') {
         return (
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Acceso Denegado</CardTitle>
                <CardDescription>
                  No tienes los permisos necesarios para administrar usuarios.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        );
      }
  }

  return (
    <>
      <div className="grid gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h1 className="text-2xl font-headline font-bold">Administración de Usuarios</h1>
          <Button onClick={handleNewExternalClick}><PlusCircle className="mr-2 h-4 w-4"/>Nuevo Vendedor Externo</Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Lista de Usuarios y Vendedores</CardTitle>
            <CardDescription>
              Administra los roles y permisos de los usuarios del sistema y los datos de los vendedores externos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-12 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : displayUsers && displayUsers.length > 0 ? (
                  displayUsers.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            {user.isExternal ? (
                                <AvatarFallback><UserIcon className="h-5 w-5"/></AvatarFallback>
                            ) : (
                                <>
                                <AvatarImage src={user.avatarUrl} alt={user.firstName} />
                                <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
                                </>
                            )}
                          </Avatar>
                          <div className="font-medium">{user.firstName} {user.lastName}</div>
                        </div>
                      </TableCell>
                      <TableCell>{user.email || 'N/A'}</TableCell>
                      <TableCell>{user.phone || 'N/A'}</TableCell>
                      <TableCell>
                        {user.isExternal ? (
                            <Badge variant="secondary">Vendedor Externo</Badge>
                        ) : (
                            <Select
                            value={user.role}
                            onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                            disabled={user.id === currentUser?.id}
                            >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Seleccionar rol" />
                            </SelectTrigger>
                            <SelectContent>
                                {ROLES.map(role => (
                                <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost" disabled={!user.isExternal && user.id === currentUser?.id}>
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                             <DropdownMenuItem onSelect={() => handleEditClick(user)}>
                                Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={() => handleDeleteClick(user)}
                              disabled={!user.isExternal && user.id === currentUser?.id}
                            >
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No se encontraron usuarios.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              {userToDelete?.isExternal 
                ? "Esta acción eliminará permanentemente al vendedor externo." 
                : "Esta acción eliminará permanentemente el perfil de usuario, pero la cuenta de autenticación permanecerá. El usuario ya no podrá acceder a los datos de la aplicación."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? 'Eliminando...' : 'Eliminar Registro'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {userToEdit && (
        <EditUserDialog
            open={isEditUserDialogOpen}
            onOpenChange={setIsEditUserDialogOpen}
            user={userToEdit}
        />
      )}
      <ExternalSellerDialog 
        key={externalSellerToEdit?.id || 'new'}
        open={isExternalSellerDialogOpen}
        onOpenChange={setIsExternalSellerDialogOpen}
        seller={externalSellerToEdit}
      />
    </>
  );
}
