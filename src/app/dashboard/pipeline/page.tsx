'use client';

import React, { useState } from 'react';
import { MoreVertical, FileDown, Phone, Mail, MessageSquare, Globe, Pencil, Check } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  useUser,
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase,
  useStorage,
} from '@/firebase';
import { collection, doc, query, where, addDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { cn } from '@/lib/utils';

import type { OpportunityStage, ClientClassification, Opportunity } from '@/lib/types';

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
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { NewProspectDialog } from '@/components/new-prospect-dialog';
import { InformationSentDialog, type InfoSentConfirmPayload } from '@/components/information-sent-dialog';
import { QuotationUploadDialog, type QuotationFormValues } from '@/components/quotation-upload-dialog';
import { EditClientDialog } from '@/components/edit-client-dialog';
import { NegotiationDialog, type NegotiationConfirmPayload } from '@/components/negotiation-dialog';
import { ClosingDialog, type ClosingConfirmPayload } from '@/components/closing-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const stages: OpportunityStage[] = ['Primer contacto', 'Envió de Información', 'Envió de Cotización', 'Negociación', 'Cierre de venta'];

// Helper function to get classification
const getClassification = (stage: OpportunityStage): ClientClassification => {
    if (stage === 'Primer contacto' || stage === 'Envió de Información') return 'PROSPECTO';
    if (stage === 'Envió de Cotización' || stage === 'Negociación') return 'CLIENTE POTENCIAL';
    if (stage === 'Cierre de venta') return 'CLIENTE';
    return 'PROSPECTO';
};

export default function PipelinePage() {
  const [filterStage, setFilterStage] = useState<OpportunityStage | 'Todos'>('Todos');
  const [infoSentDialogOpen, setInfoSentDialogOpen] = useState(false);
  const [quotationUploadOpen, setQuotationUploadOpen] = useState(false);
  const [negotiationDialogOpen, setNegotiationDialogOpen] = useState(false);
  const [closingDialogOpen, setClosingDialogOpen] = useState(false);
  const [currentProspect, setCurrentProspect] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);


  const { toast } = useToast();

  const { user, isUserLoading: isUserAuthLoading } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const leadsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'leads'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  const { data: leads, isLoading: areLeadsLoading } = useCollection(leadsQuery);

  const opportunitiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'opportunities'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  const { data: opportunities, isLoading: areOppsLoading } = useCollection(opportunitiesQuery);
  
  const quotationsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'quotations'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  const { data: quotations, isLoading: areQuotsLoading } = useCollection(quotationsQuery);

  const activitiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'activities'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  const { data: activities, isLoading: areActivitiesLoading } = useCollection(activitiesQuery);


  const handleStageChange = async (opportunityId: string, newStage: OpportunityStage) => {
    if (!firestore) return;
    const opportunityRef = doc(firestore, 'opportunities', opportunityId);
    
    try {
      await updateDoc(opportunityRef, { stage: newStage });
      toast({ title: 'Éxito', description: `Prospecto movido a: ${newStage}` });
    } catch (error) {
      console.error(`Error moving prospect to ${newStage}:`, error);
      toast({
        variant: 'destructive',
        title: 'Error al actualizar etapa',
        description: `No se pudo mover el prospecto a: ${newStage}`,
      });
    }
  };

  const requestStageChange = async (prospect: any, newStage: OpportunityStage) => {
    setCurrentProspect(prospect);
    const currentIndex = stages.indexOf(prospect.opportunity.stage);
    const newIndex = stages.indexOf(newStage);

    if (newIndex < currentIndex) {
      // Moving backwards
      await handleStageChange(prospect.opportunity.id, newStage);
      return;
    }


    if (prospect.opportunity.stage === 'Primer contacto' && newStage === 'Envió de Información') {
        setInfoSentDialogOpen(true);
    } else if (prospect.opportunity.stage === 'Envió de Información' && newStage === 'Envió de Cotización') {
        setQuotationUploadOpen(true);
    } else if (prospect.opportunity.stage === 'Envió de Cotización' && newStage === 'Negociación') {
        setNegotiationDialogOpen(true);
    } else if (prospect.opportunity.stage === 'Negociación' && newStage === 'Cierre de venta') {
        setClosingDialogOpen(true);
    } else if (newIndex > currentIndex) {
        // Allow jumping forward only if editing an already passed stage
        await handleStageChange(prospect.opportunity.id, newStage);
    }
  };

  const handleEditInfoSent = (prospect: any) => {
      setCurrentProspect(prospect);
      setInfoSentDialogOpen(true);
  };

  const handleEditQuotation = (prospect: any) => {
      setCurrentProspect(prospect);
      setQuotationUploadOpen(true);
  };

  const handleEditNegotiation = (prospect: any) => {
      setCurrentProspect(prospect);
      setNegotiationDialogOpen(true);
  };

  const handleEditClosing = (prospect: any) => {
      setCurrentProspect(prospect);
      setClosingDialogOpen(true);
  };

  const handleInfoSentConfirm = async (payload: InfoSentConfirmPayload) => {
    if (!currentProspect || !firestore || !user || !userProfile) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la solicitud.' });
        return;
    }

    setIsSubmitting(true);
    const { observations, nextContactDate, nextContactType, contactChannels, ...checklist } = payload;
    
    try {
      // 1. Update Opportunity with checklist data
      const opportunityRef = doc(firestore, 'opportunities', currentProspect.opportunity.id);
      
      const updateData: any = { ...checklist };

      const isStageChange = currentProspect.opportunity.stage === 'Primer contacto';
      if (isStageChange) {
        updateData.stage = 'Envió de Información';
      }

      await updateDoc(opportunityRef, updateData);
      
      toast({ 
        title: 'Éxito', 
        description: isStageChange 
          ? `Prospecto movido a: Envió de Información` 
          : 'Resumen de información actualizado.'
      });


      // 2. Create or Update Activity for the follow-up
      const existingActivity = currentProspect.activities?.find((act: any) => !act.completed);
      
      // Determine if there's any follow-up info to save
      const hasFollowUpData = nextContactDate !== undefined || nextContactType || observations || (contactChannels && Object.values(contactChannels).some(v => v));

      if (hasFollowUpData) {
        const selectedChannels = contactChannels ? Object.entries(contactChannels)
          .filter(([, value]) => value)
          .map(([key]) => key) : [];

        if (existingActivity) {
          // Update existing activity
          const activityRef = doc(firestore, 'activities', existingActivity.id);
          const activityUpdatePayload = {
            type: nextContactType,
            description: observations,
            contactChannels: selectedChannels,
            dueDate: nextContactDate ? nextContactDate.toISOString() : null, // Allow clearing the date
          };
          await updateDoc(activityRef, activityUpdatePayload);
          toast({ title: 'Actividad Actualizada', description: `Seguimiento para ${currentProspect.clientName} actualizado.` });

        } else {
          // Create new activity
          const activityData = {
            leadId: currentProspect.id,
            sellerId: user.uid,
            sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
            type: nextContactType || 'Nota', // Default to Note if not provided
            description: observations || '',
            contactChannels: selectedChannels,
            dueDate: nextContactDate ? nextContactDate.toISOString() : null,
            completed: false,
            createdDate: new Date().toISOString(),
          };
          await addDoc(collection(firestore, 'activities'), activityData);
          toast({ title: 'Actividad Creada', description: `Próximo contacto para ${currentProspect.clientName} agendado.` });
        }
      }

      setInfoSentDialogOpen(false);
      setCurrentProspect(null);
    } catch (error) {
      console.error('Error in handleInfoSentConfirm:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ocurrió un problema al guardar los datos. Por favor, inténtelo de nuevo.',
      });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleQuotationUpload = async (values: QuotationFormValues) => {
    if (!firestore || !storage || !user || !userProfile || !currentProspect) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo conectar con Firebase.' });
      return;
    }
  
    setIsSubmitting(true);
    setUploadProgress(0);
  
    try {
      const isEditing = !!currentProspect.quotation;
      let pdfUrl = isEditing ? currentProspect.quotation.pdfUrl : '';
  
      if (values.pdf) {
        const pdfFile = values.pdf;
        const storageRef = ref(storage, `quotations/${currentProspect.opportunity.id}/${pdfFile.name}`);
        const uploadTask = uploadBytesResumable(storageRef, pdfFile);
  
        pdfUrl = await new Promise<string>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
              if (progress === 100) {
                 setTimeout(() => toast({ title: 'Carga completa', description: 'Guardando datos...' }), 200);
              }
            },
            (error) => {
              console.error("Error en la subida del archivo:", error);
              let description = `Error al subir: ${error.message}`;
              if (error.code === 'storage/unauthorized' || error.code === 'storage/unknown') {
                description = 'Fallo al subir el archivo. Esto suele ser un problema de permisos CORS en el bucket de Storage. Por favor, asegúrese de que la configuración CORS es correcta.';
              }
              reject(new Error(description));
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
              } catch (urlError) {
                reject(new Error('El PDF se subió, pero falló el guardado en la base de datos.'));
              }
            }
          );
        });
      }
  
      if (!pdfUrl) {
          throw new Error('Se requiere un archivo PDF y no se pudo obtener la URL.');
      }
  
      if (isEditing) {
         const quotationRef = doc(firestore, 'quotations', currentProspect.quotation.id);
         await updateDoc(quotationRef, {
             value: values.value,
             currency: values.currency,
             pdfUrl: pdfUrl,
             version: String(Number(currentProspect.quotation.version || 1) + (values.pdf ? 1 : 0)),
             status: 'Enviada',
             createdDate: new Date().toISOString(),
         });
      } else {
        const quotationData = {
            opportunityId: currentProspect.opportunity.id,
            sellerId: user.uid,
            sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
            pdfUrl,
            value: values.value,
            currency: values.currency,
            version: '1',
            status: 'Enviada',
            createdDate: new Date().toISOString(),
        };
        const newQuotationRef = await addDoc(collection(firestore, 'quotations'), quotationData);
        currentProspect.quotation = { id: newQuotationRef.id, ...quotationData };
      }
  
      const opportunityRef = doc(firestore, 'opportunities', currentProspect.opportunity.id);
      if (currentProspect.opportunity.stage === 'Envió de Información') {
        await updateDoc(opportunityRef, { stage: 'Envió de Cotización' });
      }
  
      toast({
        title: `¡Cotización ${isEditing ? 'Actualizada' : 'Enviada'}!`,
        description: `La cotización para ${currentProspect.clientName} ha sido guardada.`,
      });
  
      setQuotationUploadOpen(false);
      setCurrentProspect(null);
  
    } catch (error: any) {
      console.error('Error al procesar cotización:', error);
      toast({
        variant: 'destructive',
        title: 'Error al Guardar',
        description: error.message || 'Ocurrió un problema durante la subida o el guardado.',
      });
    } finally {
        setIsSubmitting(false);
        setUploadProgress(0);
    }
  };

  const handleNegotiationConfirm = async (payload: NegotiationConfirmPayload) => {
    if (!currentProspect || !firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la solicitud.' });
        return;
    }

    setIsSubmitting(true);
    
    try {
      const opportunityRef = doc(firestore, 'opportunities', currentProspect.opportunity.id);
      
      const updateData: any = { ...payload };

      const isStageChange = currentProspect.opportunity.stage === 'Envió de Cotización';
      if (isStageChange) {
        updateData.stage = 'Negociación';
      }

      await updateDoc(opportunityRef, updateData);
      
      toast({ 
        title: 'Éxito', 
        description: isStageChange 
          ? `Prospecto movido a: Negociación` 
          : 'Resumen de negociación actualizado.'
      });

      setNegotiationDialogOpen(false);
      setCurrentProspect(null);
    } catch (error) {
      console.error('Error in handleNegotiationConfirm:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ocurrió un problema al guardar los datos de negociación. Por favor, inténtelo de nuevo.',
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleClosingConfirm = async (payload: ClosingConfirmPayload) => {
    if (!currentProspect || !firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la solicitud.' });
        return;
    }

    setIsSubmitting(true);
    
    try {
      const opportunityRef = doc(firestore, 'opportunities', currentProspect.opportunity.id);
      
      const updateData: any = { ...payload };

      const isStageChange = currentProspect.opportunity.stage === 'Negociación';
      if (isStageChange) {
        updateData.stage = 'Cierre de venta';
      }

      await updateDoc(opportunityRef, updateData);
      
      toast({ 
        title: 'Éxito', 
        description: isStageChange 
          ? `Prospecto movido a: Cierre de venta` 
          : 'Resumen de cierre actualizado.'
      });

      setClosingDialogOpen(false);
      setCurrentProspect(null);
    } catch (error) {
      console.error('Error in handleClosingConfirm:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ocurrió un problema al guardar los datos de cierre. Por favor, inténtelo de nuevo.',
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleEditClick = (prospect: any) => {
    setSelectedClient(prospect);
    setIsEditDialogOpen(true);
  };

  const isLoading = isUserAuthLoading || isProfileLoading || areLeadsLoading || areOppsLoading || areQuotsLoading || areActivitiesLoading;

  const clientProspects = React.useMemo(() => {
    if (!leads || !opportunities || !quotations || !activities) return [];
    return (leads as any[]).map(lead => {
      const opportunity = (opportunities as any[]).find(op => op.leadId === lead.id);
      const opportunityQuotations = (quotations as any[])
        .filter(q => q.opportunityId === opportunity?.id)
        .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
      const quotation = opportunityQuotations[0] || null;
      const relatedActivities = (activities as any[])
        .filter(act => act.leadId === lead.id)
        .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
      
      return { ...lead, opportunity, quotation, activities: relatedActivities };
    }).filter(item => item.opportunity);
  }, [leads, opportunities, quotations, activities]);

  const filteredProspects = clientProspects.filter(prospect => {
    if (filterStage === 'Todos') return true;
    return prospect.opportunity?.stage === filterStage;
  });
  
  const allStagesForFilter: Array<OpportunityStage | 'Todos'> = ['Todos', ...stages];

  const getBadgeClass = (classification: ClientClassification) => {
    switch (classification) {
        case 'PROSPECTO': return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700';
        case 'CLIENTE POTENCIAL': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/80 dark:text-blue-200 dark:border-blue-800';
        case 'CLIENTE': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/80 dark:text-green-200 dark:border-green-800';
        default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-headline font-bold">Flujo de Ventas</h1>
        <NewProspectDialog />
      </div>
      <Card>
        <CardHeader><CardTitle>Seguimiento de Prospectos</CardTitle><CardDescription>Administra el ciclo de vida de tus clientes, desde el primer contacto hasta el cierre.</CardDescription></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {allStagesForFilter.map((stage) => ( <Button key={stage} variant={filterStage === stage ? 'default' : 'outline'} onClick={() => setFilterStage(stage)} className="text-xs h-8">{stage}</Button>))}
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Prospecto</TableHead><TableHead>Clasificación</TableHead><TableHead>Etapa Actual</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-3 w-40" />
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                      <TableCell className='text-right'><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
              )) : filteredProspects.length > 0 ? filteredProspects.map(prospect => {
                if (!prospect.opportunity) return null;
                const classification = getClassification(prospect.opportunity.stage);
                
                const availableSummaries = [
                  prospect.opportunity.sentPrices !== undefined ? 'info' : null,
                  prospect.quotation ? 'quot' : null,
                  prospect.opportunity.acceptedPrice !== undefined ? 'neg' : null,
                  prospect.opportunity.clientMadeDownPayment !== undefined ? 'close' : null,
                ].filter(Boolean) as string[];

                const defaultTab = availableSummaries.length > 0 ? availableSummaries[availableSummaries.length - 1] : undefined;

                const followUpActivity = prospect.activities?.find((act: any) => !act.completed);


                return (
                  <TableRow key={prospect.id}>
                    <TableCell className="font-medium align-top w-[300px]">
                        <div className="font-semibold">{prospect.clientName}</div>
                        <div className="text-sm text-muted-foreground">{prospect.contactPerson}</div>
                        <div className="text-xs text-muted-foreground mt-1">{prospect.email || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">{prospect.phone || 'N/A'}</div>
                        
                        <div className="flex items-center gap-2.5 mt-2">
                            <a 
                                href={prospect.phone ? `https://wa.me/${(prospect.country === 'US' ? '1' : '52')}${prospect.phone.replace(/\D/g, '')}` : '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => !prospect.phone && e.preventDefault()}
                                className={cn(
                                    "transition-colors",
                                    prospect.phone 
                                        ? "text-green-500 hover:text-green-600" 
                                        : "text-muted-foreground/40 cursor-not-allowed"
                                )}
                                title={prospect.phone ? `WhatsApp: ${prospect.phone}` : 'No hay teléfono para WhatsApp'}
                            >
                                <MessageSquare className="h-4 w-4" />
                            </a>
                            <a 
                                href={prospect.email ? `https://mail.google.com/mail/?view=cm&fs=1&to=${prospect.email}` : '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => !prospect.email && e.preventDefault()}
                                className={cn(
                                    "transition-colors",
                                    prospect.email 
                                        ? "text-blue-500 hover:text-blue-600" 
                                        : "text-muted-foreground/40 cursor-not-allowed"
                                )}
                                title={prospect.email ? `Email: ${prospect.email}`: 'No hay email'}
                            >
                                <Mail className="h-4 w-4" />
                            </a>
                            <a 
                                href={prospect.phone ? `tel:${prospect.phone}` : '#'}
                                onClick={(e) => !prospect.phone && e.preventDefault()}
                                className={cn(
                                    "transition-colors",
                                    prospect.phone 
                                        ? "text-foreground/80 hover:text-foreground" 
                                        : "text-muted-foreground/40 cursor-not-allowed"
                                )}
                                 title={prospect.phone ? `Llamar: ${prospect.phone}`: 'No hay teléfono'}
                            >
                                <Phone className="h-4 w-4" />
                            </a>
                            <div className={cn(
                                "flex items-center gap-1.5 text-xs ml-auto pr-2",
                                 prospect.language ? "text-muted-foreground" : "text-muted-foreground/40"
                            )}>
                                <Globe className="h-4 w-4" />
                                <span>{prospect.language || 'N/A'}</span>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant="outline" className={`font-bold ${getBadgeClass(classification)}`}>{classification}</Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex items-center">
                          {stages.map((stage, index) => {
                              const currentIndex = stages.indexOf(prospect.opportunity.stage);
                              const isCompleted = index < currentIndex;
                              const isCurrent = index === currentIndex;
                              const isNext = index === currentIndex + 1;
                              const canMoveTo = isNext || isCompleted;

                              return (
                                  <React.Fragment key={stage}>
                                      <div
                                          onClick={() => requestStageChange(prospect, stage)}
                                          className={cn(
                                              'relative flex flex-col items-center gap-1.5 text-center transition-opacity w-28',
                                              (isNext || isCompleted) ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed',
                                              !isCompleted && !isCurrent && !isNext && 'opacity-50'
                                          )}
                                          title={canMoveTo ? `Mover a: ${stage}` : stage}
                                      >
                                          <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-background">
                                            <div className={cn(
                                                'flex h-6 w-6 items-center justify-center rounded-full transition-colors scale-100 group-hover:scale-110',
                                                (isCompleted || isCurrent) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                            )}>
                                                {isCompleted ? <Check className="h-4 w-4" /> : <span className={cn(isCurrent && "font-bold")}>{index + 1}</span>}
                                            </div>
                                          </div>

                                          <span className={cn(
                                              'text-xs max-w-full truncate',
                                              isCurrent ? 'font-bold text-primary' : 'text-muted-foreground'
                                          )}>
                                              {stage}
                                          </span>
                                      </div>
                                      {index < stages.length - 1 && (
                                        <div className="relative h-px w-full flex-1 bg-border">
                                            <div className={cn(
                                                "absolute inset-y-0 left-0 h-px bg-primary transition-all",
                                                isCompleted ? "w-full" : "w-0"
                                            )} />
                                        </div>
                                      )}
                                  </React.Fragment>
                              )
                          })}
                      </div>
                       <div className="mt-4 pt-4 border-t border-dashed">
                        {availableSummaries.length > 0 ? (
                          <Tabs defaultValue={defaultTab} className="w-full">
                            <TabsList className="grid w-full" style={{gridTemplateColumns: `repeat(${availableSummaries.length}, minmax(0, 1fr))`}}>
                                {availableSummaries.includes('info') && <TabsTrigger value="info" className="text-xs">Info. Enviada</TabsTrigger>}
                                {availableSummaries.includes('quot') && <TabsTrigger value="quot" className="text-xs">Cotización</TabsTrigger>}
                                {availableSummaries.includes('neg') && <TabsTrigger value="neg" className="text-xs">Negociación</TabsTrigger>}
                                {availableSummaries.includes('close') && <TabsTrigger value="close" className="text-xs">Cierre</TabsTrigger>}
                            </TabsList>
                            <TabsContent value="info">
                                {prospect.opportunity.sentPrices !== undefined && (
                                    <div className="p-2 mt-2 border rounded-md bg-background/50 text-xs text-muted-foreground">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="font-bold text-foreground">RESUMEN: ENVIÓ DE INFORMACIÓN</p>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditInfoSent(prospect)}>
                                                <Pencil className="h-3 w-3 text-muted-foreground" />
                                                <span className="sr-only">Editar información enviada</span>
                                            </Button>
                                        </div>
                                        <ul className="mt-1 space-y-1">
                                            <li>Precios Enviados: <span className="font-semibold">{prospect.opportunity.sentPrices ? '✓ Sí' : '✗ No'}</span></li>
                                            <li>Info. Técnica: <span className="font-semibold">{prospect.opportunity.sentTechnicalInfo ? '✓ Sí' : '✗ No'}</span></li>
                                            <li>Info. Empresa: <span className="font-semibold">{prospect.opportunity.sentCompanyInfo ? '✓ Sí' : '✗ No'}</span></li>
                                            <li>Fotos/Videos: <span className="font-semibold">{prospect.opportunity.sentMedia ? '✓ Sí' : '✗ No'}</span></li>
                                        </ul>
                                         {followUpActivity && (
                                            <>
                                                <div className="my-2 border-t border-dashed" />
                                                <div className="space-y-1.5">
                                                    <p className="font-bold text-foreground">SEGUIMIENTO AGENDADO</p>
                                                    <div>
                                                        <p>Próximo Contacto: <span className="font-semibold">{followUpActivity.dueDate ? format(new Date(followUpActivity.dueDate), "PP 'a las' p", { locale: es }) : 'No especificado'}</span></p>
                                                        <p>Tipo: <span className="font-semibold">{followUpActivity.type}</span></p>
                                                    </div>
                                                    {followUpActivity.contactChannels && followUpActivity.contactChannels.length > 0 && (
                                                        <div>
                                                            <p>Vías de Contacto:</p>
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {followUpActivity.contactChannels.map((channel: string) => (
                                                                    <Badge key={channel} variant="secondary" className="font-normal">{channel}</Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {followUpActivity.description && (
                                                        <div>
                                                            <p>Observaciones:</p>
                                                            <p className="font-semibold italic">"{followUpActivity.description}"</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </TabsContent>
                             <TabsContent value="quot">
                                {prospect.quotation && (
                                    <div className="p-2 mt-2 border rounded-md bg-background/50 text-xs text-muted-foreground">
                                        <div className="flex items-center justify-between">
                                            <p className="font-bold text-foreground">RESUMEN: COTIZACIÓN</p>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditQuotation(prospect)}>
                                                <Pencil className="h-3 w-3 text-muted-foreground" />
                                                <span className="sr-only">Editar cotización</span>
                                            </Button>
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="font-semibold">Valor: {new Intl.NumberFormat('en-US', { style: 'currency', currency: prospect.quotation.currency }).format(prospect.quotation.value)}</span>
                                            <Button asChild variant="outline" size="sm" className="h-7">
                                                <a href={prospect.quotation.pdfUrl} target="_blank" rel="noopener noreferrer">
                                                    <FileDown className="w-3 h-3 mr-1.5" /> Ver PDF
                                                </a>
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                             <TabsContent value="neg">
                                {prospect.opportunity.acceptedPrice !== undefined && (
                                    <div className="p-2 mt-2 border rounded-md bg-background/50 text-xs text-muted-foreground">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="font-bold text-foreground">RESUMEN: NEGOCIACIÓN</p>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditNegotiation(prospect)}>
                                                <Pencil className="h-3 w-3 text-muted-foreground" />
                                                <span className="sr-only">Editar negociación</span>
                                            </Button>
                                        </div>
                                        <ul className="mt-1 space-y-1">
                                            <li>Precio Aceptado: <span className="font-semibold">{prospect.opportunity.acceptedPrice ? '✓ Sí' : '✗ No'}</span></li>
                                            <li>Flete Cotizado: <span className="font-semibold">{prospect.opportunity.quotedFreight ? '✓ Sí' : '✗ No'}</span></li>
                                            <li>Solicita Descuento: <span className="font-semibold">{prospect.opportunity.requestsDiscount ? '✓ Sí' : '✗ No'}</span></li>
                                            {prospect.opportunity.agreedDeliveryTime && (
                                                <li>Tiempo Entrega: <span className="font-semibold">{prospect.opportunity.agreedDeliveryTime} {prospect.opportunity.agreedDeliveryTime === 1 ? 'semana' : 'semanas'}</span></li>
                                            )}
                                            {prospect.opportunity.negotiationNotes && (
                                                <li>Notas: <span className="font-semibold italic">{prospect.opportunity.negotiationNotes}</span></li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </TabsContent>
                            <TabsContent value="close">
                                {prospect.opportunity.clientMadeDownPayment !== undefined && (
                                    <div className="p-2 mt-2 border rounded-md bg-background/50 text-xs text-muted-foreground">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="font-bold text-foreground">RESUMEN: CIERRE DE VENTA</p>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditClosing(prospect)}>
                                                <Pencil className="h-3 w-3 text-muted-foreground" />
                                                <span className="sr-only">Editar cierre de venta</span>
                                            </Button>
                                        </div>
                                        <ul className="mt-1 space-y-1">
                                            <li>Anticipo Realizado: <span className="font-semibold">{prospect.opportunity.clientMadeDownPayment ? '✓ Sí' : '✗ No'}</span></li>
                                            <li>Tiempo Entrega Confirmado: <span className="font-semibold">{prospect.opportunity.deliveryTimeConfirmed ? '✓ Sí' : '✗ No'}</span></li>
                                            {prospect.opportunity.closingNotes && (
                                                <li>Notas: <span className="font-semibold italic">{prospect.opportunity.closingNotes}</span></li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </TabsContent>
                          </Tabs>
                        ) : (
                            <div className="py-4 text-xs text-center text-muted-foreground">No hay resúmenes para mostrar.</div>
                        )}
                        </div>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => handleEditClick(prospect)}>Editar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              }) : (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">No se encontraron prospectos.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {currentProspect && (
        <InformationSentDialog
            open={infoSentDialogOpen}
            onOpenChange={(isOpen) => {
              if (!isOpen) setCurrentProspect(null);
              setInfoSentDialogOpen(isOpen);
            }}
            onConfirm={handleInfoSentConfirm}
            opportunity={currentProspect.opportunity}
            activity={currentProspect.activities?.find((act: any) => !act.completed)}
            isSubmitting={isSubmitting}
        />
      )}
       {currentProspect && (
        <QuotationUploadDialog
            open={quotationUploadOpen}
            onOpenChange={(isOpen) => {
              if (!isOpen) setCurrentProspect(null);
              setQuotationUploadOpen(isOpen);
            }}
            onConfirm={handleQuotationUpload}
            opportunityName={currentProspect.clientName}
            quotation={currentProspect.quotation}
            isSubmitting={isSubmitting}
            uploadProgress={uploadProgress}
        />
      )}
      {currentProspect && (
        <NegotiationDialog
            open={negotiationDialogOpen}
            onOpenChange={(isOpen) => {
              if (!isOpen) setCurrentProspect(null);
              setNegotiationDialogOpen(isOpen);
            }}
            onConfirm={handleNegotiationConfirm}
            opportunity={currentProspect.opportunity}
            isSubmitting={isSubmitting}
        />
      )}
      {currentProspect && (
        <ClosingDialog
            open={closingDialogOpen}
            onOpenChange={(isOpen) => {
              if (!isOpen) setCurrentProspect(null);
              setClosingDialogOpen(isOpen);
            }}
            onConfirm={handleClosingConfirm}
            opportunity={currentProspect.opportunity}
            isSubmitting={isSubmitting}
        />
      )}
      {selectedClient && (
        <EditClientDialog
          key={selectedClient.id}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          client={selectedClient}
        />
      )}
    </div>
  );
}
