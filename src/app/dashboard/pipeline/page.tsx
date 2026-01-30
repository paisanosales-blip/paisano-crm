'use client';

import React, { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase,
  addDocumentNonBlocking,
  useStorage,
} from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

import type { OpportunityStage, ClientClassification } from '@/lib/types';

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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { NewProspectDialog } from '@/components/new-prospect-dialog';
import { InformationSentDialog, type InfoSentConfirmPayload, type ChecklistState } from '@/components/information-sent-dialog';
import { QuotationUploadDialog, type QuotationFormValues } from '@/components/quotation-upload-dialog';


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
  const [currentOpportunity, setCurrentOpportunity] = useState<{ id: string; name: string; stage: OpportunityStage, leadId: string; } | null>(null);
  const [isUploadingQuotation, setIsUploadingQuotation] = useState(false);

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


  const handleStageChange = (opportunityId: string, newStage: OpportunityStage, checklistData?: ChecklistState) => {
    if (!firestore) return;
    const opportunityRef = doc(firestore, 'opportunities', opportunityId);
    
    const updateData: any = { stage: newStage };
    if (checklistData) {
        updateData.sentPrices = checklistData.sentPrices;
        updateData.sentTechnicalInfo = checklistData.sentTechnicalInfo;
        updateData.sentCompanyInfo = checklistData.sentCompanyInfo;
        updateData.sentMedia = checklistData.sentMedia;
    }

    updateDocumentNonBlocking(opportunityRef, updateData);
    toast({ title: 'Éxito', description: `Prospecto movido a: ${newStage}` });
  };

  const requestStageChange = (opportunity: { id: string; name: string; stage: OpportunityStage; leadId: string; }, newStage: OpportunityStage) => {
    if (opportunity.stage === 'Primer contacto' && newStage === 'Envió de Información') {
        setCurrentOpportunity(opportunity);
        setInfoSentDialogOpen(true);
    } else if (opportunity.stage === 'Envió de Información' && newStage === 'Envió de Cotización') {
        setCurrentOpportunity(opportunity);
        setQuotationUploadOpen(true);
    } else {
        handleStageChange(opportunity.id, newStage);
    }
  };

  const handleInfoSentConfirm = (payload: InfoSentConfirmPayload) => {
    if (!currentOpportunity || !firestore || !user || !userProfile) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la solicitud.' });
        return;
    }

    const { observations, nextContactDate, nextContactType, ...checklist } = payload;
    
    // 1. Update Opportunity stage with checklist data
    handleStageChange(currentOpportunity.id, 'Envió de Información', checklist);

    // 2. Create a new Activity for the follow-up
    if (nextContactDate && nextContactType && observations) {
        const activityData = {
            leadId: currentOpportunity.leadId,
            sellerId: user.uid,
            sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
            type: nextContactType,
            description: observations,
            dueDate: nextContactDate.toISOString(),
            completed: false,
            createdDate: new Date().toISOString(),
        };
        
        addDocumentNonBlocking(collection(firestore, 'activities'), activityData);
        
        toast({ title: 'Actividad Creada', description: `Próximo contacto para ${currentOpportunity.name} agendado.` });
    }

    setInfoSentDialogOpen(false);
    setCurrentOpportunity(null);
  };
  
  const handleQuotationUpload = async (values: QuotationFormValues) => {
    if (!firestore || !storage || !user || !userProfile || !currentOpportunity) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo conectar con Firebase.',
      });
      return;
    }

    setIsUploadingQuotation(true);

    try {
      // 1. Upload PDF to Firebase Storage
      const pdfFile = values.pdf;
      const storageRef = ref(storage, `quotations/${currentOpportunity.id}/${pdfFile.name}`);
      const uploadResult = await uploadBytes(storageRef, pdfFile);
      const pdfUrl = await getDownloadURL(uploadResult.ref);

      // 2. Create Quotation document in Firestore
      const quotationData = {
        opportunityId: currentOpportunity.id,
        sellerId: user.uid,
        sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
        pdfUrl,
        value: values.value,
        currency: values.currency,
        version: '1', // Start with version 1
        status: 'Enviada',
        createdDate: new Date().toISOString(),
      };
      
      addDocumentNonBlocking(collection(firestore, 'quotations'), quotationData);

      // 3. Update Opportunity stage
      const opportunityRef = doc(firestore, 'opportunities', currentOpportunity.id);
      updateDocumentNonBlocking(opportunityRef, {
        stage: 'Envió de Cotización',
      });
      
      toast({
        title: '¡Cotización Enviada!',
        description: `La cotización para ${currentOpportunity.name} ha sido cargada y el prospecto movido.`,
      });

      // 4. Close dialog and reset state
      setQuotationUploadOpen(false);
      setCurrentOpportunity(null);

    } catch (error) {
      console.error('Error uploading quotation:', error);
      toast({
        variant: 'destructive',
        title: 'Error al cargar cotización',
        description: 'Ocurrió un problema al guardar los datos. Por favor, inténtelo de nuevo.',
      });
    } finally {
      setIsUploadingQuotation(false);
    }
  };


  const isLoading = isUserAuthLoading || isProfileLoading || areLeadsLoading || areOppsLoading;

  const clientProspects = React.useMemo(() => {
    if (!leads || !opportunities) return [];
    return (leads as any[]).map(lead => {
      const opportunity = (opportunities as any[]).find(op => op.leadId === lead.id);
      return { ...lead, opportunity };
    }).filter(item => item.opportunity);
  }, [leads, opportunities]);

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
            {allStagesForFilter.map((stage) => ( <Button key={stage} variant={filterStage === stage ? 'default' : 'outline'} onClick={() => setFilterStage(stage)} className="text-xs h-8">{stage}</Button> ))}
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
                    <TableCell className="font-medium align-top">
                        <div className="font-semibold">{prospect.clientName}</div>
                        <div className="text-sm text-muted-foreground">{prospect.contactPerson}</div>
                        {(prospect.phone || prospect.email) && (
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                                {prospect.phone && <span>{prospect.phone}</span>}
                                {prospect.phone && prospect.email && <span className="text-muted-foreground/50">|</span>}
                                {prospect.email && <span>{prospect.email}</span>}
                            </div>
                        )}
                    </TableCell>
                    <TableCell><Badge variant="outline" className={`uppercase font-bold ${getBadgeClass(classification)}`}>{classification}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {stages.map((stage, index) => {
                          const currentIndex = stages.indexOf(prospect.opportunity.stage);
                          const isCompleted = index < currentIndex;
                          const isCurrent = index === currentIndex;
                          return (
                            <React.Fragment key={stage}>
                              <div className='flex flex-col items-center gap-1'>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isCompleted || isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{index + 1}</div>
                                <span className={`text-xs text-center ${isCurrent ? 'font-bold text-primary' : 'text-muted-foreground'}`}>{stage}</span>
                              </div>
                              {index < stages.length - 1 && <div className="flex-1 h-px bg-border mt-[-1.25rem]" />}
                            </React.Fragment>
                          )
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu key={prospect.opportunity.stage}>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {stages.map(stage => ( 
                            <DropdownMenuItem 
                              key={stage} 
                              onSelect={() => requestStageChange(
                                {id: prospect.opportunity.id, name: prospect.clientName, stage: prospect.opportunity.stage, leadId: prospect.id },
                                stage
                              )}
                              disabled={prospect.opportunity.stage === stage}
                            >
                              Mover a: {stage}
                            </DropdownMenuItem> 
                          ))}
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
      {currentOpportunity && (
        <InformationSentDialog
            open={infoSentDialogOpen}
            onOpenChange={setInfoSentDialogOpen}
            onConfirm={handleInfoSentConfirm}
            opportunityName={currentOpportunity.name}
        />
      )}
       {currentOpportunity && (
        <QuotationUploadDialog
            open={quotationUploadOpen}
            onOpenChange={setQuotationUploadOpen}
            onConfirm={handleQuotationUpload}
            opportunityName={currentOpportunity.name}
            isUploading={isUploadingQuotation}
        />
      )}
    </div>
  );
}
