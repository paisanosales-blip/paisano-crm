'use client';

import { useState } from 'react';
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

const checklistItems = [
  { id: 'sentPrices', label: '¿SE ENVIARON PRECIOS?' },
  { id: 'sentTechnicalInfo', label: '¿INFORMACION TECNICA?' },
  { id: 'sentCompanyInfo', label: '¿INFORMACION DE LA EMPRESA?' },
  { id: 'sentMedia', label: '¿FOTOS O VIDEOS?' },
];

export type ChecklistState = {
  sentPrices: boolean;
  sentTechnicalInfo: boolean;
  sentCompanyInfo: boolean;
  sentMedia: boolean;
};

interface InformationSentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (checklist: ChecklistState) => void;
  opportunityName: string;
}

export function InformationSentDialog({
  open,
  onOpenChange,
  onConfirm,
  opportunityName,
}: InformationSentDialogProps) {
  const [checklist, setChecklist] = useState<ChecklistState>({
    sentPrices: false,
    sentTechnicalInfo: false,
    sentCompanyInfo: false,
    sentMedia: false,
  });

  const handleSwitchChange = (id: keyof ChecklistState, checked: boolean) => {
    setChecklist((prev) => ({ ...prev, [id]: checked }));
  };
  
  const handleConfirm = () => {
    onConfirm(checklist);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Confirmar Envío de Información</DialogTitle>
          <DialogDescription>
            Para mover a "{opportunityName}" a la siguiente etapa, por favor confirme qué información se ha enviado.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {checklistItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <Label htmlFor={item.id} className="text-sm font-medium">
                {item.label}
              </Label>
              <Switch
                id={item.id}
                checked={checklist[item.id as keyof ChecklistState]}
                onCheckedChange={(checked) => handleSwitchChange(item.id as keyof ChecklistState, checked)}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>Confirmar y Mover</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
