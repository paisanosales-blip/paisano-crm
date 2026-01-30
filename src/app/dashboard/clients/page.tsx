'use client';

import React, { useState } from 'react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
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
import { MoreHorizontal, Mail, Phone } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EditClientDialog } from '@/components/edit-client-dialog';
import { cn } from '@/lib/utils';


export default function ClientsPage() {
  const { user, isUserLoading: isUserAuthLoading } = useUser();
  const firestore = useFirestore();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);

  const leadsQuery = useMemoFirebase(() => {
    if (!user) return null;
    // Admins/Managers could see all, but for now, sellers see their own.
    return query(collection(firestore, 'leads'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: leads, isLoading: areLeadsLoading } = useCollection(leadsQuery);
  const isLoading = isUserAuthLoading || areLeadsLoading;

  const handleEditClick = (client: any) => {
    setSelectedClient(client);
    setIsEditDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800';
      case 'qualified':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }


  return (
    <>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-headline font-bold">Clientes</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Lista de Clientes</CardTitle>
            <CardDescription>
              Administra tus prospectos y clientes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vendedor</TableHead>
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
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : leads && leads.length > 0 ? (
                  leads.map((client: any) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-semibold">
                        {client.clientName}
                      </TableCell>
                      <TableCell>
                          <div className="font-medium">{client.contactPerson}</div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <a
                              href={client.email ? `mailto:${client.email}` : '#'}
                              onClick={(e) => !client.email && e.preventDefault()}
                              className={cn("flex items-center gap-1", client.email ? "hover:text-primary" : "cursor-not-allowed text-muted-foreground/50")}
                            >
                                <Mail className="h-3 w-3" />
                                <span>{client.email || 'N/A'}</span>
                            </a>
                            <span className="text-muted-foreground/50">|</span>
                            <a
                                href={client.phone ? `tel:${client.phone}` : '#'}
                                onClick={(e) => !client.phone && e.preventDefault()}
                                className={cn("flex items-center gap-1", client.phone ? "hover:text-primary" : "cursor-not-allowed text-muted-foreground/50")}
                            >
                                <Phone className="h-3 w-3" />
                                <span>{client.phone || 'N/A'}</span>
                            </a>
                          </div>
                      </TableCell>
                       <TableCell className="text-xs text-muted-foreground">
                          <div>{client.city}</div>
                          <div>{client.state}, {client.country}</div>
                      </TableCell>
                      <TableCell>
                          <Badge variant="outline" className={cn("uppercase", getStatusBadge(client.status))}>{client.status}</Badge>
                      </TableCell>
                      <TableCell>{client.sellerName || 'No asignado'}</TableCell>
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
                            <DropdownMenuItem onSelect={() => handleEditClick(client)}>Editar</DropdownMenuItem>
                            <DropdownMenuItem>Ver Detalles</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
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
                      colSpan={6}
                      className="h-24 text-center"
                    >
                      No se encontraron clientes.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      {selectedClient && (
        <EditClientDialog
          key={selectedClient.id} // Re-mount the component when client changes
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          client={selectedClient}
        />
      )}
    </>
  );
}
