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

export type ClosingState = {
  clientMadeDownPayment: boolean;
  deliveryTimeConfirmed: boolean;
  closingNotes: string;
};

export interface ClosingConfirmPayload extends ClosingState {}

interface ClosingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: ClosingConfirmPayload) => void;
  opportunity: Opportunity;
  isSubmitting: boolean;
}

export function ClosingDialog({
  open,
  onOpenChange,
  onConfirm,
  opportunity,
  isSubmitting,
}: ClosingDialogProps) {
  const [closingState, setClosingState] = useState<ClosingState>({
    clientMadeDownPayment: false,
    deliveryTimeConfirmed: false,
    closingNotes: '',
  });

  const isEditing = opportunity?.stage === 'Cierre de venta';

  useEffect(() => {
    if (open && opportunity) {
      setClosingState({
        clientMadeDownPayment: opportunity.clientMadeDownPayment || false,
        deliveryTimeConfirmed: opportunity.deliveryTimeConfirmed || false,
        closingNotes: opportunity.closingNotes || '',
      });
    }
  }, [open, opportunity]);

  const handleSwitchChange = (id: keyof Omit<ClosingState, 'closingNotes'>, checked: boolean) => {
    setClosingState((prev) => ({ ...prev, [id]: checked }));
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setClosingState((prev) => ({ ...prev, closingNotes: e.target.value }));
  };
  
  const handleConfirm = () => {
    onConfirm(closingState);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Confirmar'} Cierre de Venta</DialogTitle>
          <DialogDescription>
            Para {isEditing ? 'actualizar la información de' : 'mover a'} "{opportunity.name}" a la etapa final, por favor complete los siguientes campos.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
            <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                    <Label htmlFor="clientMadeDownPayment" className="text-sm">¿CLIENTE REALIZÓ EL ANTICIPO?</Label>
                    <Switch id="clientMadeDownPayment" checked={closingState.clientMadeDownPayment} onCheckedChange={(checked) => handleSwitchChange('clientMadeDownPayment', checked)} />
                </div>
                 <div className="flex items-center justify-between">
                    <Label htmlFor="deliveryTimeConfirmed" className="text-sm">¿SE CONFIRMÓ TIEMPO DE ENTREGA?</Label>
                    <Switch id="deliveryTimeConfirmed" checked={closingState.deliveryTimeConfirmed} onCheckedChange={(checked) => handleSwitchChange('deliveryTimeConfirmed', checked)} />
                </div>
            </div>
            
            <div className="space-y-2">
                <Label htmlFor="closingNotes" className="font-medium text-sm text-foreground">OBSERVACIONES (OPCIONAL)</Label>
                <Textarea
                    id="closingNotes"
                    placeholder="Escriba aquí sus observaciones..."
                    value={closingState.closingNotes}
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
