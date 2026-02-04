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
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { Template } from '@/lib/types';
import { Mail, MessageSquare, MessageCircle, Send } from 'lucide-react';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from './ui/textarea';

interface MassSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
}

export function MassSendDialog({ open, onOpenChange, template }: MassSendDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('registered');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [newContacts, setNewContacts] = useState('');

  const leadsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'leads');
  }, [firestore]);
  const { data: leads, isLoading } = useCollection(leadsQuery);

  useEffect(() => {
    if (open) {
      setSelectedLeadIds(new Set());
      setSearchTerm('');
      setNewContacts('');
      setActiveTab('registered');
    }
  }, [open]);

  const typeInfo = useMemo(() => ({
    Email: { icon: Mail, contactField: 'email', label: 'correo electrónico', placeholder: 'email1@ejemplo.com, email2@ejemplo.com' },
    WhatsApp: { icon: MessageSquare, contactField: 'phone', label: 'teléfono', placeholder: '5551234567, 5557654321' },
    SMS: { icon: MessageCircle, contactField: 'phone', label: 'teléfono', placeholder: '5551234567, 5557654321' },
  }), []);

  const Icon = template ? typeInfo[template.type].icon : Mail;
  const contactField = template ? typeInfo[template.type].contactField : 'email';
  const contactLabel = template ? typeInfo[template.type].label : 'correo electrónico';
  const newContactPlaceholder = template ? typeInfo[template.type].placeholder : '';

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

  const newContactList = useMemo(() => {
    return newContacts.split(/[\n,;]+/).map(c => c.trim()).filter(Boolean);
  }, [newContacts]);

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

  const totalRecipients = activeTab === 'registered' ? selectedLeadIds.size : newContactList.length;

  const handleSend = () => {
    if (totalRecipients === 0) {
      toast({
        variant: 'destructive',
        title: 'Ningún contacto seleccionado',
        description: 'Por favor, seleccione o ingrese al menos un contacto para enviar la plantilla.',
      });
      return;
    }

    // In a real application, you would trigger the mass sending logic here.
    toast({
      title: 'Envío Simulado',
      description: `La plantilla "${template?.name}" se enviaría a ${totalRecipients} contacto(s). Esta funcionalidad es una demostración.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[90vh] md:h-[80vh] flex flex-col" onPointerDownOutside={(e) => { if (e.target instanceof HTMLElement && e.target.closest('[data-radix-popper-content-wrapper]')) { e.preventDefault(); } }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              Envío Masivo: {template?.name}
          </DialogTitle>
          <DialogDescription>
            Elija entre sus prospectos registrados o ingrese nuevos contactos para enviar esta plantilla de tipo "{template?.type}".
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-grow min-h-0">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="registered">Prospectos Registrados</TabsTrigger>
                <TabsTrigger value="new">Nuevos Contactos</TabsTrigger>
            </TabsList>
            <TabsContent value="registered" className="flex-grow flex flex-col min-h-0 mt-4">
                <div className="py-2">
                    <Input 
                        placeholder="Buscar por nombre de cliente o contacto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="flex-grow border rounded-md mt-2 overflow-y-auto">
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
                </div>
            </TabsContent>
            <TabsContent value="new" className="flex-grow flex flex-col min-h-0 mt-4">
                 <div className="flex-grow flex flex-col space-y-2">
                    <Label htmlFor="new-contacts-textarea">Lista de Nuevos Contactos</Label>
                    <Textarea 
                        id="new-contacts-textarea"
                        placeholder={`Pegue aquí una lista de ${contactLabel}s, separados por coma, punto y coma o saltos de línea.\nEj: ${newContactPlaceholder}`}
                        className="flex-grow"
                        value={newContacts}
                        onChange={(e) => setNewContacts(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                        {newContactList.length} contacto(s) detectado(s).
                    </p>
                 </div>
            </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSend} disabled={totalRecipients === 0}>
            <Send className="mr-2 h-4 w-4" />
            Enviar a {totalRecipients} contacto(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
