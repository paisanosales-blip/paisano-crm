'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { Template } from '@/lib/types';
import { Mail, MessageSquare, MessageCircle, Send } from 'lucide-react';
import { Input } from './ui/input';

interface MassSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
}

export function MassSendDialog({ open, onOpenChange, template }: MassSendDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const leadsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'leads');
  }, [firestore]);
  const { data: leads, isLoading } = useCollection(leadsQuery);

  useEffect(() => {
    if (open) {
      setSelectedLeadIds(new Set());
      setSearchTerm('');
    }
  }, [open]);

  const typeInfo = useMemo(() => ({
    Email: { icon: Mail, contactField: 'email', label: 'correo electrónico' },
    WhatsApp: { icon: MessageSquare, contactField: 'phone', label: 'teléfono' },
    SMS: { icon: MessageCircle, contactField: 'phone', label: 'teléfono' },
  }), []);

  const Icon = template ? typeInfo[template.type].icon : Mail;
  const contactField = template ? typeInfo[template.type].contactField : 'email';
  const contactLabel = template ? typeInfo[template.type].label : 'correo electrónico';

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    const lowercasedQuery = searchTerm.toLowerCase();
    
    const relevantLeads = (leads as any[]).filter(lead => {
        if (template?.type === 'Email') return !!lead.email;
        if (template?.type === 'WhatsApp' || template?.type === 'SMS') return !!lead.phone;
        return false;
    });

    if (!searchTerm) return relevantLeads;

    return relevantLeads.filter(lead => 
      lead.clientName.toLowerCase().includes(lowercasedQuery) || 
      (lead.contactPerson && lead.contactPerson.toLowerCase().includes(lowercasedQuery))
    );
  }, [leads, searchTerm, template]);

  const handleLeadSelect = (leadId: string, checked: boolean) => {
    setSelectedLeadIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(leadId);
      } else {
        newSet.delete(leadId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeadIds(new Set(filteredLeads.map(l => l.id)));
    } else {
      setSelectedLeadIds(new Set());
    }
  };

  const handleSend = () => {
    if (selectedLeadIds.size === 0) {
      toast({
        variant: 'destructive',
        title: 'Ningún contacto seleccionado',
        description: 'Por favor, seleccione al menos un contacto para enviar la plantilla.',
      });
      return;
    }

    // In a real application, you would trigger the mass sending logic here.
    toast({
      title: 'Envío Simulado',
      description: `La plantilla "${template?.name}" se enviaría a ${selectedLeadIds.size} contacto(s). Esta funcionalidad es una demostración.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col" onPointerDownOutside={(e) => { if (e.target instanceof HTMLElement && e.target.closest('[data-radix-popper-content-wrapper]')) { e.preventDefault(); } }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              Envío Masivo: {template?.name}
          </DialogTitle>
          <DialogDescription>
            Seleccione los contactos a los que desea enviar esta plantilla de tipo "{template?.type}". Solo se mostrarán contactos con {contactLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
            <Input 
                placeholder="Buscar por nombre de cliente o contacto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        
        <div className="flex-grow relative border rounded-md">
            <ScrollArea className="absolute inset-0">
                <div className="p-4 space-y-1">
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
                    ) : filteredLeads.length > 0 ? (
                        <>
                        <div className="flex items-center space-x-3 sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-3 -mt-4 px-4 -mx-4 border-b">
                            <Checkbox 
                                id="select-all"
                                checked={selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0}
                                onCheckedChange={(checked) => handleSelectAll(!!checked)}
                            />
                            <Label htmlFor="select-all" className="text-sm font-medium leading-none cursor-pointer">
                                Seleccionar todos ({selectedLeadIds.size} / {filteredLeads.length})
                            </Label>
                        </div>
                        {filteredLeads.map((lead: any) => (
                            <div key={lead.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50">
                                <Checkbox 
                                    id={lead.id} 
                                    checked={selectedLeadIds.has(lead.id)}
                                    onCheckedChange={(checked) => handleLeadSelect(lead.id, !!checked)}
                                />
                                <Label htmlFor={lead.id} className="flex-grow font-normal cursor-pointer">
                                    <div className="font-semibold">{lead.clientName}</div>
                                    <div className="text-sm text-muted-foreground">{lead.contactPerson} - {lead[contactField]}</div>
                                </Label>
                            </div>
                        ))}
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-48 text-muted-foreground">
                            <p>No se encontraron contactos con {contactLabel}.</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSend} disabled={selectedLeadIds.size === 0}>
            <Send className="mr-2 h-4 w-4" />
            Enviar a {selectedLeadIds.size} contacto(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
