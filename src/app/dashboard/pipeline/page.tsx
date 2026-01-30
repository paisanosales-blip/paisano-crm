'use client';

import React, { useState } from 'react';
import { MoreVertical, FileDown, Phone, Mail, MessageSquare, Globe, Pencil } from 'lucide-react';
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
    if (prospect.opportunity.stage === 'Primer contacto' && newStage === 'Envió de Información') {
        setInfoSentDialogOpen(true);
    } else if (prospect.opportunity.stage === 'Envió de Información' && newStage === 'Envió de Cotización') {
        setQuotationUploadOpen(true);
    } else {
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


      // 2. Create a new Activity for the follow-up if provided
      const isFollowUpProvided = nextContactDate && nextContactType && observations;
      if (isFollowUpProvided) {
        const selectedChannels = contactChannels ? Object.entries(contactChannels)
          .filter(([, value]) => value)
          .map(([key]) => key) : [];

        const activityData = {
          leadId: currentProspect.id,
          sellerId: user.uid,
          sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
          type: nextContactType,
          description: observations,
          contactChannels: selectedChannels,
          dueDate: nextContactDate.toISOString(),
          completed: false,
          createdDate: new Date().toISOString(),
        };
        
        await addDoc(collection(firestore, 'activities'), activityData);
        
        toast({ title: 'Actividad Creada', description: `Próximo contacto para ${currentProspect.clientName} agendado.` });
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

      // This is the core change: Go back to resumable uploads with better error handling
      if (values.pdf) {
        const pdfFile = values.pdf;
        const storageRef = ref(storage, `quotations/${currentProspect.opportunity.id}/${pdfFile.name}`);
        const uploadTask = uploadBytesResumable(storageRef, pdfFile);

        // Use a promise to handle the upload task events
        pdfUrl = await new Promise<string>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              // This is the crucial error handler for the upload itself.
              console.error("Error en la subida del archivo:", error);
              // Enhance error message for CORS
              let description = `Error al subir: ${error.message}`;
              if (error.code === 'storage/unauthorized' || error.code === 'storage/unknown') {
                description = 'Fallo al subir el archivo. Esto suele ser un problema de permisos CORS en el bucket de Storage. Por favor, asegúrese de que la configuración CORS es correcta.';
              }
              reject(new Error(description));
            },
            async () => {
              // Upload completed successfully, now get the download URL.
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
              } catch (urlError) {
                console.error("Error al obtener URL de descarga:", urlError);
                reject(new Error('El archivo se subió, pero no se pudo obtener la URL.'));
              }
            }
          );
        });
      }

      if (!pdfUrl) {
          throw new Error('Se requiere un archivo PDF y no se pudo obtener la URL.');
      }
      
      // The rest of the logic: saving the URL to Firestore
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
        await addDoc(collection(firestore, 'quotations'), quotationData);
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
        description: error.message || 'Ocurrió un problema durante la subida o el guardado.'
      });
    } finally {
        setIsSubmitting(false);
        setUploadProgress(0);
    }
  };


  const handleEditClick = (prospect: any) => {
    setSelectedClient(prospect);
    setIsEditDialogOpen(true);
  };

  const isLoading = isUserAuthLoading || isProfileLoading || areLeadsLoading || areOppsLoading || areQuotsLoading;

  const clientProspects = React.useMemo(() => {
    if (!leads || !opportunities || !quotations) return [];
    return (leads as any[]).map(lead => {
      const opportunity = (opportunities as any[]).find(op => op.leadId === lead.id);
      const opportunityQuotations = (quotations as any[])
        .filter(q => q.opportunityId === opportunity?.id)
        .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
      const quotation = opportunityQuotations[0] || null;
      
      return { ...lead, opportunity, quotation };
    }).filter(item => item.opportunity);
  }, [leads, opportunities, quotations]);

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
                      <div className="flex items-center gap-2">
                        {stages.map((stage, index) => {
                          const currentIndex = stages.indexOf(prospect.opportunity.stage);
                          const isCompleted = index < currentIndex;
                          const isCurrent = index === currentIndex;
                          const isNext = index === currentIndex + 1;
                          
                          return (
                            <React.Fragment key={stage}>
                              <div
                                onClick={() => isNext && requestStageChange(prospect, stage)}
                                className={cn(
                                    'flex flex-col items-center gap-1 text-center transition-opacity w-28',
                                    isNext ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed',
                                    !isCompleted && !isCurrent && !isNext && 'opacity-50'
                                )}
                                title={isNext ? `Mover a: ${stage}` : stage}
                              >
                                <div className={cn(
                                    'w-6 h-6 rounded-full flex items-center justify-center transition-colors',
                                    (isCompleted || isCurrent) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                                )}>
                                    {index + 1}
                                </div>
                                <span className={cn(
                                    'text-xs',
                                    isCurrent ? 'font-bold text-primary' : 'text-muted-foreground'
                                )}>
                                    {stage}
                                </span>
                              </div>
                              {index < stages.length - 1 && <div className="flex-1 h-px bg-border mt-[-1.25rem]" />}
                            </React.Fragment>
                          )
                        })}
                      </div>
                       {prospect.opportunity.stage !== 'Primer contacto' && (
                        <div className="mt-4 pt-4 border-t border-dashed space-y-2 text-xs text-muted-foreground">
                            {prospect.opportunity.sentPrices !== undefined && (
                              <div className="p-2 border rounded-md bg-background/50">
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
                              </div>
                            )}
                            {prospect.quotation && (
                                <div className="p-2 border rounded-md bg-background/50">
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
                        </div>
                    )}
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
