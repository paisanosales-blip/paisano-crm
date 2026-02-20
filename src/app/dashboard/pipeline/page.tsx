

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MoreVertical, FileDown, Phone, Mail, MessageSquare, MessageCircle, Globe, Pencil, Check, PlusCircle, History, X, ChevronDown, Landmark, Sparkles, Loader2, ArchiveX, Search, Users, DollarSign, Target, UserX, TrendingUp, HelpCircle, UserCheck, Undo2, LayoutGrid, List } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
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


import { getClassification, getBadgeClass, getCardClass, type OpportunityStage, type ClientClassification, type Opportunity } from '@/lib/types';

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
import { ToastAction } from '@/components/ui/toast';
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
import { enrichProspectData } from '@/ai/flows/enrich-prospect-data';
import { DiscardProspectDialog, type DiscardConfirmPayload } from '@/components/discard-prospect-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FirstContactDialog } from '@/components/first-contact-dialog';
import { ClientTimelineDialog } from '@/components/client-timeline-dialog';


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
  const [sortBy, setSortBy] = useState('createdDate_desc');
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
  const [isScheduleFollowUpAlertOpen, setIsScheduleFollowUpAlertOpen] = useState(false);
  const [scheduleFollowUpMessage, setScheduleFollowUpMessage] = useState('');
  const [followUpQuotationId, setFollowUpQuotationId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<{ nextAction: string; rationale: string } | null>(null);
  const [isSuggestionDialogOpen, setIsSuggestionDialogOpen] = useState(false);
  const [prospectForSuggestion, setProspectForSuggestion] = useState<any | null>(null);
  const [prospectToDiscard, setProspectToDiscard] = useState<any | null>(null);
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [isFirstContactDialogOpen, setIsFirstContactDialogOpen] = useState(false);
  const [prospectForFirstContact, setProspectForFirstContact] = useState<any | null>(null);
  const [enrichingProspectId, setEnrichingProspectId] = useState<string | null>(null);
  const [enrichmentHistory, setEnrichmentHistory] = useState<Record<string, any>>({});
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineLeadId, setTimelineLeadId] = useState<string | null>(null);


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

  const handleProspectCreated = (lead: any) => {
    setProspectForFirstContact(lead);
    setIsFirstContactDialogOpen(true);
  };

  const handleFirstContactSaved = (payload: { lead: any, opportunity: any }) => {
      const newProspectWithOpp = { ...payload.lead, opportunity: payload.opportunity, activities: [], quotation: null };
      setCurrentProspect(newProspectWithOpp);
      setScheduleFollowUpMessage('El prospecto ha sido añadido. ¿Desea agendar un seguimiento ahora?');
      setIsScheduleFollowUpAlertOpen(true);
  };

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
        description: `${prospectToDiscard.clientName.toUpperCase()} ha sido movido a descartados.`,
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

  const handleViewTimeline = (leadId: string) => {
    setTimelineLeadId(leadId);
    setIsTimelineOpen(true);
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
                vins: values.vins,
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
                vins: values.vins,
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
          description: `La cotización para ${currentProspect.clientName.toUpperCase()} ha sido guardada.`,
        });

        setFollowUpQuotationId(quotationIdForFollowUp);
        setQuotationUploadOpen(false);
        setIsGeneratorOpen(false);
        setScheduleFollowUpMessage('La cotización ha sido guardada. ¿Te gustaría agendar un seguimiento para esta cotización ahora?');
        setIsScheduleFollowUpAlertOpen(true);

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
    
    toast({ title: payload.id ? 'Seguimiento Actualizado' : 'Actividad Creada', description: payload.id ? 'El seguimiento ha sido modificado.' : `Nuevo seguimiento para ${currentProspect.clientName.toUpperCase()} agendado.` });
    
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

  const handleScheduleFollowUpFromAlert = () => {
    if (!currentProspect) return;
    setIsScheduleFollowUpAlertOpen(false);
    handleNewFollowUpClick(currentProspect, followUpQuotationId);
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

    const clientDetails = `Nombre: ${prospect.clientName.toUpperCase()}, Tipo: ${prospect.clientType}, Contacto: ${prospect.contactPerson.toUpperCase()}, Ubicación: ${prospect.city}, ${prospect.country}.`;
    
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

  const handleUndoEnrichmentClick = (leadId: string) => {
    if (!firestore || !enrichmentHistory[leadId]) return;
    const originalValues = enrichmentHistory[leadId];
    const leadRef = doc(firestore, 'leads', leadId);
    updateDocumentNonBlocking(leadRef, originalValues);

    setEnrichmentHistory(prev => {
        const newHistory = { ...prev };
        delete newHistory[leadId];
        return newHistory;
    });

    toast({
        title: 'Cambios deshechos',
        description: 'Se restauró la información original del prospecto.'
    });
  };

  const handleEnrichProspect = async (prospect: any) => {
    if (!prospect || !firestore) return;
    setEnrichingProspectId(prospect.id);
    try {
      const result = await enrichProspectData({ companyName: prospect.clientName });

      const updates: { [key: string]: any } = {};
      const originalValues: { [key: string]: any } = {};

      // Only update fields that are currently empty/falsy
      (Object.keys(result) as Array<keyof typeof result>).forEach(key => {
        if (!prospect[key] && result[key]) {
          updates[key] = result[key];
          originalValues[key] = prospect[key] || ''; // Store original (empty) value
        }
      });

      if (Object.keys(updates).length > 0) {
        const leadRef = doc(firestore, 'leads', prospect.id);
        updateDocumentNonBlocking(leadRef, updates);
        setEnrichmentHistory(prev => ({...prev, [prospect.id]: originalValues }));
        toast({
          title: 'Prospecto Enriquecido',
          description: `Se encontró y actualizó nueva información para ${prospect.clientName.toUpperCase()}.`,
          action: (
            <ToastAction altText="Deshacer" onClick={() => handleUndoEnrichmentClick(prospect.id)}>
              Deshacer
            </ToastAction>
          ),
        });
      } else {
        toast({
          title: 'No se encontró información para agregar',
          description: `La IA no encontró nuevos datos o los campos ya estaban completos.`,
        });
      }
    } catch (error) {
      console.error("Error enriching prospect data:", error);
      toast({
        variant: 'destructive',
        title: 'Error de IA',
        description: 'No se pudo enriquecer la información del prospecto.',
      });
    } finally {
      setEnrichingProspectId(null);
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

    return mappedProspects;

  }, [leads, opportunities, quotations, activities]);

  const pipelineStats = React.useMemo(() => {
    if (!clientProspects) {
      return {
        activeProspects: 0,
        prospectsWithoutFollowUp: 0,
        potentialClients: 0,
        initialContact: 0,
        financingClients: 0,
        newProspectsThisMonth: 0,
        respondedLastFollowUp: 0,
        notRespondedLastFollowUp: 0,
      };
    }

    const active = clientProspects.filter(
      p => p.opportunity && p.opportunity.stage !== 'Cierre de venta' && p.opportunity.stage !== 'Descartado' && p.opportunity.stage !== 'Financiamiento Externo'
    );
    
    let respondedLastFollowUp = 0;
    let notRespondedLastFollowUp = 0;

    active.forEach((p: any) => {
        const lastCompletedActivity = p.activities.find((act: any) => act.completed);
        if (lastCompletedActivity) {
            if (lastCompletedActivity.clientResponded === true) {
                respondedLastFollowUp++;
            } else if (lastCompletedActivity.clientResponded === false) {
                notRespondedLastFollowUp++;
            }
        }
    });

    const prospectsWithoutFollowUp = active.filter(p => p.activities.length === 0).length;

    const potentialClients = active.filter(
      p => p.opportunity?.stage === 'Envió de Cotización' || p.opportunity?.stage === 'Negociación'
    ).length;
    
    const initialContact = active.filter(
      p => p.opportunity?.stage === 'Primer contacto' || p.opportunity?.stage === 'Envió de Información'
    ).length;

    const financingClients = clientProspects.filter(p => p.opportunity?.stage === 'Financiamiento Externo').length;
    
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const newProspectsThisMonth = clientProspects.filter(p => {
        if (!p.opportunity?.createdDate) return false;
        const createdDate = new Date(p.opportunity.createdDate);
        return isWithinInterval(createdDate, { start: monthStart, end: monthEnd });
    }).length;


    return {
      activeProspects: active.length,
      prospectsWithoutFollowUp,
      potentialClients,
      initialContact,
      financingClients,
      newProspectsThisMonth,
      respondedLastFollowUp,
      notRespondedLastFollowUp,
    };
  }, [clientProspects]);

  const filteredProspects = React.useMemo(() => {
    const lowercasedQuery = searchQuery.toLowerCase();
    const numericQuery = searchQuery.replace(/\D/g, '');
    
    let prospects = clientProspects.filter(prospect => {
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
        const phoneMatch = prospect.phone && numericQuery && prospect.phone.replace(/\D/g, '').includes(numericQuery);
        return clientNameMatch || contactPersonMatch || phoneMatch;
      }
      
      return true;
    });

    // Sorting logic
    const [sortField, sortDirection] = sortBy.split('_');

    return [...prospects].sort((a, b) => {
      let valA: any, valB: any;

      switch (sortField) {
        case 'createdDate':
          valA = a.opportunity?.createdDate ? new Date(a.opportunity.createdDate).getTime() : 0;
          valB = b.opportunity?.createdDate ? new Date(b.opportunity.createdDate).getTime() : 0;
          break;
        case 'value':
          valA = a.opportunity?.value || 0;
          valB = b.opportunity?.value || 0;
          break;
        case 'expectedCloseDate':
          valA = a.opportunity?.expectedCloseDate ? new Date(a.opportunity.expectedCloseDate).getTime() : 0;
          valB = b.opportunity?.expectedCloseDate ? new Date(b.opportunity.expectedCloseDate).getTime() : 0;
          break;
        case 'clientName':
          valA = a.clientName || '';
          valB = b.clientName || '';
          if (sortDirection === 'asc') {
            return (valA as string).localeCompare(valB as string);
          } else {
            return (valB as string).localeCompare(valA as string);
          }
        default:
          return 0;
      }

      if (valA < valB) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (valA > valB) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });

  }, [clientProspects, filterStage, searchQuery, sortBy]);
  
  const allStagesForFilter: Array<OpportunityStage | 'Todos'> = ['Todos', ...stages, 'Financiamiento Externo', 'Descartado'];

  return (
    <>
    <div className="flex flex-col h-full">
      <div className="flex flex-col items-start gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-headline font-bold">Flujo de Ventas</h1>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {userProfile?.role === 'manager' && (
              <Select onValueChange={setSelectedUserId} value={selectedUserId} disabled={isLoading}>
                  <SelectTrigger className="w-full sm:w-[220px]">
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
          <NewProspectDialog onSuccess={handleProspectCreated} />
        </div>
      </div>

      {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8 mb-6">
              {Array.from({length: 8}).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
      ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8 mb-6">
              <Card className="bg-muted/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                      <CardTitle className="text-xs font-medium">Prospectos Activos</CardTitle>
                      <Users className="h-4 w-4 text-sky-500" />
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                      <div className="text-lg font-bold">{pipelineStats.activeProspects}</div>
                  </CardContent>
              </Card>
              <Card className="bg-muted/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                      <CardTitle className="text-xs font-medium">Sin Seguimiento</CardTitle>
                      <HelpCircle className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                      <div className="text-lg font-bold">{pipelineStats.prospectsWithoutFollowUp}</div>
                  </CardContent>
              </Card>
              <Card className="bg-muted/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                      <CardTitle className="text-xs font-medium">Potenciales</CardTitle>
                      <Target className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                      <div className="text-lg font-bold">{pipelineStats.potentialClients}</div>
                  </CardContent>
              </Card>
              <Card className="bg-muted/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                      <CardTitle className="text-xs font-medium">Etapas Iniciales</CardTitle>
                      <Phone className="h-4 w-4 text-slate-500" />
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                      <div className="text-lg font-bold">{pipelineStats.initialContact}</div>
                  </CardContent>
              </Card>
              <Card className="bg-muted/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                      <CardTitle className="text-xs font-medium">En Financiamiento</CardTitle>
                      <Landmark className="h-4 w-4 text-orange-500" />
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                      <div className="text-lg font-bold">{pipelineStats.financingClients}</div>
                  </CardContent>
              </Card>
              <Card className="bg-muted/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                      <CardTitle className="text-xs font-medium">Nuevos (Mes)</CardTitle>
                      <TrendingUp className="h-4 w-4 text-indigo-500" />
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                      <div className="text-lg font-bold">{pipelineStats.newProspectsThisMonth}</div>
                  </CardContent>
              </Card>
              <Card className="bg-muted/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                      <CardTitle className="text-xs font-medium">Respondieron</CardTitle>
                      <UserCheck className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                      <div className="text-lg font-bold">{pipelineStats.respondedLastFollowUp}</div>
                  </CardContent>
              </Card>
              <Card className="bg-muted/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                      <CardTitle className="text-xs font-medium">No Respondieron</CardTitle>
                      <UserX className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                      <div className="text-lg font-bold">{pipelineStats.notRespondedLastFollowUp}</div>
                  </CardContent>
              </Card>
          </div>
      )}

      <div className="mb-4">
        <h2 className="text-lg font-semibold">Seguimiento de Prospectos</h2>
        <p className="text-sm text-muted-foreground">Administra el ciclo de vida de tus clientes, desde el primer contacto hasta el cierre.</p>
      </div>
      
      <div className="flex flex-col md:flex-row items-center gap-2 my-4">
        <div className="relative w-full flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, contacto o teléfono..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex w-full md:w-auto items-center gap-2">
            <Select value={filterStage} onValueChange={(value) => setFilterStage(value as OpportunityStage | 'Todos')}>
              <SelectTrigger className="w-full sm:w-[180px]">
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
            <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Ordenar por..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="createdDate_desc">Más Recientes</SelectItem>
                    <SelectItem value="createdDate_asc">Más Antiguos</SelectItem>
                    <SelectItem value="value_desc">Mayor Valor</SelectItem>
                    <SelectItem value="value_asc">Menor Valor</SelectItem>
                    <SelectItem value="expectedCloseDate_asc">Cierre Próximo</SelectItem>
                    <SelectItem value="clientName_asc">Nombre Cliente (A-Z)</SelectItem>
                </SelectContent>
            </Select>
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                <Button variant={viewMode === 'card' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('card')}>
                    <LayoutGrid className="h-4 w-4" />
                    <span className="sr-only">Tarjetas</span>
                </Button>
                <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')}>
                    <List className="h-4 w-4" />
                    <span className="sr-only">Lista</span>
                </Button>
            </div>
        </div>
      </div>


        {isLoading ? (
            <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
            </div>
        ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProspects.length > 0 ? (
                    filteredProspects.map(prospect => {
                         if (!prospect.opportunity) return null;
                        const classification = getClassification(prospect.opportunity.stage);
                        const latestActivity = prospect.activities && prospect.activities.length > 0 ? prospect.activities[0] : null;

                        return (
                          <Card key={prospect.id} className={cn("flex flex-col border-2 border-black", getCardClass(classification))}>
                              <CardHeader className="pb-2">
                                  <div className="flex justify-between items-start gap-2">
                                      <div className="flex-1">
                                          <Link href={`/dashboard/clients/${prospect.id}`} className="hover:underline">
                                              <CardTitle className="text-lg font-bold">{prospect.clientName.toUpperCase()}</CardTitle>
                                          </Link>
                                          <CardDescription>{prospect.contactPerson.toUpperCase()}</CardDescription>
                                      </div>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                            <DropdownMenuItem onSelect={() => handleEditClick(prospect)}>Editar Prospecto</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => handleNewFollowUpClick(prospect)}>Nuevo Seguimiento</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => handleGetSuggestion(prospect)} disabled={isSuggestionLoading}>
                                                <Sparkles className="mr-2 h-4 w-4" />
                                                Sugerir Acción (IA)
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuSub>
                                                <DropdownMenuSubTrigger>Mover Etapa</DropdownMenuSubTrigger>
                                                <DropdownMenuPortal>
                                                    <DropdownMenuSubContent>
                                                        {stages.map(stage => (
                                                            <DropdownMenuItem key={stage} onSelect={() => requestStageChange(prospect, stage)} disabled={prospect.opportunity?.stage === stage}>
                                                                {stage}
                                                            </DropdownMenuItem>
                                                        ))}
                                                    </DropdownMenuSubContent>
                                                </DropdownMenuPortal>
                                            </DropdownMenuSub>
                                            <DropdownMenuItem onSelect={() => requestStageChange(prospect, 'Financiamiento Externo')}>
                                                <Landmark className="mr-2 h-4 w-4" />
                                                <span>Financiamiento</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => handleDiscardClick(prospect)} className="text-destructive">
                                                <ArchiveX className="mr-2 h-4 w-4" />
                                                <span>Descartar</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                  </div>
                              </CardHeader>
                              <CardContent className="flex-grow flex flex-col justify-between space-y-3 p-4 pt-0">
                                  <div className="flex items-center justify-between mt-1 text-xs">
                                      {classification && (
                                          <Badge variant="outline" className={cn('font-bold', getBadgeClass(classification))}>
                                              {prospect.opportunity.stage}
                                          </Badge>
                                      )}
                                      {prospect.opportunity.value > 0 && (
                                          <div className="font-bold text-primary">
                                              {new Intl.NumberFormat('en-US', { style: 'currency', currency: prospect.opportunity.currency || 'USD' }).format(prospect.opportunity.value)}
                                          </div>
                                      )}
                                  </div>
                                  <div 
                                      className="p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800/60 space-y-1 text-center flex-grow flex flex-col justify-center cursor-pointer hover:bg-yellow-100"
                                      onClick={() => handleViewTimeline(prospect.id)}
                                  >
                                      <Label className="text-xs text-muted-foreground pointer-events-none">ÚLTIMO SEGUIMIENTO</Label>
                                      <p className="text-sm italic text-foreground truncate pointer-events-none" title={latestActivity ? latestActivity.description : "Sin seguimientos"}>
                                          {latestActivity ? `"${latestActivity.description}"` : "Sin seguimientos registrados."}
                                      </p>
                                      {latestActivity && (
                                          <p className="text-xs text-muted-foreground pt-1 pointer-events-none">
                                              {format(new Date(latestActivity.createdDate), "dd MMM, yyyy", { locale: es })}
                                          </p>
                                      )}
                                  </div>
                                  <div className="flex items-center gap-x-6 justify-center pt-2 border-t">
                                      <a href={prospect.phone ? `https://wa.me/${(prospect.country === 'US' ? '1' : '52')}${prospect.phone.replace(/\D/g, '')}` : '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => !prospect.phone && e.preventDefault()} className={cn("transition-colors", prospect.phone ? "text-green-500 hover:text-green-600" : "text-muted-foreground/40 cursor-not-allowed")} title={prospect.phone ? `WhatsApp: ${prospect.phone}` : 'No hay teléfono para WhatsApp'}>
                                          <MessageSquare className="h-5 w-5" />
                                      </a>
                                      <a href={prospect.phone ? `sms:${prospect.phone.replace(/\D/g, '')}` : '#'} onClick={(e) => !prospect.phone && e.preventDefault()} className={cn("transition-colors", prospect.phone ? "text-foreground/80 hover:text-foreground" : "text-muted-foreground/40 cursor-not-allowed")} title={prospect.phone ? `Mensaje de Texto: ${prospect.phone}` : 'No hay teléfono'}>
                                          <MessageCircle className="h-5 w-5" />
                                      </a>
                                      <a href={prospect.email ? `https://mail.google.com/mail/?view=cm&fs=1&to=${prospect.email}` : '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => !prospect.email && e.preventDefault()} className={cn("transition-colors", prospect.email ? "text-blue-500 hover:text-blue-600" : "text-muted-foreground/40 cursor-not-allowed")} title={prospect.email ? `Email: ${prospect.email}` : 'No hay email'}>
                                          <Mail className="h-5 w-5" />
                                      </a>
                                      <a href={prospect.phone ? `tel:${prospect.phone}` : '#'} onClick={(e) => !prospect.phone && e.preventDefault()} className={cn("transition-colors", prospect.phone ? "text-foreground/80 hover:text-foreground" : "text-muted-foreground/40 cursor-not-allowed")} title={prospect.phone ? `Llamar: ${prospect.phone}` : 'No hay teléfono'}>
                                          <Phone className="h-5 w-5" />
                                      </a>
                                  </div>
                              </CardContent>
                          </Card>
                        )
                    })
                ) : (
                     <Card className="col-span-full">
                        <CardContent className="h-48 flex items-center justify-center">
                            <p className="text-muted-foreground">No se encontraron prospectos para el filtro actual.</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        ) : (
          <div className="space-y-1.5">
            {filteredProspects.length > 0 ? (
              filteredProspects.map(prospect => {
                if (!prospect.opportunity) return null;
                const classification = getClassification(prospect.opportunity.stage);
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
    
                return (
                  <Card key={prospect.id} className="border-2 border-black bg-muted/50">
                    <CardHeader className="flex flex-row items-start justify-between p-2 pb-0">
                      <div>
                        <Link href={`/dashboard/clients/${prospect.id}`}>
                            <CardTitle className="text-base hover:underline cursor-pointer">{prospect.clientName.toUpperCase()}</CardTitle>
                        </Link>
                        <CardDescription className="text-xs">{prospect.contactPerson.toUpperCase()}</CardDescription>
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
                              href={prospect.phone ? `sms:${prospect.phone.replace(/\D/g, '')}` : '#'}
                              onClick={(e) => !prospect.phone && e.preventDefault()}
                              className={cn(
                                  "transition-colors",
                                  prospect.phone 
                                      ? "text-foreground/80 hover:text-foreground" 
                                      : "text-muted-foreground/40 cursor-not-allowed"
                              )}
                              title={prospect.phone ? `Mensaje de Texto: ${prospect.phone}` : 'No hay teléfono'}
                            >
                              <MessageCircle className="h-5 w-5" />
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
                                <div className="flex flex-wrap gap-2">
                                    <Button size="sm" className="h-8 flex-1 min-w-[150px]" onClick={() => handleNewFollowUpClick(prospect)}>
                                      <PlusCircle className="mr-2 h-4 w-4" />
                                      Seguimiento
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 flex-1 min-w-[150px]"
                                        onClick={() => handleGetSuggestion(prospect)}
                                        disabled={isSuggestionLoading || enrichingProspectId === prospect.id}
                                    >
                                        {isSuggestionLoading && prospectForSuggestion?.id === prospect.id ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Sparkles className="mr-2 h-4 w-4" />
                                        )}
                                        Sugerir Acción
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 flex-1 min-w-[150px]"
                                        onClick={() => handleEnrichProspect(prospect)}
                                        disabled={enrichingProspectId === prospect.id || isSuggestionLoading}
                                    >
                                        {enrichingProspectId === prospect.id ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
                                        )}
                                        Enriquecer
                                    </Button>
                                    {enrichmentHistory[prospect.id] && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 flex-1 min-w-[150px]"
                                            onClick={() => handleUndoEnrichmentClick(prospect.id)}
                                        >
                                            <Undo2 className="mr-2 h-4 w-4" />
                                            Deshacer Enriquecimiento
                                        </Button>
                                    )}
                                </div>
                                {prospect.activities.length > 0 ? (
                                    <div className="space-y-1 pt-2">
                                        <p className="px-2 text-xs font-semibold text-muted-foreground">HISTORIAL DE SEGUIMIENTO:</p>
                                        <Accordion type="single" collapsible className="w-full" defaultValue={prospect.activities[0]?.id}>
                                        {prospect.activities.map((act: any, index: number) => (
                                            <AccordionItem value={act.id} key={act.id} className={cn(
                                                "border-b-0",
                                                index === 0 && "rounded-md border bg-yellow-50 dark:bg-yellow-950/40"
                                            )}>
                                            <div className="flex w-full items-center p-1.5 text-xs rounded-md hover:bg-muted/50 data-[state=open]:bg-muted/50">
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
                                    </div>
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
                                                'flex flex-col items-center gap-1.5 text-center transition-all w-24',
                                                (canMoveTo) ? 'cursor-pointer' : 'cursor-not-allowed',
                                                !isFinancingStage && !isCompleted && !isCurrent && !isNext && 'opacity-50'
                                            )}
                                            title={canMoveTo ? `Mover a: ${stage}` : stage}
                                        >
                                            <div className={cn(
                                                'flex h-8 w-8 items-center justify-center rounded-full border-2 text-primary-foreground transition-all',
                                                (isCompleted || isCurrent) ? 'border-primary bg-primary' : 'border-border bg-card',
                                                isCurrent && 'scale-110 shadow-lg',
                                                !isFinancingStage && canMoveTo && 'hover:border-primary/50'
                                            )}>
                                                {(isCompleted || isCurrent) ? <Check className="h-5 w-5" /> : <span className={cn('text-sm font-bold', 'text-muted-foreground')}>{index + 1}</span>}
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
                                              "h-1 w-full flex-1 transition-colors",
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
                                              <Button variant="secondary" size="sm" className="h-7" onClick={() => handleNewFollowUpClick(prospect, prospect.quotation.id)}>
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
      )}
    </div>
    {prospectForFirstContact && (
        <FirstContactDialog
            open={isFirstContactDialogOpen}
            onOpenChange={setIsFirstContactDialogOpen}
            lead={prospectForFirstContact}
            onConfirm={handleFirstContactSaved}
        />
    )}
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
          opportunityName={currentProspect.clientName.toUpperCase()}
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
        prospectName={currentProspect.clientName.toUpperCase()}
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
      <AlertDialog open={isScheduleFollowUpAlertOpen} onOpenChange={setIsScheduleFollowUpAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Agendar Seguimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              {scheduleFollowUpMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
                setCurrentProspect(null);
                setFollowUpQuotationId(null);
                router.refresh();
              }}>Más Tarde</AlertDialogCancel>
            <AlertDialogAction onClick={handleScheduleFollowUpFromAlert}>Agendar</AlertDialogAction>
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
            prospectName={prospectToDiscard.clientName.toUpperCase()}
            isSubmitting={isSubmitting}
        />
      )}
      <ClientTimelineDialog
        open={isTimelineOpen}
        onOpenChange={setIsTimelineOpen}
        leadId={timelineLeadId}
      />
    </>
  );
}
