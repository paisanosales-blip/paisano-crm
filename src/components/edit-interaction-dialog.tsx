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
import { Textarea } from '@/components/ui/textarea';
import type { ServiceInteraction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface EditInteractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (newComment: string) => void;
  interaction: ServiceInteraction | null;
  isSubmitting: boolean;
}

export function EditInteractionDialog({
  open,
  onOpenChange,
  onConfirm,
  interaction,
  isSubmitting,
}: EditInteractionDialogProps) {
  const [comment, setComment] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open && interaction) {
      setComment(interaction.comment || '');
    }
  }, [open, interaction]);

  const handleConfirm = () => {
    if (!comment.trim()) {
      return;
    }
    onConfirm(comment);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Comentario</DialogTitle>
          <DialogDescription>
            Modifique el texto de la interacción. No se puede cambiar el archivo adjunto.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="interaction-comment">Comentario</Label>
                <Textarea
                    id="interaction-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="min-h-[120px]"
                />
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
