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
import { Checkbox } from '@/components/ui/checkbox';
import type { Opportunity } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export interface InfoSentConfirmPayload {
  checklist: ChecklistState;
  notes: string;
  contactChannels: { [key: string]: boolean };
  scheduleNext: boolean;
  nextFollowUp?: {
    type: string;
    description: string;
    dueDate?: Date;
  };
}

interface InformationSentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: InfoSentConfirmPayload) => void;
  opportunity: Opportunity;
  isSubmitting: boolean;
}

export function InformationSentDialog({
  open,
  onOpenChange,
  onConfirm,
  opportunity,
  isSubmitting,
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

  const [notes, setNotes] = useState('');
  const [contactChannels, setContactChannels] = useState(initialChannelsState);

  const [scheduleNext, setScheduleNext] = useState(true);
  const [nextFollowUpType, setNextFollowUpType] = useState('Llamada');
  const [nextFollowUpDate, setNextFollowUpDate] = useState<Date | undefined>(() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
  });
  const [nextFollowUpDescription, setNextFollowUpDescription] = useState('');

  const isEditing = opportunity?.stage !== 'Primer contacto';

  useEffect(() => {
    if (open) {
      if (opportunity) {
        setChecklist({
          sentPrices: opportunity.sentPrices || false,
          sentTechnicalInfo: opportunity.sentTechnicalInfo || false,
          sentCompanyInfo: opportunity.sentCompanyInfo || false,
          sentMedia: opportunity.sentMedia || false,
        });
        setNotes(opportunity.infoSentNotes || '');
        const currentChannels = contactChannelItems.reduce((acc, channel) => {
            acc[channel] = opportunity.infoSentContactChannels?.includes(channel) || false;
            return acc;
        }, {} as { [key: string]: boolean });
        setContactChannels(currentChannels);
      } else {
        // Reset if no opportunity
        setChecklist({ sentPrices: false, sentTechnicalInfo: false, sentCompanyInfo: false, sentMedia: false });
        setNotes('');
        setContactChannels(initialChannelsState);
      }
      // Reset follow-up state
      setScheduleNext(true);
      setNextFollowUpType('Llamada');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setNextFollowUpDate(tomorrow);
      setNextFollowUpDescription('');
    }
  }, [open, opportunity]);


  const handleSwitchChange = (id: keyof ChecklistState, checked: boolean) => {
    setChecklist((prev) => ({ ...prev, [id]: checked }));
  };

  const handleChannelChange = (channel: string, checked: boolean) => {
    setContactChannels((prev) => ({ ...prev, [channel]: checked }));
  };

  const handleConfirm = () => {
    const payload: InfoSentConfirmPayload = { checklist, notes, contactChannels, scheduleNext };
    if (scheduleNext) {
        payload.nextFollowUp = {
            type: nextFollowUpType,
            description: nextFollowUpDescription,
            dueDate: nextFollowUpDate
        }
    }
    onConfirm(payload);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[80vh] flex flex-col"
        onPointerDownOutside={(e) => {
            if (e.target instanceof HTMLElement && e.target.closest('[data-radix-popper-content-wrapper]')) {
                e.preventDefault();
            }
        }}
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Confirmar'} Envío de Información</DialogTitle>
          <DialogDescription>
             Para {isEditing ? 'actualizar la información de' : 'mover a'} "{opportunity?.name}" a la siguiente etapa, confirme qué información se ha enviado y registre la interacción.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4 flex-grow overflow-y-auto pr-4 -mr-2">
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

            <div className="space-y-4 rounded-lg border p-4">
                <h4 className="font-medium text-sm text-foreground">REGISTRAR INTERACCIÓN (OPCIONAL)</h4>
                 <div className="space-y-3">
                    <Label className="font-medium text-sm text-foreground">Vía de Contacto</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                        {contactChannelItems.map((channel) => (
                        <div key={channel} className="flex items-center space-x-2">
                            <Checkbox
                            id={`info-sent-${channel}`}
                            checked={contactChannels[channel]}
                            onCheckedChange={(checked) => handleChannelChange(channel, !!checked)}
                            />
                            <Label htmlFor={`info-sent-${channel}`} className="text-sm font-medium leading-none">
                            {channel}
                            </Label>
                        </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="info-sent-notes" className="font-medium text-sm text-foreground">Observaciones</Label>
                    <Textarea
                    id="info-sent-notes"
                    placeholder="Escriba aquí sus observaciones sobre el envío..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center space-x-2">
                    <Checkbox id="schedule-next-info-sent" checked={scheduleNext} onCheckedChange={(checked) => setScheduleNext(!!checked)} />
                    <Label htmlFor="schedule-next-info-sent" className="font-medium">Agendar Próximo Seguimiento</Label>
                </div>

                {scheduleNext && (
                    <div className="grid gap-4 pt-4 border-t">
                        <div className="grid grid-cols-2 gap-4">
                            <Popover modal={true}>
                                <PopoverTrigger asChild>
                                <Button variant="outline" className={cn('justify-start text-left font-normal', !nextFollowUpDate && 'text-muted-foreground')}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {nextFollowUpDate ? format(nextFollowUpDate, 'PPP', { locale: es }) : <span>Elegir fecha</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={nextFollowUpDate} onSelect={setNextFollowUpDate} initialFocus />
                                </PopoverContent>
                            </Popover>
                            <Select onValueChange={setNextFollowUpType} value={nextFollowUpType}>
                                <SelectTrigger>
                                <SelectValue placeholder="Tipo de contacto" />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem value="Llamada">LLAMADA</SelectItem>
                                <SelectItem value="Mensaje">MENSAJE</SelectItem>
                                <SelectItem value="Mensaje de Texto">MENSAJE DE TEXTO</SelectItem>
                                <SelectItem value="Correo">CORREO</SelectItem>
                                <SelectItem value="Reunión">REUNIÓN</SelectItem>
                                <SelectItem value="Nota">NOTA</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="next-follow-up-desc-info-sent">Descripción del Próximo Seguimiento</Label>
                            <Textarea
                                id="next-follow-up-desc-info-sent"
                                placeholder="Ej: Llamar para confirmar recepción de información..."
                                value={nextFollowUpDescription}
                                onChange={(e) => setNextFollowUpDescription(e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
        <DialogFooter className="flex-shrink-0">
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
