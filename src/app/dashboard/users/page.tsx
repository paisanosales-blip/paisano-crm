'use client';

import React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ShieldAlert } from 'lucide-react';

const ROLES = ['seller', 'manager', 'Admin'];

export default function UsersPage() {
  const { user: currentUser, isUserLoading: isUserAuthLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => {
    if (!currentUser) return null;
    return doc(firestore, 'users', currentUser.uid);
  }, [firestore, currentUser]);
  const { data: currentUserProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !currentUserProfile || currentUserProfile.role !== 'Admin') return null;
    return query(collection(firestore, 'users'));
  }, [firestore, currentUserProfile]);
  
  const { data: users, isLoading: areUsersLoading } = useCollection(usersQuery);

  const isLoading = isUserAuthLoading || isProfileLoading || areUsersLoading;

  const handleRoleChange = (userId: string, newRole: string) => {
    if (!firestore) return;
    const userDocRef = doc(firestore, 'users', userId);
    updateDocumentNonBlocking(userDocRef, { role: newRole });
    toast({
      title: 'Rol actualizado',
      description: `El rol del usuario ha sido cambiado a ${newRole}.`,
    });
  };
  
  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName) return 'U';
    return `${firstName.charAt(0)}${lastName ? lastName.charAt(0) : ''}`.toUpperCase();
  };

  if (!isLoading && currentUserProfile?.role !== 'Admin') {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed bg-card p-12 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="mt-4 text-xl font-semibold">Acceso Denegado</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No tienes los permisos necesarios para administrar usuarios.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-bold">Administración de Usuarios</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
          <CardDescription>
            Administra los roles y permisos de los usuarios del sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={3}>
                      <Skeleton className="h-12 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : users && users.length > 0 ? (
                users.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatarUrl} alt={user.firstName} />
                          <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
                        </Avatar>
                        <div className="font-medium">{user.firstName} {user.lastName}</div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                        disabled={currentUser?.uid === user.id}
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
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    No se encontraron usuarios.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
