'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical, FileDown, Phone, Mail, MessageSquare, Globe, Pencil, Check, PlusCircle, History, X, ChevronDown, Landmark, Sparkles, Loader2, ArchiveX, Search } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  useUser,
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase,
  useStorage,
  errorEmitter,
  FirestorePermissionError,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, doc, query, where, addDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { cn } from '@/lib/utils';
import * as AccordionPrimitive from "@radix-ui/react-accordion";


import { getClassification, getBadgeClass, type OpportunityStage, type ClientClassification, type Opportunity } from '@/lib/types';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { NewProspectDialog } from '@/components/new-prospect-dialog';
import { InformationSentDialog, type InfoSentConfirmPayload } from '@/components/information-sent-dialog';
import { QuotationChoiceDialog } from '@/components/quotation-choice-dialog';
import { QuotationUploadDialog, type QuotationFormValues } from '@/components/quotation-upload-dialog';
import { EditClientDialog } from '@/components/edit-client-dialog';
import { NegotiationDialog, type NegotiationConfirmPayload } from '@/components/negotiation-dialog';
import { ClosingDialog, type ClosingConfirmPayload } from '@/components/closing-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FollowUpDialog, type FollowUpSubmitPayload } from '@/components/follow-up-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QuotationGeneratorDialog } from '@/components/quotation-generator-dialog';
import { FinancingDialog, type FinancingConfirmPayload } from '@/components/financing-dialog';
import { suggestNextAction } from '@/ai/flows/suggest-next-action';
import { DiscardProspectDialog, type DiscardConfirmPayload } from '@/components/discard-prospect-dialog';
import { Input } from '@/components/ui/input';


const stages: OpportunityStage[] = ['Primer contacto', 'Envió de Información', 'Envió de Cotización', 'Negociación', 'Cierre de venta'];
const filterButtonLabels: Record<OpportunityStage | 'Todos', string> = {
    'Todos': 'Todos',
    'Primer contacto': 'CONTACTO',
    'Envió de Información': 'INFORMACIÓN',
    'Envió de Cotización': 'COTIZACIÓN',
    'Negociación': 'NEGOCIACIÓN',
    'Cierre de venta': 'CIERRE',
    'Financiamiento Externo': 'FINANCIAMIENTO',
    'Descartado': 'DESCARTADOS',
};

