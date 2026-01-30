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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type QuotationDetails = {
  number: string;
  validity: string;
  terms: string;
  notes: string;
};

interface QuotationDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (details: QuotationDetails) => void;
  initialDetails: QuotationDetails;
}

export function QuotationDetailsDialog({
  open,
  onOpenChange,
  onSave,
  initialDetails,
}: QuotationDetailsDialogProps) {
  const [details, setDetails] = useState<QuotationDetails>(initialDetails);

  useEffect(() => {
    if (open) {
      setDetails(initialDetails);
    }
  }, [open, initialDetails]);

  const handleSave = () => {
    onSave(details);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Datos de la Cotización</DialogTitle>
          <DialogDescription>
            Personalice los detalles que aparecerán en el documento PDF de la cotización.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quotation-number">Número de Cotización</Label>
              <Input
                id="quotation-number"
                value={details.number}
                onChange={(e) => setDetails({ ...details, number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quotation-validity">Validez</Label>
              <Input
                id="quotation-validity"
                value={details.validity}
                placeholder="Ej: 30 días"
                onChange={(e) => setDetails({ ...details, validity: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quotation-terms">Términos y Condiciones</Label>
            <Textarea
              id="quotation-terms"
              placeholder="Escriba los términos y condiciones aquí..."
              value={details.terms}
              onChange={(e) => setDetails({ ...details, terms: e.target.value })}
              className="h-24"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quotation-notes">Notas Adicionales</Label>
            <Textarea
              id="quotation-notes"
              placeholder="Información adicional, agradecimientos, etc."
              value={details.notes}
              onChange={(e) => setDetails({ ...details, notes: e.target.value })}
              className="h-20"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Guardar Datos</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
