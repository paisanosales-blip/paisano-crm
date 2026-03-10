'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
  updateDocumentNonBlocking,
  addDocumentNonBlocking,
  useStorage,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, query, doc, orderBy, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Wrench, Clock, CheckCircle, Hourglass, ArrowLeft, MessageSquare, Paperclip, Send, ShieldCheck, ShieldOff, HardHat, File, Image as ImageIcon, FileText, Download, User, MoreHorizontal, Pencil, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ServiceTicket, ServiceInteraction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { EditInteractionDialog } from '@/components/edit-interaction-dialog';

const statusConfig: { [key: string]: { label: string; color: string; icon: React.ElementType } } = {
  Abierto: { label: 'Abierto', color: 'bg-red-500', icon: Wrench },
  'En Progreso': { label: 'En Progreso', color: 'bg-yellow-500', icon: Hourglass },
  Solucionado: { label: 'Solucionado', color: 'bg-blue-500', icon: Clock },
  Cerrado: { label: 'Cerrado', color: 'bg-green-500', icon: CheckCircle },
};

const getSemaforoState = (ticket: ServiceTicket | null): { level: 'ok' | 'warning' | 'danger' | 'info' | 'neutral'; label: string; tooltip: string } => {
    if (!ticket) return { level: 'neutral', label: 'Cargando', tooltip: 'Cargando datos del ticket...' };
    const now = new Date();
    const hoursSinceReported = differenceInHours(now, new Date(ticket.reportedAt));

    switch(ticket.status) {
        case 'Cerrado':
            return { level: 'ok', label: 'Resuelto', tooltip: 'Ticket cerrado y resuelto.' };
        case 'Solucionado':
             return { level: 'info', label: 'Solucionado', tooltip: 'Ticket solucionado, pendiente de cierre.' };
        case 'En Progreso':
            if (ticket.lastInteractionAt) {
                const hoursSinceInteraction = differenceInHours(now, new Date(ticket.lastInteractionAt));
                if (hoursSinceInteraction <= 48) {
                    return { level: 'ok', label: 'Activo', tooltip: 'En progreso con actividad reciente.' };
                } else if (hoursSinceInteraction <= 72) {
                    return { level: 'warning', label: 'Inactivo', tooltip: 'En progreso, requiere atención pronto.' };
                } else {
                    return { level: 'danger', label: 'Crítico', tooltip: 'En progreso sin actividad por más de 3 días.' };
                }
            } else {
                return { level: 'warning', label: 'Inactivo', tooltip: 'En progreso, pero sin interacciones registradas.' };
            }
        case 'Abierto':
            if (ticket.lastInteractionAt) {
                 const hoursSinceInteraction = differenceInHours(now, new Date(ticket.lastInteractionAt));
                 if (hoursSinceInteraction <= 24) {
                    return { level: 'ok', label: 'Activo', tooltip: 'Ticket abierto con actividad reciente.' };
                 } else {
                    return { level: 'warning', label: 'Atención', tooltip: 'Ticket abierto sin actividad en las últimas 24h.' };
                 }
            } else {
                if (hoursSinceReported > 24) {
                    return { level: 'danger', label: 'Urgente', tooltip: 'Abierto por más de 24h sin interacción.' };
                } else {
                    return { level: 'warning', label: 'Nuevo', tooltip: 'Recién abierto, pendiente de primera interacción.' };
                }
            }
        default:
             return { level: 'neutral', label: 'Desconocido', tooltip: 'Estado desconocido.' };
    }
}

const semaforoBadgeVariants = {
  ok: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800',
  danger: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
  info: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
  neutral: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700',
};


const FileTypeIcon = ({ fileType, className }: { fileType: string, className?: string }) => {
    if (fileType.startsWith('image/')) return <ImageIcon className={cn("h-5 w-5 text-muted-foreground", className)} />;
    if (fileType === 'application/pdf') return <FileText className={cn("h-5 w-5 text-muted-foreground", className)} />;
    return <File className={cn("h-5 w-5 text-muted-foreground", className)} />;
};

