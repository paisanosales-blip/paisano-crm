'use client';

import { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { Opportunity } from '@/lib/types';

export type NegotiationState = {
  acceptedPrice: boolean;
  quotedFreight: boolean;
  requestsDiscount: boolean;
  negotiationNotes: string;
};

export interface NegotiationConfirmPayload extends NegotiationState {}

interface NegotiationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: NegotiationConfirmPayload) => void;
  opportunity: Opportunity;
  isSubmitting: boolean;
}

export function NegotiationDialog({
  open,
  onOpenChange,
  onConfirm,
  opportunity,
  isSubmitting,
}: NegotiationDialogProps) {
  const [negotiationState, setNegotiationState] = useState<NegotiationState>({
    acceptedPrice: false,
    quotedFreight: false,
    requestsDiscount: false,
    negotiationNotes: '',
  });

  const isEditing = opportunity?.stage === 'Negociación' || opportunity?.stage === 'Cierre de venta';

  useEffect(() => {
    if (open && opportunity) {
      setNegotiationState({
        acceptedPrice: opportunity.acceptedPrice || false,
        quotedFreight: opportunity.quotedFreight || false,
        requestsDiscount: opportunity.requestsDiscount || false,
        negotiationNotes: opportunity.negotiationNotes || '',
      });
    }
  }, [open, opportunity]);

  const handleSwitchChange = (id: keyof Omit<NegotiationState, 'negotiationNotes'>, checked: boolean) => {
    setNegotiationState((prev) => ({ ...prev, [id]: checked }));
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNegotiationState((prev) => ({ ...prev, negotiationNotes: e.target.value }));
  };
  
  const handleConfirm = () => {
    onConfirm(negotiationState);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Confirmar'} Negociación</DialogTitle>
          <DialogDescription>
            Para {isEditing ? 'actualizar la información de' : 'mover a'} "{opportunity.name}" a la siguiente etapa, por favor complete los siguientes campos.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
            <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                    <Label htmlFor="acceptedPrice" className="text-sm">¿ACEPTÓ EL PRECIO?</Label>
                    <Switch id="acceptedPrice" checked={negotiationState.acceptedPrice} onCheckedChange={(checked) => handleSwitchChange('acceptedPrice', checked)} />
                </div>
                 <div className="flex items-center justify-between">
                    <Label htmlFor="quotedFreight" className="text-sm">¿SE COTIZÓ FLETE?</Label>
                    <Switch id="quotedFreight" checked={negotiationState.quotedFreight} onCheckedChange={(checked) => handleSwitchChange('quotedFreight', checked)} />
                </div>
                 <div className="flex items-center justify-between">
                    <Label htmlFor="requestsDiscount" className="text-sm">¿SOLICITA DESCUENTO?</Label>
                    <Switch id="requestsDiscount" checked={negotiationState.requestsDiscount} onCheckedChange={(checked) => handleSwitchChange('requestsDiscount', checked)} />
                </div>
            </div>
            
            <div className="space-y-2">
                <Label htmlFor="negotiationNotes" className="font-medium text-sm text-foreground">OBSERVACIONES</Label>
                <Textarea
                    id="negotiationNotes"
                    placeholder="Escriba aquí sus observaciones de la negociación..."
                    value={negotiationState.negotiationNotes}
                    onChange={handleNotesChange}
                />
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Confirmar y Mover')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
