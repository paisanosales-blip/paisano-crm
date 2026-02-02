'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Loader2, Sparkles } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { draftFollowUpScript, type DraftFollowUpScriptInput } from '@/ai/flows/draft-follow-up-script';

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
  prospect: any;
  activity?: any;
}

export function FollowUpDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
  prospect,
  activity,
}: FollowUpDialogProps) {

  const isEditing = !!activity;
  const { toast } = useToast();
  const initialChannelsState = contactChannelItems.reduce((acc, channel) => {
    acc[channel] = false;
    return acc;
  }, {} as { [key: string]: boolean });

  const [contactChannels, setContactChannels] = useState(initialChannelsState);
  const [observations, setObservations] = useState('');
  const [nextContactDate, setNextContactDate] = useState<Date>();
  const [nextContactType, setNextContactType] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

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

  const handleGenerateDraft = async () => {
    if (!prospect) {
      toast({ title: "Error", description: "No se encontró el prospecto.", variant: "destructive" });
      return;
    }
    if (!nextContactType || nextContactType === '') {
      toast({ title: "Tipo de contacto requerido", description: "Seleccione un tipo de contacto antes de generar un borrador.", variant: "destructive" });
      return;
    }
  
    setIsGenerating(true);
    try {
      const pastInteractions = prospect.activities?.length > 0
        ? prospect.activities
            .slice(0, 5) // Limit to last 5 interactions for brevity
            .map((act: any) => `- ${format(new Date(act.createdDate), "PP", { locale: es })}: ${act.type} - "${act.description || 'Sin descripción'}"`)
            .join('\n')
        : 'No hay interacciones pasadas.';
      
      const clientDetails = `Nombre: ${prospect.clientName}, Tipo: ${prospect.clientType}, Contacto: ${prospect.contactPerson}, Ubicación: ${prospect.city}, ${prospect.country}.`;
  
      const input: DraftFollowUpScriptInput = {
        clientDetails,
        followUpType: nextContactType,
        salesPipelineStage: prospect.opportunity?.stage || 'No disponible',
        quotationStatus: prospect.quotation?.status || 'No existe',
        pastInteractions,
      };
  
      const result = await draftFollowUpScript(input);
      setObservations(result.draft);
      
    } catch(e) {
      console.error("Error generating draft:", e);
      toast({ title: "Error de IA", description: "No se pudo generar el borrador.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirm = () => {
    // If it's a new activity (not editing), and it's a scheduled task (not just a note), then date and type are required.
    if (!isEditing && nextContactType && nextContactType !== 'Nota' && !nextContactDate) {
      toast({
        variant: 'destructive',
        title: 'Fecha Requerida',
        description: 'Por favor, seleccione una fecha para agendar el próximo contacto.',
      });
      return;
    }
    // If a date is selected, a specific type (not 'Nota') must also be selected.
    if (nextContactDate && (!nextContactType || nextContactType === 'Nota')) {
      toast({
        variant: 'destructive',
        title: 'Tipo de Contacto Requerido',
        description: 'Por favor, seleccione un tipo de contacto (Llamada, Mensaje, Correo) cuando agende una fecha.',
      });
      return;
    }

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
      <DialogContent className="sm:max-w-xl" onPointerDownOutside={(e) => { if (e.target instanceof HTMLElement && e.target.closest('[data-radix-popper-content-wrapper]')) { e.preventDefault(); } }}>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Seguimiento para {prospect.clientName}</DialogTitle>
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
            
            <div className="space-y-3">
                <Label className="font-medium text-sm text-foreground">AGENDAR PRÓXIMO CONTACTO (OPCIONAL)</Label>
                <div className="grid grid-cols-2 gap-4">
                <Popover modal={true}>
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
                    <SelectItem value="Reunión">REUNIÓN</SelectItem>
                    <SelectItem value="Nota">NOTA</SelectItem>
                    </SelectContent>
                </Select>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label htmlFor="observations" className="font-medium text-sm text-foreground">OBSERVACIONES</Label>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateDraft}
                        disabled={isGenerating || !nextContactType}
                    >
                        {isGenerating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        Generar borrador
                    </Button>
                </div>
                <Textarea
                  id="observations"
                  placeholder="Escriba sus observaciones o genere un borrador con IA..."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="min-h-[120px]"
                />
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
