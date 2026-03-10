'use client';

import { useState, useEffect } from 'react';
import {
  useFirestore,
  useUser,
  useDoc,
  useMemoFirebase,
  addDocumentNonBlocking,
} from '@/firebase';
import { collection, doc, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from './ui/checkbox';

export interface FirstContactConfirmPayload {
  lead: any;
  opportunity: any;
}

interface FirstContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: FirstContactConfirmPayload) => void;
  lead: any | null;
}

export function FirstContactDialog({
  open,
  onOpenChange,
  onConfirm,
  lead,
}: FirstContactDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [observation, setObservation] = useState('');
  const [scheduleInfoFollowUp, setScheduleInfoFollowUp] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  useEffect(() => {
    if (open) {
      setObservation('');
      setScheduleInfoFollowUp(true);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!firestore || !user || !userProfile || !lead) {
      return;
    }
    if (!observation.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const opportunityData = {
        leadId: lead.id,
        sellerId: user.uid,
        sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
        stage: 'Primer contacto' as const,
        name: `Oportunidad para ${lead.clientName.toUpperCase()}`,
        value: 0,
        currency: 'USD',
        probability: 10,
        createdDate: new Date().toISOString(),
        expectedCloseDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
      };
      
      const opportunityRef = await addDoc(collection(firestore, 'opportunities'), opportunityData);

      if (observation) {
        const activityData = {
          leadId: lead.id,
          sellerId: user.uid,
          sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
          type: 'Nota' as const,
          description: observation,
          completed: true,
          createdDate: new Date().toISOString(),
          completedDate: new Date().toISOString(),
        };
        addDocumentNonBlocking(collection(firestore, 'activities'), activityData);
      }

      if (scheduleInfoFollowUp) {
        const followUpData = {
          leadId: lead.id,
          sellerId: user.uid,
          sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
          type: 'Nota' as const,
          description: 'PENDIENTE ENVIAR INFORMACIÓN',
          completed: false,
          createdDate: new Date().toISOString(),
          dueDate: new Date().toISOString(),
        };
        addDocumentNonBlocking(collection(firestore, 'activities'), followUpData);
      }

      onConfirm({ lead, opportunity: { ...opportunityData, id: opportunityRef.id } });
      onOpenChange(false);

    } catch (error) {
      console.error('Error registering first contact:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Primer Contacto</DialogTitle>
          <DialogDescription>
            Agregue una observación sobre su primer contacto con {lead?.clientName.toUpperCase()}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="observation-notes">Observaciones (Requerido)</Label>
                <Textarea
                    id="observation-notes"
                    placeholder="Ej. El cliente mostró interés en el remolque Sand Hopper, necesita una cotización para 2 unidades..."
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    className="min-h-[120px]"
                />
            </div>
             <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="schedule-info-follow-up"
                checked={scheduleInfoFollowUp}
                onCheckedChange={(checked) => setScheduleInfoFollowUp(!!checked)}
              />
              <Label htmlFor="schedule-info-follow-up" className="text-sm font-medium leading-none cursor-pointer">
                PENDIENTE ENVIAR INFORMACIÓN
              </Label>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar y Continuar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
