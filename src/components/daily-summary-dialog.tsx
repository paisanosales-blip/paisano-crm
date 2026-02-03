'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Sparkles } from 'lucide-react';

interface DailySummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: string;
  isLoading: boolean;
  userName: string;
}

export function DailySummaryDialog({
  open,
  onOpenChange,
  summary,
  isLoading,
  userName,
}: DailySummaryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>¡Buenos días, {userName}!</span>
          </DialogTitle>
          <DialogDescription>
            Aquí tienes tu resumen y enfoque para hoy.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <p className="text-sm text-foreground whitespace-pre-wrap">{summary}</p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            ¡A por el día!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
