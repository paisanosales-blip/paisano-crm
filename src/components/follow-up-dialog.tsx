'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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

const contactChannelItems = [
  'WhatsApp', 'Messenger', 'Llamada', 'Mensaje de Texto', 'Correo Electronico'
];

export interface FollowUpSubmitPayload {
  id?: string;
  observations: string;
  contactChannels: { [key: string]: boolean };
  nextContactDate?: Date;
  nextContactType: string;
}

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: FollowUpSubmitPayload) => void;
  isSubmitting: boolean;
  prospectName: string;
  activity?: any;
}

export function FollowUpDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
  prospectName,
  activity,
}: FollowUpDialogProps) {

  const isEditing = !!activity;
  const initialChannelsState = contactChannelItems.reduce((acc, channel) => {
    acc[channel] = false;
    return acc;
  }, {} as { [key: string]: boolean });

  const [contactChannels, setContactChannels] = useState(initialChannelsState);
  const [observations, setObservations] = useState('');
  const [nextContactDate, setNextContactDate] = useState<Date>();
  const [nextContactType, setNextContactType] = useState('');

  useEffect(() => {
    if (open) {
      if (isEditing && activity) {
        setObservations(activity.description || '');
        setNextContactDate(activity.dueDate ? new Date(activity.dueDate) : undefined);
        setNextContactType(activity.type || '');
        const currentChannels = contactChannelItems.reduce((acc, channel) => {
            acc[channel] = activity.contactChannels?.includes(channel) || false;
            return acc;
        }, {} as { [key: string]: boolean });
        setContactChannels(currentChannels);
      } else {
        setContactChannels(initialChannelsState);
        setObservations('');
        setNextContactDate(undefined);
        setNextContactType('');
      }
    }
  }, [open, activity, isEditing]);

  const handleChannelChange = (channel: string, checked: boolean) => {
    setContactChannels((prev) => ({ ...prev, [channel]: checked }));
  };

  const handleConfirm = () => {
    const payload: FollowUpSubmitPayload = {
      id: activity?.id,
      observations,
      contactChannels,
      nextContactDate,
      nextContactType,
    };
    onConfirm(payload);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl"
        onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-radix-popper-content-wrapper]') || target.closest('.rdp')) {
                e.preventDefault();
            }
        }}
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Seguimiento para {prospectName}</DialogTitle>
          <DialogDescription>
             {isEditing ? 'Modifique los detalles de esta actividad.' : 'Registre una nueva interacción o agende el próximo contacto para este prospecto.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
            <div className="space-y-3 rounded-lg border p-4">
                <Label className="font-medium text-sm text-foreground">VÍA DE CONTACTO</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                    {contactChannelItems.map((channel) => (
                    <div key={channel} className="flex items-center space-x-2">
                        <Checkbox
                        id={`follow-up-${channel}`}
                        checked={contactChannels[channel]}
                        onCheckedChange={(checked) => handleChannelChange(channel, !!checked)}
                        />
                        <Label htmlFor={`follow-up-${channel}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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
                <Label className="font-medium text-sm text-foreground">AGENDAR PRÓXIMO CONTACTO (OPCIONAL)</Label>
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
                        format(nextContactDate, 'PPP', { locale: es })
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
                    <SelectItem value="Nota">NOTA</SelectItem>
                    </SelectContent>
                </Select>
                </div>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Seguimiento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    
