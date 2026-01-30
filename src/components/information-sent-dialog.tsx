'use client';

import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import type { Opportunity } from '@/lib/types';

const checklistItems = [
  { id: 'sentPrices', label: '¿SE ENVIARON PRECIOS?' },
  { id: 'sentTechnicalInfo', label: '¿INFORMACION TECNICA?' },
  { id: 'sentCompanyInfo', label: '¿INFORMACION DE LA EMPRESA?' },
  { id: 'sentMedia', label: '¿FOTOS O VIDEOS?' },
];

const contactChannelItems = [
  'WhatsApp', 'Messenger', 'Llamada', 'Mensaje de Texto', 'Correo Electronico'
];


export type ChecklistState = {
  sentPrices: boolean;
  sentTechnicalInfo: boolean;
  sentCompanyInfo: boolean;
  sentMedia: boolean;
};

export interface InfoSentConfirmPayload extends ChecklistState {
  observations?: string;
  contactChannels?: { [key: string]: boolean };
  nextContactDate?: Date;
  nextContactType?: string;
}

interface InformationSentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: InfoSentConfirmPayload) => void;
  opportunity: Opportunity;
}

export function InformationSentDialog({
  open,
  onOpenChange,
  onConfirm,
  opportunity,
}: InformationSentDialogProps) {
  const [checklist, setChecklist] = useState<ChecklistState>({
    sentPrices: false,
    sentTechnicalInfo: false,
    sentCompanyInfo: false,
    sentMedia: false,
  });

  const initialChannelsState = contactChannelItems.reduce((acc, channel) => {
    acc[channel] = false;
    return acc;
  }, {} as { [key: string]: boolean });

  const [contactChannels, setContactChannels] = useState(initialChannelsState);
  const [observations, setObservations] = useState('');
  const [nextContactDate, setNextContactDate] = useState<Date>();
  const [nextContactType, setNextContactType] = useState('');

  const isEditing = opportunity?.stage !== 'Primer contacto';

  useEffect(() => {
    if (open && opportunity) {
        setChecklist({
            sentPrices: opportunity.sentPrices || false,
            sentTechnicalInfo: opportunity.sentTechnicalInfo || false,
            sentCompanyInfo: opportunity.sentCompanyInfo || false,
            sentMedia: opportunity.sentMedia || false,
        });
        // Always reset follow-up fields when dialog opens
        setContactChannels(initialChannelsState);
        setObservations('');
        setNextContactDate(undefined);
        setNextContactType('');
    }
  }, [open, opportunity]);


  const handleSwitchChange = (id: keyof ChecklistState, checked: boolean) => {
    setChecklist((prev) => ({ ...prev, [id]: checked }));
  };

  const handleChannelChange = (channel: string, checked: boolean) => {
    setContactChannels((prev) => ({ ...prev, [channel]: checked }));
  };

  const handleConfirm = () => {
     if (!isEditing && isConfirmDisabled) return;

    let payload: InfoSentConfirmPayload = { ...checklist };

    if (!isEditing) {
      payload = {
        ...payload,
        observations,
        contactChannels,
        nextContactDate,
        nextContactType,
      };
    }
    onConfirm(payload);
  };
  
  const isConfirmDisabled = !nextContactDate || !nextContactType || !observations;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onInteractOutside={e => {
          const target = e.target as HTMLElement;
          // Prevent closing dialog when clicking inside a radix popper (like the calendar)
          if (target.closest('[data-radix-popper-content-wrapper]')) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Confirmar'} Envío de Información</DialogTitle>
          <DialogDescription>
             Para {isEditing ? 'actualizar la información de' : 'mover a'} "{opportunity.name}" a la siguiente etapa, por favor confirme qué información se ha enviado y registre el seguimiento.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="font-medium text-sm text-foreground">CHECKLIST DE ENVÍO</h4>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {checklistItems.map((item) => (
                    <div
                    key={item.id}
                    className="flex items-center justify-between"
                    >
                    <Label htmlFor={item.id} className="text-sm">
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
            </div>

           {!isEditing && (
            <>
                <div className="space-y-3 rounded-lg border p-4">
                    <Label className="font-medium text-sm text-foreground">VÍA DE CONTACTO</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                        {contactChannelItems.map((channel) => (
                        <div key={channel} className="flex items-center space-x-2">
                            <Checkbox
                            id={channel}
                            checked={contactChannels[channel]}
                            onCheckedChange={(checked) => handleChannelChange(channel, !!checked)}
                            />
                            <Label htmlFor={channel} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {channel}
                            </Label>
                        </div>
                        ))}
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="observations" className="font-medium text-sm text-foreground">OBSERVACIONES</Label>
                    <Textarea
                    id="observations"
                    placeholder="Escriba aquí sus observaciones sobre la interacción..."
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    />
                </div>

                <div className="space-y-3">
                    <Label className="font-medium text-sm text-foreground">PRÓXIMO CONTACTO</Label>
                    <div className="grid grid-cols-2 gap-4">
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
            </>
           )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isConfirmDisabled && !isEditing}>
            {isEditing ? 'Guardar Cambios' : 'Confirmar y Mover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
