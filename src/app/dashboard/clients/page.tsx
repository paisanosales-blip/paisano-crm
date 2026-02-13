'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, query, where, doc, getDocs } from 'firebase/firestore';
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
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';


export default function ProspectsPage() {
  const { user, isUserLoading: isUserAuthLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('me');
  const [activeTab, setActiveTab] = useState('prospects');

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

  const leadsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseCollection = collection(firestore, 'leads');
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
  const { data: leads, isLoading: areLeadsLoading } = useCollection(leadsQuery);
  
  const opportunitiesQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseCollection = collection(firestore, 'opportunities');
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
  const { data: opportunities, isLoading: areOppsLoading } = useCollection(opportunitiesQuery);

  const isLoading = isUserAuthLoading || isProfileLoading || areUsersLoading || areLeadsLoading || areOppsLoading;

  const filteredData = useMemo(() => {
    if (!leads || !opportunities) return [];

    const opportunitiesMap = new Map();
    (opportunities as any[]).forEach(op => {
      // Get the most recent opportunity for each lead
      if (!opportunitiesMap.has(op.leadId) || new Date(op.createdDate) > new Date(opportunitiesMap.get(op.leadId).createdDate)) {
        opportunitiesMap.set(op.leadId, op);
      }
    });

    const enrichedLeads = (leads as any[]).map(lead => ({
      ...lead,
      opportunityStage: opportunitiesMap.get(lead.id)?.stage,
    }));
    
    if (activeTab === 'prospects') {
        return enrichedLeads.filter(lead => lead.opportunityStage && lead.opportunityStage !== 'Cierre de venta' && lead.opportunityStage !== 'Descartado');
    }
    if (activeTab === 'clients') {
        return enrichedLeads.filter(lead => lead.opportunityStage === 'Cierre de venta');
    }
    return [];
  }, [leads, opportunities, activeTab]);


  const handleEditClick = (client: any) => {
    setSelectedClient(client);
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteClick = (client: any) => {
    setClientToDelete(client);
    setIsDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (!clientToDelete || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo encontrar el prospecto a eliminar.',
      });
      return;
    }

    setIsDeleting(true);

    try {
      // Find associated opportunities
      const oppsQuery = query(collection(firestore, 'opportunities'), where('leadId', '==', clientToDelete.id));
      const oppsSnapshot = await getDocs(oppsQuery);
      
      for (const oppDoc of oppsSnapshot.docs) {
        // For each opportunity, find and delete associated quotations
        const quotesQuery = query(collection(firestore, 'quotations'), where('opportunityId', '==', oppDoc.id));
        const quotesSnapshot = await getDocs(quotesQuery);
        quotesSnapshot.forEach(quoteDoc => {
          deleteDocumentNonBlocking(doc(firestore, 'quotations', quoteDoc.id));
        });

        // Delete opportunity
        deleteDocumentNonBlocking(doc(firestore, 'opportunities', oppDoc.id));
      }

      // Find and delete associated activities
      const activitiesQuery = query(collection(firestore, 'activities'), where('leadId', '==', clientToDelete.id));
      const activitiesSnapshot = await getDocs(activitiesQuery);
      activitiesSnapshot.docs.forEach(actDoc => {
        deleteDocumentNonBlocking(doc(firestore, 'activities', actDoc.id));
      });
      
      // Delete the lead itself
      deleteDocumentNonBlocking(doc(firestore, 'leads', clientToDelete.id));

      toast({
        title: 'Eliminación Iniciada',
        description: `${clientToDelete.clientName} y sus datos asociados se están eliminando.`,
      });

    } catch (error) {
      console.error("Error deleting client:", error);
      toast({
        variant: 'destructive',
        title: 'Error al eliminar',
        description: 'Ocurrió un problema al leer los datos a eliminar. Es posible que no tenga los permisos necesarios.',
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setClientToDelete(null);
    }
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
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-headline font-bold">Prospectos</h1>
           <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              {userProfile?.role === 'manager' && (
                  <Select onValueChange={setSelectedUserId} value={selectedUserId} disabled={isLoading}>
                      <SelectTrigger className="w-full sm:w-[220px]">
                          <SelectValue placeholder="Seleccionar vendedor..." />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="me">Mis Prospectos</SelectItem>
                          <SelectItem value="all">Todos</SelectItem>
                          {allUsers?.filter(u => u.id !== user?.uid).map((u: any) => (
                              <SelectItem key={u.id} value={u.id}>
                                  {`${u.firstName} ${u.lastName}`}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              )}
            </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Lista de Prospectos y Clientes</CardTitle>
            <CardDescription>
              Administra tus prospectos y clientes. Filtra la vista usando las pestañas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-4">
                <TabsList>
                    <TabsTrigger value="prospects">Prospectos</TabsTrigger>
                    <TabsTrigger value="clients">Clientes</TabsTrigger>
                </TabsList>
            </Tabs>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo de Cliente</TableHead>
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
                      <TableCell colSpan={7}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredData && filteredData.length > 0 ? (
                  filteredData.map((client: any) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-semibold">
                        {client.clientName}
                      </TableCell>
                      <TableCell>{client.clientType || 'N/A'}</TableCell>
                      <TableCell>
                          <div className="font-medium">{client.contactPerson}</div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <a
                              href={client.email ? `https://mail.google.com/mail/?view=cm&fs=1&to=${client.email}` : '#'}
                              target="_blank"
                              rel="noopener noreferrer"
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
                            <DropdownMenuItem onSelect={() => router.push(`/dashboard/clients/${client.id}`)}>
                              Ver Detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onSelect={() => handleDeleteClick(client)}>
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
                      colSpan={7}
                      className="h-24 text-center"
                    >
                      {activeTab === 'prospects' ? 'No se encontraron prospectos.' : 'No se encontraron clientes.'}
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
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el prospecto y todos sus datos asociados (oportunidades, cotizaciones y actividades).
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
