'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { Activity } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export interface CompletionPayload {
  activityId: string;
  clientResponded: boolean;
  completionNotes: string;
  scheduleNext: boolean;
  nextFollowUp?: {
    type: string;
    description: string;
    dueDate?: Date;
  };
}

interface CompleteFollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: CompletionPayload) => void;
  isSubmitting: boolean;
  activity: (Activity & { clientName?: string }) | null;
}

export function CompleteFollowUpDialog({ open, onOpenChange, onConfirm, isSubmitting, activity }: CompleteFollowUpDialogProps) {
  const [clientResponded, setClientResponded] = useState<boolean | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextFollowUpType, setNextFollowUpType] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState<Date | undefined>();
  const [nextFollowUpDescription, setNextFollowUpDescription] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      // Reset state when dialog opens
      setClientResponded(null);
      setCompletionNotes('');
      setScheduleNext(false);
      setNextFollowUpType('');
      setNextFollowUpDate(undefined);
      setNextFollowUpDescription('');
    }
  }, [open]);

  const handleConfirm = () => {
    if (!activity) return;

    if (clientResponded === null) {
        toast({
            variant: "destructive",
            title: "Respuesta Requerida",
            description: "Por favor, indique si el cliente respondió.",
        });
        return;
    }
    
    if (scheduleNext) {
      if (!nextFollowUpType) {
        toast({
            variant: "destructive",
            title: "Tipo de Contacto Requerido",
            description: "Por favor, seleccione un tipo para el próximo seguimiento.",
        });
        return;
      }
       if (!nextFollowUpDate) {
        toast({
            variant: "destructive",
            title: "Fecha Requerida",
            description: "Por favor, seleccione una fecha para el próximo seguimiento.",
        });
        return;
      }
    }

    const payload: CompletionPayload = {
      activityId: activity.id,
      clientResponded: clientResponded,
      completionNotes,
      scheduleNext,
    };

    if (scheduleNext) {
      payload.nextFollowUp = {
        type: nextFollowUpType,
        description: nextFollowUpDescription,
        dueDate: nextFollowUpDate,
      };
    }
    
    onConfirm(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" onPointerDownOutside={(e) => { if (e.target instanceof HTMLElement && e.target.closest('[data-radix-popper-content-wrapper]')) { e.preventDefault(); } }}>
        <DialogHeader>
          <DialogTitle>Completar Seguimiento</DialogTitle>
          <DialogDescription>
            Registre el resultado de la actividad para "{activity?.clientName}".
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
          <div className="space-y-4 rounded-lg border p-4">
              <Label className="font-medium">¿HUBO RESPUESTA DEL CLIENTE?</Label>
              <RadioGroup 
                  onValueChange={(value) => setClientResponded(value === 'yes')}
                  className="flex gap-4"
              >
                  <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="r-yes" />
                      <Label htmlFor="r-yes">Sí</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="r-no" />
                      <Label htmlFor="r-no">No</Label>
                  </div>
              </RadioGroup>

              {clientResponded === true && (
                  <div className="space-y-2 pt-4 border-t">
                      <Label htmlFor="completion-notes">Observaciones de la Actividad</Label>
                      <Textarea
                          id="completion-notes"
                          placeholder="Ej: El cliente confirmó la recepción del correo, mencionó que revisará la propuesta el viernes..."
                          value={completionNotes}
                          onChange={(e) => setCompletionNotes(e.target.value)}
                      />
                  </div>
              )}
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="schedule-next" checked={scheduleNext} onCheckedChange={(checked) => setScheduleNext(!!checked)} />
              <Label htmlFor="schedule-next" className="font-medium">Agendar Próximo Seguimiento</Label>
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
                  <Label htmlFor="next-follow-up-desc">Descripción del Próximo Seguimiento</Label>
                  <Textarea
                    id="next-follow-up-desc"
                    placeholder="Ej: Llamar para confirmar decisión sobre la cotización v2."
                    value={nextFollowUpDescription}
                    onChange={(e) => setNextFollowUpDescription(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Completar y Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
