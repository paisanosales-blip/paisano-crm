'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
  updateDocumentNonBlocking,
  addDocumentNonBlocking,
  useStorage,
} from '@/firebase';
import { collection, query, doc, orderBy, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Wrench, Clock, CheckCircle, Hourglass, ArrowLeft, MessageSquare, Paperclip, Send, ShieldCheck, ShieldOff, HardHat, File, Image as ImageIcon, FileText, Download, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ServiceTicket, ServiceInteraction, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

const statusConfig: { [key: string]: { label: string; color: string; icon: React.ElementType } } = {
  Abierto: { label: 'Abierto', color: 'bg-red-500', icon: Wrench },
  'En Progreso': { label: 'En Progreso', color: 'bg-yellow-500', icon: Hourglass },
  Solucionado: { label: 'Solucionado', color: 'bg-blue-500', icon: Clock },
  Cerrado: { label: 'Cerrado', color: 'bg-green-500', icon: CheckCircle },
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
  const { data: agents, isLoading: areAgentsLoading } = useCollection<User>(agentsQuery);

  const isLoading = isTicketLoading || areInteractionsLoading || areAgentsLoading;
  
  const canEdit = userProfile?.role === 'manager' || (ticket?.assignedAgentId === user?.uid);

  const handleStatusChange = (newStatus: ServiceTicket['status']) => {
    const updateData: Partial<ServiceTicket> = { status: newStatus };
    if ((newStatus === 'Solucionado' || newStatus === 'Cerrado') && !ticket?.solvedAt) {
      updateData.solvedAt = new Date().toISOString();
    }
    updateDocumentNonBlocking(ticketRef, updateData);
    toast({ title: "Estado actualizado", description: `El ticket se ha movido a "${newStatus}".` });
  };

  const handleWarrantyChange = (isWarranty: boolean) => {
    updateDocumentNonBlocking(ticketRef, { isWarranty });
    toast({ title: "Garantía actualizada", description: `El ticket se ha marcado como ${isWarranty ? 'procedente' : 'no procedente'} de garantía.` });
  };
  
  const handleAgentChange = (agentId: string) => {
    const agent = agents?.find(a => a.id === agentId);
    if (!agent) return;
    updateDocumentNonBlocking(ticketRef, { assignedAgentId: agent.id, assignedAgentName: `${agent.firstName} ${agent.lastName}` });
    toast({ title: "Agente reasignado", description: `El ticket ha sido asignado a ${agent.firstName} ${agent.lastName}.` });
  };

  const handlePostInteraction = async () => {
    if (!newComment.trim() && !fileToUpload) {
      toast({ variant: 'destructive', title: 'Contenido requerido', description: 'Debe escribir un comentario o seleccionar un archivo.' });
      return;
    }
    if (!user || !userProfile) return;

    setIsUploading(true);

    let filePayload: { fileUrl?: string; fileName?: string } = {};

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
            filePayload = { fileUrl: downloadURL, fileName: fileToUpload.name };
        } catch (error) {
            console.error("Upload failed:", error);
            toast({ variant: 'destructive', title: 'Error de Subida', description: 'No se pudo subir el archivo.' });
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
    
    setNewComment('');
    setFileToUpload(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsUploading(false);
    setUploadProgress(0);
    toast({ title: "Interacción registrada" });
  };

  if (isLoading) {
    return <div className="p-6"><Skeleton className="h-screen w-full" /></div>;
  }
  
  if (!ticket) {
      return <div className="p-6 text-center">Ticket no encontrado.</div>
  }

  const currentStatusConfig = statusConfig[ticket.status];

  return (
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
                         <Badge className={cn("text-white text-base", currentStatusConfig.color)}>
                            <currentStatusConfig.icon className="mr-2 h-4 w-4" />
                            {currentStatusConfig.label}
                        </Badge>
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
                    {/* Add new interaction form */}
                    {canEdit && (
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
                   
                    {/* Timeline */}
                    <div className="relative pl-6 space-y-8 border-l-2 border-border">
                        {interactions && interactions.length > 0 ? (
                            interactions.map((item) => (
                                <div key={item.id} className="relative">
                                    <div className="absolute -left-[29px] top-1 flex h-10 w-10 items-center justify-center rounded-full bg-background border-2 border-border">
                                        <User className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="pl-8">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-foreground">{item.agentName}</p>
                                            <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: es })}</p>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{item.comment}</p>
                                        {item.fileUrl && (
                                            <div className="mt-2">
                                                <Button asChild variant="outline" size="sm">
                                                    <a href={item.fileUrl} target="_blank" rel="noopener noreferrer">
                                                        <FileTypeIcon fileType={item.fileName?.split('.').pop() || ''} className="mr-2 h-4 w-4" />
                                                        {item.fileName}
                                                        <Download className="ml-2 h-4 w-4" />
                                                    </a>
                                                </Button>
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
                    <CardTitle>Gestión del Ticket</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Estado del Ticket</Label>
                        <Select value={ticket.status} onValueChange={(val) => handleStatusChange(val as ServiceTicket['status'])} disabled={!canEdit}>
                            <SelectTrigger><SelectValue placeholder="Cambiar estado..." /></SelectTrigger>
                            <SelectContent>
                                {Object.keys(statusConfig).map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Agente Asignado</Label>
                         <Select value={ticket.assignedAgentId} onValueChange={handleAgentChange} disabled={!canEdit}>
                            <SelectTrigger><SelectValue placeholder="Asignar agente..." /></SelectTrigger>
                            <SelectContent>
                                {agents?.map((agent: User) => <SelectItem key={agent.id} value={agent.id}>{agent.firstName} {agent.lastName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="warranty-switch" className="text-base">Garantía</Label>
                            <p className="text-sm text-muted-foreground">¿El incidente está cubierto por la garantía?</p>
                        </div>
                        <Switch id="warranty-switch" checked={ticket.isWarranty} onCheckedChange={handleWarrantyChange} disabled={!canEdit} />
                     </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}

    