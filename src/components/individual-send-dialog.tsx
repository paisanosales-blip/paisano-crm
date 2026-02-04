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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { Template } from '@/lib/types';
import { Mail, MessageSquare, MessageCircle, User } from 'lucide-react';
import { Input } from './ui/input';

interface IndividualSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
}

export function IndividualSendDialog({ open, onOpenChange, template }: IndividualSendDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const leadsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'leads');
  }, [firestore]);
  const { data: leads, isLoading } = useCollection(leadsQuery);

  useEffect(() => {
    if (open) {
      setSearchTerm('');
    }
  }, [open]);

  const typeInfo = useMemo(() => ({
    Email: { icon: Mail, contactField: 'email', label: 'correo electrónico' },
    WhatsApp: { icon: MessageSquare, contactField: 'phone', label: 'teléfono' },
    SMS: { icon: MessageCircle, contactField: 'phone', label: 'teléfono' },
  }), []);

  const contactField = template ? typeInfo[template.type].contactField : 'email';

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    const lowercasedQuery = searchTerm.toLowerCase();
    
    const relevantLeads = (leads as any[]).filter(lead => !!lead[contactField]);

    if (!searchTerm) return relevantLeads;

    return relevantLeads.filter(lead => 
      lead.clientName.toLowerCase().includes(lowercasedQuery) || 
      (lead.contactPerson && lead.contactPerson.toLowerCase().includes(lowercasedQuery))
    );
  }, [leads, searchTerm, template, contactField]);

  const handleSend = (lead: any) => {
    if (!template) return;

    let url;
    const body = encodeURIComponent(template.content);
    const contact = lead[contactField];

    if (template.type === 'Email') {
        const subject = encodeURIComponent(template.name);
        url = `https://mail.google.com/mail/?view=cm&fs=1&to=${contact}&su=${subject}&body=${body}`;
    } else if (template.type === 'WhatsApp') {
        const phone = contact.replace(/\D/g, '');
        const prefixedPhone = (lead.country === 'US' && !phone.startsWith('1')) ? `1${phone}` : phone;
        url = `https://wa.me/${prefixedPhone}?text=${body}`;
    } else if (template.type === 'SMS') {
        url = `sms:${contact}?body=${body}`;
    }

    if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        toast({
            title: 'Redireccionando...',
            description: `Se está abriendo la aplicación para enviar el mensaje a ${lead.clientName}.`,
        });
        onOpenChange(false);
    } else {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se pudo generar el enlace de envío.',
        });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Envío Individual: {template?.name}</DialogTitle>
          <DialogDescription>
            Seleccione un prospecto para enviarle esta plantilla.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 shrink-0">
            <Input 
                placeholder="Buscar prospecto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        
        <div className="flex-grow border rounded-md mt-2 overflow-y-auto">
            <div className="p-2 space-y-1">
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
                ) : filteredLeads.length > 0 ? (
                    filteredLeads.map((lead: any) => (
                        <div key={lead.id} className="flex items-center p-2 rounded-md hover:bg-muted/50 cursor-pointer" onClick={() => handleSend(lead)}>
                            <User className="h-5 w-5 mr-3 text-muted-foreground" />
                            <div className="flex-grow">
                                <div className="font-semibold">{lead.clientName}</div>
                                <div className="text-sm text-muted-foreground">{lead.contactPerson} - {lead[contactField]}</div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex items-center justify-center h-48 text-muted-foreground">
                        <p>No se encontraron prospectos.</p>
                    </div>
                )}
            </div>
        </div>

        <DialogFooter className="mt-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
