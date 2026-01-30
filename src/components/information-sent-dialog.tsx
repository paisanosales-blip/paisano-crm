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
        }
        // Reset interaction log fields every time
        setNotes('');
        setContactChannels(initialChannelsState);
    }
  }, [open, opportunity]);


  const handleSwitchChange = (id: keyof ChecklistState, checked: boolean) => {
    setChecklist((prev) => ({ ...prev, [id]: checked }));
  };

  const handleChannelChange = (channel: string, checked: boolean) => {
    setContactChannels((prev) => ({ ...prev, [channel]: checked }));
  };

  const handleConfirm = () => {
    onConfirm({ checklist, notes, contactChannels });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => {
            const target = e.originalEvent.target as HTMLElement;
            if (target.closest('[data-radix-popper-content-wrapper]') || target.closest('.rdp')) {
                e.preventDefault();
            }
        }}
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Confirmar'} Envío de Información</DialogTitle>
          <DialogDescription>
             Para {isEditing ? 'actualizar la información de' : 'mover a'} "{opportunity.name}" a la siguiente etapa, confirme qué información se ha enviado y registre la interacción.
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

    
