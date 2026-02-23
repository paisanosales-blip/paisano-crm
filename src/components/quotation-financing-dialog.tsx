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

export interface QuotationFinancingConfirmPayload {
  cotizacionFinanciamientoExternoNotes: string;
}

interface QuotationFinancingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: QuotationFinancingConfirmPayload) => void;
  prospectName: string;
  isSubmitting: boolean;
}

export function QuotationFinancingDialog({
  open,
  onOpenChange,
  onConfirm,
  prospectName,
  isSubmitting,
}: QuotationFinancingDialogProps) {
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setNotes('');
    }
  }, [open]);

  const handleConfirm = () => {
    if (!notes.trim()) {
      toast({
        variant: 'destructive',
        title: 'Comentario Requerido',
        description: 'Por favor, ingrese una observación para mover el prospecto a cotización de financiamiento.',
      });
      return;
    }
    onConfirm({ cotizacionFinanciamientoExternoNotes: notes });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mover a Cotización Financiamiento Externo</DialogTitle>
          <DialogDescription>
            Agregue un comentario para mover a "{prospectName}" a la etapa de Cotización Financiamiento Externo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="cotizacionFinanciamientoNotes" className="font-medium text-sm text-foreground">OBSERVACIONES (REQUERIDO)</Label>
                <Textarea
                    id="cotizacionFinanciamientoNotes"
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