export default function PipelinePage() {
  const router = useRouter();
  const [filterStage, setFilterStage] = useState<OpportunityStage | 'Todos'>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('me');
  const [infoSentDialogOpen, setInfoSentDialogOpen] = useState(false);
  const [quotationChoiceOpen, setQuotationChoiceOpen] = useState(false);
  const [quotationUploadOpen, setQuotationUploadOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [negotiationDialogOpen, setNegotiationDialogOpen] = useState(false);
  const [closingDialogOpen, setClosingDialogOpen] = useState(false);
  const [financingDialogOpen, setFinancingDialogOpen] = useState(false);
  const [isFollowUpDialogOpen, setIsFollowUpDialogOpen] = useState(false);
  const [currentProspect, setCurrentProspect] = useState<any | null>(null);
  const [currentActivity, setCurrentActivity] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<any | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPostQuotationFollowUpAlertOpen, setIsPostQuotationFollowUpAlertOpen] = useState(false);
  const [followUpQuotationId, setFollowUpQuotationId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<{ nextAction: string; rationale: string } | null>(null);
  const [isSuggestionDialogOpen, setIsSuggestionDialogOpen] = useState(false);
  const [prospectForSuggestion, setProspectForSuggestion] = useState<any | null>(null);
  const [prospectToDiscard, setProspectToDiscard] = useState<any | null>(null);
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);


  const { toast } = useToast();

  const { user, isUserLoading: isUserAuthLoading } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();

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
  
  const quotationsQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseCollection = collection(firestore, 'quotations');
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
  const { data: quotations, isLoading: areQuotsLoading } = useCollection(quotationsQuery);

  const activitiesQuery = useMemoFirebase(() => {
    if (!user || !userProfile) return null;
    const baseCollection = collection(firestore, 'activities');
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
  const { data: activities, isLoading: areActivitiesLoading } = useCollection(activitiesQuery);


  const handleStageChange = async (opportunityId: string, newStage: OpportunityStage) => {
    if (!firestore || !user) return;
    const opportunityRef = doc(firestore, 'opportunities', opportunityId);
    try {
      await updateDoc(opportunityRef, { stage: newStage, sellerId: user.uid });
      toast({ title: 'Éxito', description: `Prospecto movido a: ${newStage}` });
      router.refresh();
    } catch(error) {
      console.error("Error changing stage:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cambiar la etapa.' });
    }
  };

  const requestStageChange = (prospect: any, newStage: OpportunityStage) => {
    setCurrentProspect(prospect);
    const currentIndex = stages.indexOf(prospect.opportunity.stage);
    const newIndex = stages.indexOf(newStage);

    if (newStage === 'Financiamiento Externo') {
      setFinancingDialogOpen(true);
      return;
    }

    if (prospect.opportunity.stage === 'Financiamiento Externo' || (currentIndex !== -1 && newIndex < currentIndex)) {
      handleStageChange(prospect.opportunity.id, newStage);
      return;
    }

    if (prospect.opportunity.stage === 'Primer contacto' && newStage === 'Envió de Información') {
        setInfoSentDialogOpen(true);
    } else if (prospect.opportunity.stage === 'Envió de Información' && newStage === 'Envió de Cotización') {
        setQuotationChoiceOpen(true);
    } else if (prospect.opportunity.stage === 'Envió de Cotización' && newStage === 'Negociación') {
        setNegotiationDialogOpen(true);
    } else if (prospect.opportunity.stage === 'Negociación' && newStage === 'Cierre de venta') {
        setClosingDialogOpen(true);
    } else if (newIndex > currentIndex) {
        // Allow jumping forward only if editing an already passed stage
        handleStageChange(prospect.opportunity.id, newStage);
    }
  };
  
  const handleDiscardClick = (prospect: any) => {
    setProspectToDiscard(prospect);
    setIsDiscardDialogOpen(true);
  };

  const handleDiscardConfirm = async (payload: DiscardConfirmPayload) => {
    if (!prospectToDiscard || !firestore || !user) return;

    setIsSubmitting(true);
    try {
      const opportunityRef = doc(firestore, 'opportunities', prospectToDiscard.opportunity.id);
      
      const updateData = {
        stage: 'Descartado',
        discardedDate: new Date().toISOString(),
        discardReason: payload.reason,
        sellerId: user.uid,
      };

      await updateDoc(opportunityRef, updateData);

      toast({
        title: 'Prospecto Descartado',
        description: `${prospectToDiscard.clientName} ha sido movido a descartados.`,
      });
      router.refresh();
    } catch (error) {
      console.error("Error discarding prospect:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo descartar el prospecto.' });
    } finally {
      setIsDiscardDialogOpen(false);
      setProspectToDiscard(null);
      setIsSubmitting(false);
    }
  };

  const handleSelectCreateQuotation = () => {
    setQuotationChoiceOpen(false);
    setIsGeneratorOpen(true);
  };

  const handleSelectUploadQuotation = () => {
    setQuotationChoiceOpen(false);
    setQuotationUploadOpen(true);
  };

  const handleEditInfoSent = (prospect: any) => {
      setCurrentProspect(prospect);
      setInfoSentDialogOpen(true);
  };

  const handleEditQuotation = (prospect: any) => {
      setCurrentProspect(prospect);
      setIsEditMode(true);
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

  const handleNewFollowUpClick = (prospect: any, quotationId: string | null = null) => {
    setCurrentProspect(prospect);
    setCurrentActivity(null);
    setFollowUpQuotationId(quotationId);
    setIsFollowUpDialogOpen(true);
  };

  const handleEditActivityClick = (activity: any, prospect: any) => {
    setCurrentProspect(prospect);
    setCurrentActivity(activity);
    setFollowUpQuotationId(activity.quotationId || null);
    setIsFollowUpDialogOpen(true);
  };

  const handleDeleteActivityClick = (activity: any) => {
    setActivityToDelete(activity);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteActivityConfirm = () => {
    if (!activityToDelete || !firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo encontrar el seguimiento.' });
      return;
    }
    setIsSubmitting(true);
    deleteDocumentNonBlocking(doc(firestore, 'activities', activityToDelete.id));
    toast({ title: 'Seguimiento eliminado' });
    setIsDeleteDialogOpen(false);
    setActivityToDelete(null);
    setIsSubmitting(false);
  };


  const handleInfoSentConfirm = async (payload: InfoSentConfirmPayload) => {
    if (!currentProspect || !firestore || !user) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la solicitud.' });
        return;
    }

    setIsSubmitting(true);
    
    try {
      const { checklist, notes, contactChannels } = payload;
      const opportunityRef = doc(firestore, 'opportunities', currentProspect.opportunity.id);
      
      const usedChannels = Object.entries(contactChannels).filter(([, value]) => value).map(([key]) => key);

      const updateData: any = { 
          ...checklist,
          infoSentNotes: notes || '',
          infoSentContactChannels: usedChannels,
          sellerId: user.uid, // Always include sellerId for security rules
      };

      const isStageChange = currentProspect.opportunity.stage === 'Primer contacto';
      if (isStageChange) {
        updateData.stage = 'Envió de Información';
        updateData.infoSentDate = new Date().toISOString();
      }

      await updateDoc(opportunityRef, updateData);
      
      toast({ 
        title: 'Éxito', 
        description: isStageChange 
          ? `Prospecto movido a: Envió de Información` 
          : 'Resumen de información actualizado.'
      });
      router.refresh();
    } catch(error) {
      console.error("Error in handleInfoSentConfirm:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la información.' });
    } finally {
      setInfoSentDialogOpen(false);
      setCurrentProspect(null);
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
  
    const isEditing = isEditMode;
    const pdfUrl = isEditing && currentProspect.quotation ? currentProspect.quotation.pdfUrl : '';

    const performDatabaseUpdate = async (finalPdfUrl: string) => {
      try {
        const opportunityRef = doc(firestore, 'opportunities', currentProspect.opportunity.id);
        
        let quotationIdForFollowUp = null;

        if (isEditing) {
            if (!currentProspect.quotation) throw new Error("Quotation not found for editing.");
            const quotationRef = doc(firestore, 'quotations', currentProspect.quotation.id);
            const quotationData = {
                value: values.value,
                currency: values.currency,
                pdfUrl: finalPdfUrl,
                version: String(Number(currentProspect.quotation.version || 1) + (values.pdf ? 1 : 0)),
                status: 'Enviada',
                sellerId: user.uid, // ensure sellerId is present
            };
            await updateDoc(quotationRef, quotationData);
            quotationIdForFollowUp = currentProspect.quotation.id;
        } else { // Creating a new quotation
            const quotationData: any = {
                opportunityId: currentProspect.opportunity.id,
                sellerId: user.uid,
                sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
                pdfUrl: finalPdfUrl,
                value: values.value,
                currency: values.currency,
                version: '1',
                status: 'Enviada',
                createdDate: new Date().toISOString(),
            };
            
            const existingQuotesQuery = query(collection(firestore, 'quotations'), where('opportunityId', '==', currentProspect.opportunity.id));
            const querySnapshot = await getDocs(existingQuotesQuery);
            quotationData.version = String(querySnapshot.size + 1);
            
            const newDocRef = await addDoc(collection(firestore, 'quotations'), quotationData);
            quotationIdForFollowUp = newDocRef.id;
        }
        
        if (currentProspect.opportunity.stage === 'Envió de Información') {
          await updateDoc(opportunityRef, { stage: 'Envió de Cotización', sellerId: user.uid });
        } else {
          // This case is for editing an existing quotation without changing the stage
          await updateDoc(opportunityRef, { sellerId: user.uid });
        }
        
        toast({
          title: isEditing ? '¡Cotización Actualizada!' : '¡Cotización Enviada!',
          description: `La cotización para ${currentProspect.clientName} ha sido guardada.`,
        });

        setFollowUpQuotationId(quotationIdForFollowUp);
        setQuotationUploadOpen(false);
        setIsGeneratorOpen(false);
        setIsPostQuotationFollowUpAlertOpen(true);

      } catch (error) {
          console.error("Database update failed:", error);
          const permissionError = new FirestorePermissionError({
            path: isEditing ? `quotations/${currentProspect.quotation.id}` : 'quotations',
            operation: isEditing ? 'update' : 'create',
            requestResourceData: values,
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({
            variant: 'destructive',
            title: 'Error de Guardado',
            description: 'No se pudo guardar la información. Verifique los permisos.',
          });
      } finally {
          setIsSubmitting(false);
          setUploadProgress(0);
      }
    };

    if (values.pdf) {
      const pdfFile = values.pdf;
      const storageRef = ref(storage, `quotations/${currentProspect.opportunity.id}/${pdfFile.name}`);
      const uploadTask = uploadBytesResumable(storageRef, pdfFile);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
           if (progress === 100) {
                 setTimeout(() => toast({ title: 'Carga completa', description: 'Guardando datos...' }), 200);
              }
        },
        (error) => {
          let description = 'Ocurrió un problema al subir el archivo. Inténtelo de nuevo.';
          if (error.code === 'storage/unauthorized') {
              description = 'Fallo al subir el archivo. Esto suele ser un problema de permisos CORS en el bucket de Storage. Por favor, asegúrese de que la configuración CORS es correcta.';
          }
          toast({ variant: 'destructive', title: 'Error de Subida', description });
          setIsSubmitting(false);
          setUploadProgress(0);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
              await performDatabaseUpdate(downloadURL);
          }).catch((urlError) => {
              toast({ variant: 'destructive', title: 'Error al obtener URL', description: 'El PDF se subió, pero falló el guardado en la base de datos.' });
              setIsSubmitting(false);
              setUploadProgress(0);
          });
        }
      );
    } else if (isEditing && pdfUrl) {
        performDatabaseUpdate(pdfUrl);
    } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Se requiere un archivo PDF y no se pudo obtener la URL.' });
        setIsSubmitting(false);
    }
  };

  const handleNegotiationConfirm = async (payload: NegotiationConfirmPayload) => {
    if (!currentProspect || !firestore || !user) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la solicitud.' });
        return;
    }

    setIsSubmitting(true);
    
    try {
      const opportunityRef = doc(firestore, 'opportunities', currentProspect.opportunity.id);
      const updateData: any = { ...payload, sellerId: user.uid };
      const isStageChange = currentProspect.opportunity.stage === 'Envió de Cotización';
      if (isStageChange) {
        updateData.stage = 'Negociación';
        updateData.negotiationDate = new Date().toISOString();
      }

      await updateDoc(opportunityRef, updateData);
      
      toast({ 
        title: 'Éxito', 
        description: isStageChange 
          ? `Prospecto movido a: Negociación` 
          : 'Resumen de negociación actualizado.'
      });
      router.refresh();
    } catch(error) {
      console.error("Error in handleNegotiationConfirm:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la información.' });
    } finally {
      setNegotiationDialogOpen(false);
      setCurrentProspect(null);
      setIsSubmitting(false);
    }
  };

  const handleClosingConfirm = async (payload: ClosingConfirmPayload) => {
    if (!currentProspect || !firestore || !user) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la solicitud.' });
        return;
    }

    setIsSubmitting(true);
    
    try {
      const opportunityRef = doc(firestore, 'opportunities', currentProspect.opportunity.id);
      const updateData: any = { ...payload, sellerId: user.uid };
      const isStageChange = currentProspect.opportunity.stage === 'Negociación';
      if (isStageChange) {
        updateData.stage = 'Cierre de venta';
        updateData.closingDate = new Date().toISOString();
      }

      await updateDoc(opportunityRef, updateData);

      toast({ 
        title: 'Éxito', 
        description: isStageChange 
          ? `Prospecto movido a: Cierre de venta` 
          : 'Resumen de cierre actualizado.'
      });
      router.refresh();
    } catch(error) {
      console.error("Error in handleClosingConfirm:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la información.' });
    } finally {
      setClosingDialogOpen(false);
      setCurrentProspect(null);
      setIsSubmitting(false);
    }
  };

  const handleFinancingConfirm = async (payload: FinancingConfirmPayload) => {
    if (!currentProspect || !firestore || !user) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la solicitud.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const opportunityRef = doc(firestore, 'opportunities', currentProspect.opportunity.id);
      const updateData = {
        ...payload,
        stage: 'Financiamiento Externo',
        financiamientoExternoDate: new Date().toISOString(),
        sellerId: user.uid,
      };
      await updateDoc(opportunityRef, updateData);
      toast({ title: 'Éxito', description: `Prospecto movido a: Financiamiento Externo` });
      router.refresh();
    } catch (error) {
      console.error("Error moving to financing:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo mover el prospecto.' });
    } finally {
      setFinancingDialogOpen(false);
      setCurrentProspect(null);
      setIsSubmitting(false);
    }
  };

  const handleFollowUpSubmit = (payload: FollowUpSubmitPayload) => {
    if (!currentProspect || !firestore || !user || !userProfile) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la solicitud.' });
        return;
    }

    setIsSubmitting(true);

    const { id, observations, nextContactDate, nextContactType } = payload;
    
    const activityData: any = {
        leadId: currentProspect.id,
        sellerId: user.uid,
        sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
        type: nextContactType || 'Nota',
        description: observations || '',
        dueDate: nextContactDate ? nextContactDate.toISOString() : null,
        completed: payload.id ? currentActivity.completed : false,
        createdDate: payload.id ? currentActivity.createdDate : new Date().toISOString(),
        quotationId: followUpQuotationId || null,
    };

    if (payload.id) {
        updateDocumentNonBlocking(doc(firestore, 'activities', payload.id), activityData);
    } else {
        addDocumentNonBlocking(collection(firestore, 'activities'), activityData);
    }
    
    toast({ title: payload.id ? 'Seguimiento Actualizado' : 'Actividad Creada', description: payload.id ? 'El seguimiento ha sido modificado.' : `Nuevo seguimiento para ${currentProspect.clientName} agendado.` });
    
    setIsFollowUpDialogOpen(false);
    setCurrentProspect(null);
    setCurrentActivity(null);
    setFollowUpQuotationId(null);
    setIsSubmitting(false);
    router.refresh();
  };

  const handleToggleActivityComplete = (activityId: string, completed: boolean) => {
    if (!firestore) return;
    const activityRef = doc(firestore, 'activities', activityId);
    updateDocumentNonBlocking(activityRef, { completed });
    toast({
      title: `Actividad ${completed ? 'Completada' : 'Pendiente'}`,
      description: 'El estado del seguimiento ha sido actualizado.',
    });
  };

  const handleEditClick = (prospect: any) => {
    setSelectedClient(prospect);
    setIsEditDialogOpen(true);
  };

  const handleScheduleQuotationFollowUp = () => {
    if (!currentProspect) return;
    handleNewFollowUpClick(currentProspect, currentProspect.quotation?.id);
  };

  const handleScheduleNewQuotationFollowUp = (prospect: any) => {
      setCurrentProspect(prospect);
      setFollowUpQuotationId(prospect.quotation?.id || null);
      setIsFollowUpDialogOpen(true);
  };

  const handleGetSuggestion = async (prospect: any) => {
    if (!prospect) return;

    setIsSuggestionLoading(true);
    setProspectForSuggestion(prospect); 

    const pastInteractions = prospect.activities.length > 0
      ? prospect.activities
          .map((act: any) => `- ${format(new Date(act.createdDate), "PP", { locale: es })}: ${act.type} - "${act.description || 'Sin descripción'}"`)
          .join('\n')
      : 'No hay interacciones pasadas.';

    const clientDetails = `Nombre: ${prospect.clientName}, Tipo: ${prospect.clientType}, Contacto: ${prospect.contactPerson}, Ubicación: ${prospect.city}, ${prospect.country}.`;
    
    try {
      const result = await suggestNextAction({
        pastInteractions,
        quotationStatus: prospect.quotation?.status || 'No existe',
        salesPipelineStage: prospect.opportunity?.stage || 'No disponible',
        clientDetails,
      });

      setSuggestion(result);
      setIsSuggestionDialogOpen(true);

    } catch (error) {
      console.error("Error getting suggestion:", error);
      toast({
        variant: 'destructive',
        title: 'Error de IA',
        description: 'No se pudo generar una sugerencia en este momento.',
      });
    } finally {
      setIsSuggestionLoading(false);
    }
  };

  const isLoading = isUserAuthLoading || isProfileLoading || areLeadsLoading || areOppsLoading || areQuotsLoading || areActivitiesLoading || areUsersLoading;

  const clientProspects = React.useMemo(() => {
    if (!leads || !opportunities || !quotations || !activities) return [];
    
    const mappedProspects = (leads as any[]).map(lead => {
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

    // Sort by opportunity creation date, newest first
    return mappedProspects.sort((a, b) => {
      if (!a.opportunity?.createdDate || !b.opportunity?.createdDate) return 0;
      return new Date(b.opportunity.createdDate).getTime() - new Date(a.opportunity.createdDate).getTime();
    });

  }, [leads, opportunities, quotations, activities]);

  const filteredProspects = React.useMemo(() => {
    const lowercasedQuery = searchQuery.toLowerCase();
    
    return clientProspects.filter(prospect => {
      // Stage filter
      const stage = prospect.opportunity?.stage;
      const stageMatch = filterStage === 'Todos' 
        ? (stage !== 'Descartado' && stage !== 'Financiamiento Externo')
        : stage === filterStage;

      if (!stageMatch) {
        return false;
      }

      // Search query filter
      if (searchQuery) {
        const clientNameMatch = prospect.clientName?.toLowerCase().includes(lowercasedQuery);
        const contactPersonMatch = prospect.contactPerson?.toLowerCase().includes(lowercasedQuery);
        return clientNameMatch || contactPersonMatch;
      }
      
      return true;
    });
  }, [clientProspects, filterStage, searchQuery]);
  
  const allStagesForFilter: Array<OpportunityStage | 'Todos'> = ['Todos', ...stages, 'Financiamiento Externo', 'Descartado'];

  const getCardBgClass = (classification: ClientClassification) => {
    switch (classification) {
        case 'PROSPECTO': return 'bg-gray-100/80 dark:bg-gray-800/40';
        case 'CLIENTE POTENCIAL': return 'bg-blue-50 dark:bg-blue-950/40';
        case 'CLIENTE': return 'bg-green-50 dark:bg-green-950/40';
        case 'FINANCIAMIENTO': return 'bg-amber-50 dark:bg-amber-950/40';
        case 'PERDIDO': return 'bg-red-50 dark:bg-red-950/40';
        default: return 'bg-card';
    }
  };

  return (
    <>
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-headline font-bold">Flujo de Ventas</h1>
        <div className="flex items-center gap-4">
          {userProfile?.role === 'manager' && (
              <Select onValueChange={setSelectedUserId} value={selectedUserId} disabled={isLoading}>
                  <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Seleccionar vendedor..." />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="me">Mis Prospectos</SelectItem>
                      <SelectItem value="all">Todos los Prospectos</SelectItem>
                      {allUsers?.filter(u => u.id !== user?.uid).map((u: any) => (
                          <SelectItem key={u.id} value={u.id}>
                              {`${u.firstName} ${u.lastName}`}
                          </SelectItem>
                      ))}
                  </SelectContent>
              </Select>
          )}
          <NewProspectDialog />
        </div>
      </div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Seguimiento de Prospectos</h2>
        <p className="text-sm text-muted-foreground">Administra el ciclo de vida de tus clientes, desde el primer contacto hasta el cierre.</p>
      </div>
      
      <div className="flex flex-wrap gap-4 my-4">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre de cliente o contacto..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterStage} onValueChange={(value) => setFilterStage(value as OpportunityStage | 'Todos')}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Filtrar por etapa" />
          </SelectTrigger>
          <SelectContent>
            {allStagesForFilter.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {filterButtonLabels[stage]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>


      <div className="space-y-1.5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-2">
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))
        ) : filteredProspects.length > 0 ? (
          filteredProspects.map(prospect => {
            if (!prospect.opportunity) return null;
            const classification = getClassification(prospect.opportunity.stage);
            const cardBgClass = getCardBgClass(classification);
            const isFinancingStage = prospect.opportunity.stage === 'Financiamiento Externo';
            const isDiscarded = prospect.opportunity.stage === 'Descartado';
            const currentIndex = isFinancingStage ? -1 : stages.indexOf(prospect.opportunity.stage);
            
            const summaryTabsConfig = [
              { key: 'info', name: 'Info. Enviada', stageIndex: 1 },
              { key: 'quot', name: 'Cotización', stageIndex: 2 },
              { key: 'neg', name: 'Negociación', stageIndex: 3 },
              { key: 'close', name: 'Cierre', stageIndex: 4 },
            ];

            const availableSummaries = summaryTabsConfig.filter(tab => currentIndex >= tab.stageIndex);
            
            const defaultTab = availableSummaries.length > 0 ? availableSummaries[availableSummaries.length - 1].key : undefined;

            const quotationFollowUp = prospect.activities.find((act: any) => act.quotationId && prospect.quotation && act.quotationId === prospect.quotation.id);

            const tagClasses = {
                danger: 'border-l-red-500',
                success: 'border-l-green-500',
            };
            const tagClass = prospect.tag ? tagClasses[prospect.tag as keyof typeof tagClasses] : '';

            return (
              <Card key={prospect.id} className={cn("border-l-4", tagClass || 'border-l-transparent', cardBgClass)}>
                <CardHeader className="flex flex-row items-start justify-between p-2 pb-0">
                  <div>
                    <CardTitle className="text-base">{prospect.clientName}</CardTitle>
                    <CardDescription className="text-xs">{prospect.contactPerson}</CardDescription>
                  </div>
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => handleEditClick(prospect)}>Editar</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => requestStageChange(prospect, 'Financiamiento Externo')}>
                            <Landmark className="mr-2 h-4 w-4" />
                            <span>Financiamiento Externo</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                         <DropdownMenuItem className="text-destructive" onSelect={() => handleDiscardClick(prospect)}>
                            <ArchiveX className="mr-2 h-4 w-4" />
                            <span>Descartar Prospecto</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-2 p-2">
                  <div className="space-y-1">
                    <div className="space-y-0.5 text-xs">
                      {prospect.clientType && <Badge variant="secondary" className="text-xs mb-1">{prospect.clientType}</Badge>}
                      <div className="text-muted-foreground">{prospect.email || 'N/A'}</div>
                      <div className="text-muted-foreground">{prospect.phone || 'N/A'}</div>
                    </div>
                    
                    <div className="flex items-center gap-4 pt-1 border-t">
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
                            <MessageSquare className="h-5 w-5" />
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
                            <Mail className="h-5 w-5" />
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
                            <Phone className="h-5 w-5" />
                        </a>
                        <div className={cn(
                            "flex items-center gap-1.5 text-xs ml-auto pr-2",
                             prospect.language ? "text-muted-foreground" : "text-muted-foreground/40"
                        )}>
                            <Globe className="h-4 w-4" />
                            <span>{prospect.language || 'N/A'}</span>
                        </div>
                    </div>

                     <Collapsible className="pt-1" defaultOpen>
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-start text-xs h-8 -ml-2">
                                <History className="h-4 w-4 mr-2" />
                                Historial de Seguimiento ({prospect.activities.length})
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-1 py-1 space-y-1 border-t">
                            <div className="grid grid-cols-2 gap-2">
                                <Button size="sm" className="w-full h-8" onClick={() => handleNewFollowUpClick(prospect)}>
                                  <PlusCircle className="mr-2 h-4 w-4" />
                                  Agregar Seguimiento
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-8"
                                    onClick={() => handleGetSuggestion(prospect)}
                                    disabled={isSuggestionLoading}
                                >
                                    {isSuggestionLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="mr-2 h-4 w-4" />
                                    )}
                                    Sugerir Acción
                                </Button>
                            </div>
                            {prospect.activities.length > 0 ? (
                                <Accordion type="single" collapsible className="w-full" defaultValue={prospect.activities[0]?.id}>
                                  {prospect.activities.map((act: any) => (
                                    <AccordionItem value={act.id} key={act.id} className="border-b-0">
                                      <div className="flex w-full items-center p-1.5 text-xs rounded-md data-[state=open]:bg-muted/50 hover:bg-muted/50">
                                        <Checkbox
                                            id={`activity-check-${act.id}`}
                                            checked={act.completed}
                                            onCheckedChange={(checked) => handleToggleActivityComplete(act.id, !!checked)}
                                            className="mr-3"
                                        />
                                        <AccordionTrigger className="p-0 flex-1 justify-between">
                                            <div className={cn("grid gap-0.5 text-left", act.completed && "line-through text-muted-foreground")}>
                                                <span className="font-bold text-foreground text-xs">{act.type} {act.dueDate ? `- ${format(new Date(act.dueDate), "PP", { locale: es })}` : ''}</span>
                                                <span className="text-xs text-muted-foreground">Creado: {format(new Date(act.createdDate), "dd/MM/yy")}</span>
                                            </div>
                                        </AccordionTrigger>
                                      </div>
                                      <AccordionContent className="pb-1 pt-0 pl-4 pr-2">
                                        <div className="pl-8 border-l-2 ml-4 py-1">
                                          {act.description && <p className="italic mb-2 text-muted-foreground">"{act.description}"</p>}
                                          {act.contactChannels && act.contactChannels.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {act.contactChannels.map((channel: string) => (
                                                <Badge key={channel} variant="secondary" className="font-normal">{channel}</Badge>
                                              ))}
                                            </div>
                                          )}
                                          <div className="flex justify-end gap-1 mt-2">
                                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleEditActivityClick(act, prospect)}>
                                              <Pencil className="h-3 w-3 mr-1" />
                                              Editar
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => handleDeleteActivityClick(act)}>
                                              <X className="h-3 w-3 mr-1" />
                                              Eliminar
                                            </Button>
                                          </div>
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>
                                  ))}
                                </Accordion>
                            ) : (
                                <div className="py-2 text-xs text-center text-muted-foreground">No hay seguimientos registrados.</div>
                            )}
                        </CollapsibleContent>
                    </Collapsible>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-xs text-muted-foreground">PROGRESO DEL PROSPECTO</h4>
                      <Badge variant="outline" className={`font-bold ${getBadgeClass(classification)}`}>{classification}</Badge>
                    </div>
                    <div className="flex items-center pt-2">
                        {stages.map((stage, index) => {
                            const isCompleted = currentIndex > index;
                            const isCurrent = currentIndex === index;
                            const isNext = index === currentIndex + 1;
                            const canMoveTo = isNext || isCompleted || index < currentIndex || isFinancingStage;

                            return (
                                <React.Fragment key={stage}>
                                    <div
                                        onClick={() => canMoveTo && requestStageChange(prospect, stage)}
                                        className={cn(
                                            'flex flex-col items-center gap-1.5 text-center transition-opacity w-24',
                                            (canMoveTo) ? 'cursor-pointer' : 'cursor-not-allowed',
                                            !isFinancingStage && !isCompleted && !isCurrent && !isNext && 'opacity-50'
                                        )}
                                        title={canMoveTo ? `Mover a: ${stage}` : stage}
                                    >
                                        <div className={cn(
                                            'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
                                            isCurrent ? 'border-primary bg-primary text-primary-foreground shadow-lg' : 'border-border',
                                            isCompleted ? 'border-primary bg-primary' : 'bg-card',
                                            !isFinancingStage && canMoveTo && 'hover:border-primary/50'
                                        )}>
                                            {isCompleted ? <Check className="h-4 w-4 text-primary-foreground" /> : <span className={cn('text-xs font-bold', isCurrent ? 'text-primary-foreground' : 'text-muted-foreground')}>{index + 1}</span>}
                                        </div>
                                        <span className={cn(
                                            'text-[11px] font-medium leading-tight max-w-full px-1',
                                            isCurrent ? 'text-primary' : 'text-muted-foreground'
                                        )}>
                                            {stage}
                                        </span>
                                    </div>
                                    {index < stages.length - 1 && (
                                      <div className={cn(
                                          "h-0.5 w-full flex-1 transition-colors",
                                          isCompleted ? 'bg-primary' : 'bg-border'
                                      )} />
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </div>
                     {isDiscarded && prospect.opportunity.discardReason && (
                        <div className="p-2 mt-2 border rounded-md bg-red-50 dark:bg-red-950/40 text-xs">
                            <p className="font-bold text-destructive">Motivo del Descarte:</p>
                            <p className="italic text-destructive/90">"{prospect.opportunity.discardReason}"</p>
                        </div>
                    )}
                     <div className="mt-1 pt-1 border-t border-dashed">
                      {availableSummaries.length > 0 && (
                        <Tabs defaultValue={defaultTab} className="w-full">
                          <TabsList className="grid w-full" style={{gridTemplateColumns: `repeat(${availableSummaries.length}, minmax(0, 1fr))`}}>
                              {availableSummaries.map((tab) => (
                                  <TabsTrigger key={tab.key} value={tab.key} className="text-xs h-8">{tab.name}</TabsTrigger>
                              ))}
                          </TabsList>
                          <TabsContent value="info">
                              {currentIndex >= 1 && prospect.opportunity.sentPrices !== undefined && (
                                  <div className="p-2 mt-1 border rounded-md bg-background/50 text-xs text-muted-foreground">
                                      <div className="flex items-center justify-between mb-1">
                                          <div>
                                              <p className="font-bold text-foreground">RESUMEN: ENVIÓ DE INFORMACIÓN</p>
                                              {prospect.opportunity.infoSentDate && (
                                              <p className="text-xs text-muted-foreground">
                                                  Registrado el: {format(new Date(prospect.opportunity.infoSentDate), "dd 'de' MMMM, yyyy", { locale: es })}
                                              </p>
                                              )}
                                          </div>
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
                                      {(prospect.opportunity.infoSentContactChannels?.length > 0 || prospect.opportunity.infoSentNotes) && (
                                          <div className="mt-2 pt-2 border-t border-dashed">
                                              <p className="font-semibold text-foreground/80">REGISTRO DE INTERACCIÓN</p>
                                              {prospect.opportunity.infoSentContactChannels?.length > 0 && (
                                                  <div className="flex flex-wrap gap-1 mt-1">
                                                      {prospect.opportunity.infoSentContactChannels.map((channel: string) => (
                                                          <Badge key={channel} variant="secondary" className="font-normal">{channel}</Badge>
                                                      ))}
                                                  </div>
                                              )}
                                              {prospect.opportunity.infoSentNotes && (
                                                  <p className="italic mt-1">"{prospect.opportunity.infoSentNotes}"</p>
                                              )}
                                          </div>
                                      )}
                                  </div>
                              )}
                          </TabsContent>
                           <TabsContent value="quot">
                              {currentIndex >= 2 && prospect.quotation && (
                                  <div className="p-2 mt-1 border rounded-md bg-background/50 text-xs text-muted-foreground">
                                      <div className="flex items-center justify-between">
                                          <div>
                                              <p className="font-bold text-foreground">RESUMEN: COTIZACIÓN</p>
                                              <p className="text-xs text-muted-foreground">
                                                  Registrado el: {format(new Date(prospect.quotation.createdDate), "dd 'de' MMMM, yyyy", { locale: es })}
                                              </p>
                                          </div>
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
                                      <div className="mt-2 pt-2 border-t border-dashed">
                                        {quotationFollowUp ? (
                                          <div className="text-xs space-y-1">
                                            <p className="font-semibold text-foreground/80">SEGUIMIENTO AGENDADO:</p>
                                            <p>{quotationFollowUp.type} - {quotationFollowUp.dueDate ? format(new Date(quotationFollowUp.dueDate), "PP", { locale: es }) : 'Sin fecha'}</p>
                                            {quotationFollowUp.description && <p className="italic">"{quotationFollowUp.description}"</p>}
                                            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => handleEditActivityClick(quotationFollowUp, prospect)}>
                                              Editar Seguimiento
                                            </Button>
                                          </div>
                                        ) : (
                                          <Button variant="secondary" size="sm" className="h-7" onClick={() => handleScheduleNewQuotationFollowUp(prospect)}>
                                            <PlusCircle className="w-3 h-3 mr-1.5" />
                                            Agendar Seguimiento
                                          </Button>
                                        )}
                                      </div>
                                  </div>
                              )}
                          </TabsContent>
                           <TabsContent value="neg">
                              {currentIndex >= 3 && prospect.opportunity.acceptedPrice !== undefined && (
                                  <div className="p-2 mt-1 border rounded-md bg-background/50 text-xs text-muted-foreground">
                                      <div className="flex items-center justify-between mb-1">
                                          <div>
                                              <p className="font-bold text-foreground">RESUMEN: NEGOCIACIÓN</p>
                                              {prospect.opportunity.negotiationDate && (
                                              <p className="text-xs text-muted-foreground">
                                                  Registrado el: {format(new Date(prospect.opportunity.negotiationDate), "dd 'de' MMMM, yyyy", { locale: es })}
                                              </p>
                                              )}
                                          </div>
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
                              {currentIndex >= 4 && prospect.opportunity.clientMadeDownPayment !== undefined && (
                                  <div className="p-2 mt-1 border rounded-md bg-background/50 text-xs text-muted-foreground">
                                      <div className="flex items-center justify-between mb-1">
                                          <div>
                                              <p className="font-bold text-foreground">RESUMEN: CIERRE DE VENTA</p>
                                              {prospect.opportunity.closingDate && (
                                              <p className="text-xs text-muted-foreground">
                                                  Registrado el: {format(new Date(prospect.opportunity.closingDate), "dd 'de' MMMM, yyyy", { locale: es })}
                                              </p>
                                              )}
                                          </div>
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
                      )}
                      </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        ) : (
            <Card>
              <CardContent className="h-48 flex items-center justify-center">
                  <p className="text-muted-foreground">No se encontraron prospectos para el filtro actual.</p>
              </CardContent>
            </Card>
        )}
      </div>
    </div>
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
        <QuotationChoiceDialog
            open={quotationChoiceOpen}
            onOpenChange={(isOpen) => {
                if (!isOpen) setCurrentProspect(null);
                setQuotationChoiceOpen(isOpen);
            }}
            onSelectCreate={handleSelectCreateQuotation}
            onSelectUpload={handleSelectUploadQuotation}
        />
      )}
      {currentProspect && (
      <QuotationUploadDialog
          open={quotationUploadOpen}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
                setCurrentProspect(null);
                setIsEditMode(false);
            }
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
      <QuotationGeneratorDialog
          open={isGeneratorOpen}
          onOpenChange={setIsGeneratorOpen}
          prospect={currentProspect}
          onConfirm={handleQuotationUpload}
          isSubmitting={isSubmitting}
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
    {currentProspect && (
      <FinancingDialog
        open={financingDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) setCurrentProspect(null);
          setFinancingDialogOpen(isOpen);
        }}
        onConfirm={handleFinancingConfirm}
        prospectName={currentProspect.clientName}
        isSubmitting={isSubmitting}
      />
    )}
    {currentProspect && (
      <FollowUpDialog
          open={isFollowUpDialogOpen}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setCurrentProspect(null);
              setCurrentActivity(null);
              setFollowUpQuotationId(null);
            }
            setIsFollowUpDialogOpen(isOpen);
          }}
          onConfirm={handleFollowUpSubmit}
          isSubmitting={isSubmitting}
          prospect={currentProspect}
          activity={currentActivity}
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
     <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el registro de seguimiento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteActivityConfirm} disabled={isSubmitting}>
              {isSubmitting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isPostQuotationFollowUpAlertOpen} onOpenChange={setIsPostQuotationFollowUpAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Agendar Seguimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              La cotización ha sido guardada. ¿Te gustaría agendar un seguimiento para esta cotización ahora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
                setCurrentProspect(null);
                router.refresh();
              }}>Más Tarde</AlertDialogCancel>
            <AlertDialogAction onClick={handleScheduleQuotationFollowUp}>Agendar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isSuggestionDialogOpen} onOpenChange={setIsSuggestionDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <AlertDialogTitle>Sugerencia de Próxima Acción</AlertDialogTitle>
              </div>
              <AlertDialogDescription>
                Basado en la información del prospecto, la IA recomienda la siguiente acción:
              </AlertDialogDescription>
            </AlertDialogHeader>
            {suggestion ? (
              <div className="py-4 space-y-4">
                  <div className="space-y-1">
                      <h4 className="font-semibold text-foreground">Acción Sugerida:</h4>
                      <p className="p-3 rounded-md bg-muted text-foreground">{suggestion.nextAction}</p>
                  </div>
                  <div className="space-y-1">
                      <h4 className="font-semibold text-foreground">Justificación:</h4>
                      <p className="text-sm text-muted-foreground p-3 rounded-md border">{suggestion.rationale}</p>
                  </div>
              </div>
            ) : (
              <div className="py-4 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setProspectForSuggestion(null)}>Cerrar</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                  if (!prospectForSuggestion || !suggestion) return;
                  setCurrentProspect(prospectForSuggestion);
                  setCurrentActivity({
                      description: suggestion.nextAction,
                      type: '',
                      dueDate: undefined,
                      contactChannels: [],
                  });
                  setFollowUpQuotationId(null);
                  setIsFollowUpDialogOpen(true);
                  setIsSuggestionDialogOpen(false);
              }}>
                  Agendar Seguimiento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
      {prospectToDiscard && (
        <DiscardProspectDialog
            open={isDiscardDialogOpen}
            onOpenChange={(isOpen) => {
                if (!isOpen) setProspectToDiscard(null);
                setIsDiscardDialogOpen(isOpen);
            }}
            onConfirm={handleDiscardConfirm}
            prospectName={prospectToDiscard.clientName}
            isSubmitting={isSubmitting}
        />
      )}
    </>
  );
}
