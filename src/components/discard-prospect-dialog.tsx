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

export interface DiscardConfirmPayload {
  reason: string;
}

interface DiscardProspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: DiscardConfirmPayload) => void;
  prospectName: string;
  isSubmitting: boolean;
}

export function DiscardProspectDialog({
  open,
  onOpenChange,
  onConfirm,
  prospectName,
  isSubmitting,
}: DiscardProspectDialogProps) {
  const [reason, setReason] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setReason('');
    }
  }, [open]);

  const handleConfirm = () => {
    if (!reason.trim()) {
      return;
    }
    onConfirm({ reason });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Descartar Prospecto: {prospectName}</DialogTitle>
          <DialogDescription>
            Por favor, especifique el motivo por el cual se descarta este prospecto. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="discardReason" className="font-medium text-sm text-foreground">MOTIVO (REQUERIDO)</Label>
                <Textarea
                    id="discardReason"
                    placeholder="Ej: El cliente eligió a un competidor, el proyecto se canceló, no hay presupuesto, etc."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="min-h-[100px]"
                />
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting} variant="destructive">
            {isSubmitting ? 'Descartando...' : 'Confirmar y Descartar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
