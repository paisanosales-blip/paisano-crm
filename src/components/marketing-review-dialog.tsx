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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip } from 'lucide-react';
import type { CompletedMarketingTask } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export interface ReviewConfirmPayload {
  reviewStatus: 'Aprobado' | 'Requiere Cambios';
  reviewFeedback: string;
}

interface MarketingReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: ReviewConfirmPayload) => void;
  task: CompletedMarketingTask | null;
  isSubmitting: boolean;
}

export function MarketingReviewDialog({
  open,
  onOpenChange,
  onConfirm,
  task,
  isSubmitting,
}: MarketingReviewDialogProps) {
  const [status, setStatus] = useState<'Aprobado' | 'Requiere Cambios' | ''>('');
  const [feedback, setFeedback] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (task) {
      setStatus(task.reviewStatus === 'Aprobado' ? 'Aprobado' : task.reviewStatus === 'Requiere Cambios' ? 'Requiere Cambios' : '');
      setFeedback(task.reviewFeedback || '');
    }
  }, [task]);

  const handleConfirm = () => {
    if (!status) {
      return;
    }
    if (status === 'Requiere Cambios' && !feedback.trim()) {
      return;
    }
    onConfirm({
      reviewStatus: status,
      reviewFeedback: status === 'Aprobado' ? '' : feedback,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Revisar Tarea de Marketing</DialogTitle>
          <DialogDescription>
            Tarea: "{task?.taskDescription}" completada por {task?.userName}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
          <div className="space-y-2 p-4 border rounded-md bg-muted/50">
            <h4 className="font-semibold">{task?.title}</h4>
            <p className="text-sm whitespace-pre-wrap">{task?.text}</p>
            {task?.fileUrl && (
              <Button asChild size="sm" variant="outline" className="mt-2">
                <a href={task.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Paperclip className="h-3 w-3 mr-2" />
                  {task.fileName || 'Ver Archivo Adjunto'}
                </a>
              </Button>
            )}
          </div>
          
          <div className="space-y-4">
            <Label className="font-medium">Decisión de Revisión</Label>
            <RadioGroup value={status} onValueChange={(value) => setStatus(value as any)} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Aprobado" id="r-aprobado" />
                <Label htmlFor="r-aprobado">Aprobar</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Requiere Cambios" id="r-cambios" />
                <Label htmlFor="r-cambios">Requiere Cambios</Label>
              </div>
            </RadioGroup>
          </div>

          {status === 'Requiere Cambios' && (
            <div className="space-y-2">
              <Label htmlFor="review-feedback">Comentarios para el Usuario (Requerido)</Label>
              <Textarea
                id="review-feedback"
                placeholder="Ej: La imagen es de baja calidad, por favor sube una con mejor resolución. El texto necesita ser más corto..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Revisión'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