export default function ServiceTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const ticketId = params.id as string;
  
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();

  const [newComment, setNewComment] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDeleteInteractionDialogOpen, setIsDeleteInteractionDialogOpen] = useState(false);
  const [interactionToDelete, setInteractionToDelete] = useState<ServiceInteraction | null>(null);
  const [isEditInteractionDialogOpen, setIsEditInteractionDialogOpen] = useState(false);
  const [interactionToEdit, setInteractionToEdit] = useState<ServiceInteraction | null>(null);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const ticketRef = useMemoFirebase(() => doc(firestore, 'serviceTickets', ticketId), [firestore, ticketId]);
  const { data: ticket, isLoading: isTicketLoading } = useDoc<ServiceTicket>(ticketRef);

  const interactionsQuery = useMemoFirebase(() => query(collection(firestore, 'serviceTickets', ticketId, 'interactions'), orderBy('createdAt', 'desc')), [firestore, ticketId]);
  const { data: interactions, isLoading: areInteractionsLoading } = useCollection<ServiceInteraction>(interactionsQuery);

  const agentsQuery = useMemoFirebase(() => query(collection(firestore, 'users'), where('role', 'in', ['seller', 'manager'])), [firestore]);
  const { data: agents, isLoading: areAgentsLoading } = useCollection(agentsQuery);

  const isLoading = isTicketLoading || areInteractionsLoading || areAgentsLoading;
  
  const canEditTicket = userProfile?.role === 'manager' || (ticket?.assignedAgentId === user?.uid);
  
  const semaforoState = useMemo(() => getSemaforoState(ticket), [ticket]);
  const currentStatusConfig = ticket ? statusConfig[ticket.status] : null;


  const handleStatusChange = (newStatus: ServiceTicket['status']) => {
    const updateData: Partial<ServiceTicket> = { status: newStatus };
    if ((newStatus === 'Solucionado' || newStatus === 'Cerrado') && !ticket?.solvedAt) {
      updateData.solvedAt = new Date().toISOString();
    }
    updateDocumentNonBlocking(ticketRef, updateData);
  };

  const handleWarrantyChange = (isWarranty: boolean) => {
    updateDocumentNonBlocking(ticketRef, { isWarranty });
  };
  
  const handleAgentChange = (agentId: string) => {
    const agent = agents?.find(a => a.id === agentId);
    if (!agent) return;
    updateDocumentNonBlocking(ticketRef, { assignedAgentId: agent.id, assignedAgentName: `${agent.firstName} ${agent.lastName}` });
  };

  const handlePostInteraction = async () => {
    if (!newComment.trim() && !fileToUpload) {
      return;
    }
    if (!user || !userProfile) return;

    setIsUploading(true);

    let filePayload: { fileUrl?: string; fileName?: string; fileType?: string; } = {};

    if (fileToUpload) {
        setUploadProgress(0);
        const storageRef = ref(storage, `service_evidence/${ticketId}/${Date.now()}_${fileToUpload.name}`);
        const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

        try {
            const snapshot = await new Promise<any>((resolve, reject) => {
                uploadTask.on('state_changed', 
                    (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
                    reject,
                    () => resolve(uploadTask.snapshot)
                );
            });
            const downloadURL = await getDownloadURL(snapshot.ref);
            filePayload = { fileUrl: downloadURL, fileName: fileToUpload.name, fileType: fileToUpload.type };
        } catch (error) {
            console.error("Upload failed:", error);
            setIsUploading(false);
            return;
        }
    }

    const interactionData: Omit<ServiceInteraction, 'id'> = {
      ticketId,
      agentId: user.uid,
      agentName: `${userProfile.firstName} ${userProfile.lastName}`,
      comment: newComment,
      createdAt: new Date().toISOString(),
      ...filePayload
    };

    addDocumentNonBlocking(collection(firestore, 'serviceTickets', ticketId, 'interactions'), interactionData);
    updateDocumentNonBlocking(ticketRef, { lastInteractionAt: new Date().toISOString() });
    
    setNewComment('');
    setFileToUpload(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleDeleteInteractionClick = (interaction: ServiceInteraction) => {
    setInteractionToDelete(interaction);
    setIsDeleteInteractionDialogOpen(true);
  };

  const handleEditInteractionClick = (interaction: ServiceInteraction) => {
    setInteractionToEdit(interaction);
    setIsEditInteractionDialogOpen(true);
  };

  const handleDeleteInteractionConfirm = async () => {
    if (!interactionToDelete) return;
    const interactionRef = doc(firestore, 'serviceTickets', ticketId, 'interactions', interactionToDelete.id);
    deleteDocumentNonBlocking(interactionRef);

    if (interactionToDelete.fileUrl) {
        try {
            const fileStorageRef = ref(storage, interactionToDelete.fileUrl);
            await deleteObject(fileStorageRef);
        } catch (error: any) {
            if (error.code !== 'storage/object-not-found') {
                console.error("Error deleting file from storage:", error);
            }
        }
    }
    setIsDeleteInteractionDialogOpen(false);
  };

  const handleEditInteractionConfirm = (newComment: string) => {
    if (!interactionToEdit) return;
    const interactionRef = doc(firestore, 'serviceTickets', ticketId, 'interactions', interactionToEdit.id);
    updateDocumentNonBlocking(interactionRef, { comment: newComment });
    setIsEditInteractionDialogOpen(false);
  };


  if (isLoading) {
    return <div className="p-6"><Skeleton className="h-screen w-full" /></div>;
  }
  
  if (!ticket) {
      return <div className="p-6 text-center">Ticket no encontrado.</div>
  }


  return (
    <>
      <div className="p-4 md:p-6 space-y-6">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a la Lista
        </Button>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
              <Card>
                  <CardHeader>
                      <div className="flex justify-between items-start">
                          <div>
                              <CardTitle className="text-2xl font-bold">Ticket de Servicio: {ticket.vin}</CardTitle>
                              <CardDescription>Reportado por {ticket.clientName}</CardDescription>
                          </div>
                           <div className="flex items-center gap-2">
                            {currentStatusConfig && (
                                <Badge className={cn("text-white text-base", currentStatusConfig.color)}>
                                    <currentStatusConfig.icon className="mr-2 h-4 w-4" />
                                    {currentStatusConfig.label}
                                </Badge>
                            )}
                          </div>
                      </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div>
                          <h4 className="font-semibold text-muted-foreground">Causa del Incidente</h4>
                          <p>{ticket.incidentCause}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                          <div><p className="text-muted-foreground">Reportado:</p><p>{format(new Date(ticket.reportedAt), "dd MMMM yyyy, HH:mm", { locale: es })}</p></div>
                          {ticket.solvedAt && <div><p className="text-muted-foreground">Solucionado:</p><p>{format(new Date(ticket.solvedAt), "dd MMMM yyyy, HH:mm", { locale: es })}</p></div>}
                          <div><p className="text-muted-foreground">Tiempo de Uso:</p><p>{ticket.usageTime}</p></div>
                          <div><p className="text-muted-foreground">Método de Compra:</p><p>{ticket.purchaseMethod}</p></div>
                          <div><p className="text-muted-foreground">Vendido Por:</p><p>{ticket.purchaseSource}</p></div>
                      </div>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>Interacciones y Evidencias</CardTitle>
                  </CardHeader>
                  <CardContent>
                      {canEditTicket && (
                          <div className="space-y-4 p-4 border rounded-md mb-6">
                              <Textarea placeholder="Añadir un comentario..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                              <div className="flex justify-between items-center">
                                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                      <Paperclip className="mr-2 h-4 w-4" />
                                      {fileToUpload ? fileToUpload.name : 'Adjuntar Archivo'}
                                  </Button>
                                  <input type="file" ref={fileInputRef} onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} className="hidden" />
                                  <Button onClick={handlePostInteraction} disabled={isUploading}>
                                      <Send className="mr-2 h-4 w-4" />
                                      {isUploading ? 'Publicando...' : 'Publicar'}
                                  </Button>
                              </div>
                              {isUploading && uploadProgress > 0 && <Progress value={uploadProgress} />}
                          </div>
                      )}
                    
                      <div className="relative pl-6 space-y-8 border-l-2 border-border">
                          {interactions && interactions.length > 0 ? (
                              interactions.map((item) => (
                                  <div key={item.id} className="relative">
                                      <div className="absolute -left-[29px] top-1 flex h-10 w-10 items-center justify-center rounded-full bg-background border-2 border-border">
                                          <User className="h-5 w-5 text-muted-foreground" />
                                      </div>
                                      <div className="absolute top-1 right-1 z-10">
                                          {(user?.uid === item.agentId || userProfile?.role === 'manager') && (
                                              <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7">
                                                          <MoreHorizontal className="h-4 w-4" />
                                                      </Button>
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent>
                                                      <DropdownMenuItem onSelect={() => handleEditInteractionClick(item)}>
                                                          <Pencil className="mr-2 h-4 w-4" />
                                                          Editar
                                                      </DropdownMenuItem>
                                                      <DropdownMenuItem onSelect={() => handleDeleteInteractionClick(item)} className="text-destructive">
                                                          <Trash2 className="mr-2 h-4 w-4" />
                                                          Eliminar
                                                      </DropdownMenuItem>
                                                  </DropdownMenuContent>
                                              </DropdownMenu>
                                          )}
                                      </div>
                                      <div className="pl-8">
                                          <div className="flex items-center gap-2">
                                              <p className="font-semibold text-foreground">{item.agentName}</p>
                                              <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: es })}</p>
                                          </div>
                                          <p className="text-sm text-muted-foreground">{item.comment}</p>
                                          {item.fileUrl && (
                                              <div className="mt-2">
                                                  {item.fileType?.startsWith('image/') ? (
                                                      <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="block relative aspect-video w-full max-w-sm rounded-md overflow-hidden group border">
                                                          <Image
                                                              src={item.fileUrl}
                                                              alt={item.fileName || 'Evidencia'}
                                                              fill
                                                              className="object-cover transition-transform group-hover:scale-105"
                                                          />
                                                      </a>
                                                  ) : (
                                                      <Button asChild variant="outline" size="sm">
                                                          <a href={item.fileUrl} target="_blank" rel="noopener noreferrer">
                                                              <FileTypeIcon fileType={item.fileType || ''} className="mr-2 h-4 w-4" />
                                                              {item.fileName}
                                                              <Download className="ml-2 h-4 w-4" />
                                                          </a>
                                                      </Button>
                                                  )}
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              ))
                          ) : (
                              <div className="pl-8 text-muted-foreground">No hay interacciones en este ticket.</div>
                          )}
                      </div>
                  </CardContent>
              </Card>
          </div>

          <div className="space-y-6">
              <Card>
                  <CardHeader>
                      <CardTitle>Atención Requerida</CardTitle>
                      <CardDescription>Estado de atención basado en el tiempo de respuesta.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <div className={cn("flex items-center justify-between rounded-lg p-4", 
                          semaforoState.level === 'ok' ? 'bg-green-100 dark:bg-green-950/40' :
                          semaforoState.level === 'warning' ? 'bg-yellow-100 dark:bg-yellow-950/40' :
                          semaforoState.level === 'danger' ? 'bg-red-100 dark:bg-red-950/40' :
                          'bg-blue-100 dark:bg-blue-950/40'
                      )}>
                          <div className="space-y-0.5">
                              <p className={cn("font-bold text-lg", 
                                  semaforoState.level === 'ok' ? 'text-green-800 dark:text-green-200' :
                                  semaforoState.level === 'warning' ? 'text-yellow-800 dark:text-yellow-200' :
                                  semaforoState.level === 'danger' ? 'text-red-800 dark:text-red-200' :
                                  'text-blue-800 dark:text-blue-200'
                              )}>{semaforoState.label}</p>
                              <p className="text-xs text-muted-foreground">{semaforoState.tooltip}</p>
                          </div>
                          <div className={cn("h-6 w-6 rounded-full", 
                              semaforoState.level === 'ok' ? 'bg-green-500' :
                              semaforoState.level === 'warning' ? 'bg-yellow-400' :
                              semaforoState.level === 'danger' ? 'bg-red-500' :
                              'bg-blue-500'
                          )} />
                      </div>
                  </CardContent>
              </Card>
              <Card>
                  <CardHeader>
                      <CardTitle>Gestión del Ticket</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      <div className="space-y-2">
                          <Label>Estado del Ticket</Label>
                          <Select value={ticket.status} onValueChange={(val) => handleStatusChange(val as ServiceTicket['status'])} disabled={!canEditTicket}>
                              <SelectTrigger><SelectValue placeholder="Cambiar estado..." /></SelectTrigger>
                              <SelectContent>
                                  {Object.keys(statusConfig).map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label>Agente Asignado</Label>
                          <Select value={ticket.assignedAgentId} onValueChange={handleAgentChange} disabled={userProfile?.role !== 'manager'}>
                              <SelectTrigger><SelectValue placeholder="Asignar agente..." /></SelectTrigger>
                              <SelectContent>
                                  {agents?.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.firstName} {agent.lastName}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                              <Label htmlFor="warranty-switch" className="text-base">Garantía</Label>
                              <p className="text-sm text-muted-foreground">¿El incidente está cubierto por la garantía?</p>
                          </div>
                          <Switch id="warranty-switch" checked={ticket.isWarranty} onCheckedChange={handleWarrantyChange} disabled={!canEditTicket} />
                      </div>
                  </CardContent>
              </Card>
          </div>
        </div>
      </div>
      <AlertDialog open={isDeleteInteractionDialogOpen} onOpenChange={setIsDeleteInteractionDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar Interacción?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción no se puede deshacer. Se eliminará permanentemente el comentario y el archivo adjunto (si existe).
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteInteractionConfirm} variant="destructive">Eliminar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <EditInteractionDialog
        open={isEditInteractionDialogOpen}
        onOpenChange={setIsEditInteractionDialogOpen}
        interaction={interactionToEdit}
        onConfirm={handleEditInteractionConfirm}
        isSubmitting={false}
      />
    </>
  );
}
