'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { FileUp, FilePlus } from 'lucide-react';

interface QuotationChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCreate: () => void;
  onSelectUpload: () => void;
}

export function QuotationChoiceDialog({
  open,
  onOpenChange,
  onSelectCreate,
  onSelectUpload,
}: QuotationChoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Cotización</DialogTitle>
          <DialogDescription>
            ¿Cómo quieres proceder con la cotización para este prospecto?
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <Button variant="outline" className="h-24 flex-col gap-2" onClick={onSelectCreate}>
            <FilePlus className="h-8 w-8" />
            <span className="font-semibold">Crear Nueva Cotización</span>
          </Button>
          <Button variant="outline" className="h-24 flex-col gap-2" onClick={onSelectUpload}>
            <FileUp className="h-8 w-8" />
            <span className="font-semibold">Cargar PDF Existente</span>
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
