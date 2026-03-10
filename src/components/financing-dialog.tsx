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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export interface FinancingConfirmPayload {
  financiamientoExternoNotes: string;
}

interface FinancingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: FinancingConfirmPayload) => void;
  prospectName: string;
  isSubmitting: boolean;
}

export function FinancingDialog({
  open,
  onOpenChange,
  onConfirm,
  prospectName,
  isSubmitting,
}: FinancingDialogProps) {
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setNotes('');
    }
  }, [open]);

  const handleConfirm = () => {
    if (!notes.trim()) {
      return;
    }
    onConfirm({ financiamientoExternoNotes: notes });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mover a Financiamiento Externo</DialogTitle>
          <DialogDescription>
            Agregue un comentario para mover a "{prospectName}" a la etapa de Financiamiento Externo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="financiamientoNotes" className="font-medium text-sm text-foreground">OBSERVACIONES (REQUERIDO)</Label>
                <Textarea
                    id="financiamientoNotes"
                    placeholder="Escriba aquí sus observaciones (ej. nombre del vendedor externo, banco, etc.)..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Confirmar y Mover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
