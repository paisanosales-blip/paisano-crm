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
import type { Template } from '@/lib/types';
import { Mail, MessageSquare, MessageCircle, User, Send } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface IndividualSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
}

export function IndividualSendDialog({ open, onOpenChange, template }: IndividualSendDialogProps) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [manualContact, setManualContact] = useState('');

  const leadsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'leads');
  }, [firestore]);
  const { data: leads, isLoading } = useCollection(leadsQuery);

  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setManualContact('');
    }
  }, [open]);

  const typeInfo = useMemo(() => ({
    Email: { icon: Mail, contactField: 'email', label: 'correo electrónico', placeholder: 'email@ejemplo.com' },
    WhatsApp: { icon: MessageSquare, contactField: 'phone', label: 'teléfono', placeholder: 'E.g., 1xxxxxxxxxx (con cód. de país)' },
    SMS: { icon: MessageCircle, contactField: 'phone', label: 'teléfono', placeholder: 'E.g., 1xxxxxxxxxx (con cód. de país)' },
  }), []);

  const contactField = template ? typeInfo[template.type].contactField : 'email';
  const newContactPlaceholder = template ? typeInfo[template.type].placeholder : '';

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

  const generateUrl = (contactValue: string, leadCountryCode?: string) => {
    if (!template) return null;
    let url;
    const body = encodeURIComponent(template.content);
    
    if (template.type === 'Email') {
        const subject = encodeURIComponent(template.subject || template.name);
        url = `https://mail.google.com/mail/?view=cm&fs=1&to=${contactValue}&su=${subject}&body=${body}`;
    } else if (template.type === 'WhatsApp') {
        const phone = contactValue.replace(/\D/g, '');
        let prefixedPhone = phone;

        if (leadCountryCode) { // For registered leads
           if (leadCountryCode === 'US' && !phone.startsWith('1')) {
               prefixedPhone = `1${phone}`;
           }
        } else { // For manual sends, default to +1
            // Check if it already has a common country code to avoid double prefixing
            if (!phone.startsWith('1') && !phone.startsWith('52')) {
                prefixedPhone = `1${phone}`;
            }
        }

        url = `https://wa.me/${prefixedPhone}?text=${body}`;
    } else if (template.type === 'SMS') {
        url = `sms:${contactValue}?body=${body}`;
    }
    return url;
  }

  const handleSend = (lead: any) => {
    if (!template) return;
    const contactValue = lead[contactField];
    const url = generateUrl(contactValue, lead.country);

    if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        onOpenChange(false);
    }
  };

  const handleManualSend = () => {
    if (!manualContact.trim()) {
      return;
    }
    const url = generateUrl(manualContact.trim());
    if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Envío Individual: {template?.name}</DialogTitle>
          <DialogDescription>
            Envíe esta plantilla a un contacto nuevo o a uno de sus prospectos registrados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 shrink-0">
            <div>
                <Label htmlFor="manual-contact" className="text-sm font-medium">Enviar a un nuevo contacto</Label>
                <div className="flex gap-2 mt-1">
                    <Input
                        id="manual-contact"
                        placeholder={newContactPlaceholder}
                        value={manualContact}
                        onChange={(e) => setManualContact(e.target.value)}
                    />
                    <Button onClick={handleManualSend}><Send className="h-4 w-4" /></Button>
                </div>
            </div>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                        O
                    </span>
                </div>
            </div>

             <div>
                <Label htmlFor="search-prospect" className="text-sm font-medium">Enviar a un prospecto registrado</Label>
                <Input 
                    id="search-prospect"
                    placeholder="Buscar prospecto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mt-1"
                />
             </div>
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
                                <div className="font-semibold">{lead.clientName.toUpperCase()}</div>
                                <div className="text-sm text-muted-foreground">{lead.contactPerson.toUpperCase()} - {lead[contactField]}</div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
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
