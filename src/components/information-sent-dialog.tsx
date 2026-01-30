'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

export interface InfoSentConfirmPayload extends ChecklistState {
  observations: string;
  nextContactDate?: Date;
  nextContactType: string;
}

interface InformationSentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: InfoSentConfirmPayload) => void;
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
  const [observations, setObservations] = useState('');
  const [nextContactDate, setNextContactDate] = useState<Date>();
  const [nextContactType, setNextContactType] = useState('');

  const handleSwitchChange = (id: keyof ChecklistState, checked: boolean) => {
    setChecklist((prev) => ({ ...prev, [id]: checked }));
  };

  const handleConfirm = () => {
    if (isConfirmDisabled) return;
    onConfirm({
      ...checklist,
      observations,
      nextContactDate,
      nextContactType,
    });
    // Reset state on close
    setChecklist({
      sentPrices: false,
      sentTechnicalInfo: false,
      sentCompanyInfo: false,
      sentMedia: false,
    });
    setObservations('');
    setNextContactDate(undefined);
    setNextContactType('');
    onOpenChange(false);
  };
  
  const isConfirmDisabled = !nextContactDate || !nextContactType || !observations;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar Envío de Información</DialogTitle>
          <DialogDescription>
            Para mover a "{opportunityName}" a la siguiente etapa, por favor confirme qué información se ha enviado y registre el seguimiento.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-4">
            <h4 className="font-medium text-sm text-muted-foreground">CHECKLIST DE ENVÍO</h4>
            {checklistItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border p-3 shadow-sm"
              >
                <Label htmlFor={item.id} className="text-sm font-medium">
                  {item.label}
                </Label>
                <Switch
                  id={item.id}
                  checked={checklist[item.id as keyof ChecklistState]}
                  onCheckedChange={(checked) =>
                    handleSwitchChange(item.id as keyof ChecklistState, checked)
                  }
                />
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="observations" className="font-medium text-sm text-muted-foreground">OBSERVACIONES</Label>
            <Textarea
              id="observations"
              placeholder="Escriba aquí sus observaciones sobre la interacción..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label className="font-medium text-sm text-muted-foreground">PRÓXIMO CONTACTO</Label>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={'outline'}
                    className={cn(
                      'justify-start text-left font-normal',
                      !nextContactDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {nextContactDate ? (
                      format(nextContactDate, 'PPP')
                    ) : (
                      <span>Elegir fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={nextContactDate}
                    onSelect={setNextContactDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Select onValueChange={setNextContactType} value={nextContactType}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de contacto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Llamada">LLAMADA</SelectItem>
                  <SelectItem value="Mensaje">MENSAJE</SelectItem>
                  <SelectItem value="Correo">CORREO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isConfirmDisabled}>
            Confirmar y Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
