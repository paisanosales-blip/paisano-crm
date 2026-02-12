'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, useStorage } from '@/firebase';
import { collection, query, where, doc, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, PlusCircle, FileDown, Settings } from 'lucide-react';
import { QuotationDetailsDialog, type QuotationDetails } from '@/components/quotation-details-dialog';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Checkbox } from '@/components/ui/checkbox';
import type { Product } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'qrcode';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { countries, states, cities } from '@/lib/geography';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

type QuotationItem = {
  productId: string;
  description: string;
  quantity: number;
  price: number;
  individualFreight: number;
};

type Client = {
  id: string;
  clientName: string;
  contactPerson: string;
  email: string;
  phone: string;
  country: string;
  state: string;
  city: string;
};

const newTerms = 'All applicable tariffs and taxes included in this quotation or invoice correspond exclusively to those in effect as of the date of issuance of this document, as of today. The Customer agrees to accept delivery of the products described herein and to pay the total amount stated in full. The quoted price is valid only on the date this document is issued. The Customer shall be solely and exclusively responsible for the payment of any and all additional taxes, tariffs, duties, fees, charges, or other governmental assessments of any nature whatsoever, whether local, state, or federal, including, without limitation, any increase, adjustment, or new charge imposed by the United States federal government or by any state or local authority after the date of issuance of this quotation or invoice.';

const contactMethods = [
  'REDES SOCIALES',
  'PUBLICIDAD',
  'BUSQUEDA EN GOOGLE',
  'BUSQUEDA EN MAPS',
];

const customClientSchema = z
  .object({
    contactPerson: z.string().min(1, 'El nombre del cliente es requerido.'),
    clientName: z.string().min(1, 'El nombre de la empresa es requerido.'),
    country: z.string().min(1, 'El país es requerido.'),
    state: z.string().optional(),
    city: z.string().optional(),
    contactMethod: z.string().min(1, 'La forma de contacto es requerida.'),
    language: z.string().min(1, 'El idioma es requerido.'),
    clientType: z.string().min(1, 'El tipo de cliente es requerido.'),
    website: z.preprocess(
      (val) => {
        if (typeof val !== 'string' || !val) return val;
        if (!val.startsWith('http://') && !val.startsWith('https://')) return `https://${val}`;
        return val;
      },
      z.string().url({ message: 'URL de sitio web inválida.' }).optional().or(z.literal(''))
    ),
    phone: z.string().optional(),
    email: z.string().email({ message: 'Correo electrónico inválido.' }).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (!data.website && !data.phone && !data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Se requiere al menos un método de contacto (email, teléfono o sitio web).',
      });
    }
  });

type CustomClientFormValues = z.infer<typeof customClientSchema>;


export default function NewQuotationPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const leadsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'leads'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  const { data: leads, isLoading: areLeadsLoading } = useCollection(leadsQuery);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'products');
  }, [firestore]);
  const { data: allProducts, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);
  
  const [clientMode, setClientMode] = useState<'registered' | 'custom'>('registered');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [items, setItems] = useState<QuotationItem[]>([
    { productId: '', description: '', quantity: 1, price: 0, individualFreight: 0 },
  ]);
  const [freight, setFreight] = useState(0);
  const [freightTo, setFreightTo] = useState('');
  const [isIndividualFreight, setIsIndividualFreight] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [quotationDetails, setQuotationDetails] = useState<QuotationDetails>({
    number: '',
    validity: '30 DAYS',
    terms: newTerms,
    notes: 'THANK YOU FOR YOUR PREFERENCE.',
  });
  const [currency, setCurrency] = useState('USD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignToCompany, setAssignToCompany] = useState(false);

  const customClientForm = useForm<CustomClientFormValues>({
    resolver: zodResolver(customClientSchema),
    defaultValues: {
      contactPerson: '', clientName: '', country: '', state: '', city: '',
      contactMethod: '', language: 'Español', clientType: '', website: '', phone: '', email: '',
    },
  });

  const selectedCountry = customClientForm.watch('country');
  const selectedState = customClientForm.watch('state');
  const availableStates = selectedCountry ? states[selectedCountry] || [] : [];
  const availableCities = selectedState ? cities[selectedState] || [] : [];

  useEffect(() => {
    const lastNumberStr = localStorage.getItem('lastQuotationNumber');
    const lastNumber = lastNumberStr ? parseInt(lastNumberStr, 10) : 1000;
    const nextNumber = lastNumber + 1;
    setQuotationDetails(prev => ({
      ...prev,
      number: `QT-${String(nextNumber).padStart(6, '0')}`,
    }));
  }, []);

  const selectedClient = useMemo(() => {
    if (!leads || !selectedClientId) return null;
    return (leads as Client[]).find(lead => lead.id === selectedClientId) || null;
  }, [leads, selectedClientId]);

  const handleItemChange = (index: number, field: keyof QuotationItem, value: string | number) => {
    const newItems = [...items];
    if (typeof newItems[index][field] === 'number') {
      newItems[index] = { ...newItems[index], [field]: Number(value) < 0 ? 0 : Number(value) };
    } else {
      newItems[index] = { ...newItems[index], [field]: value as string };
    }
    setItems(newItems);
  };
  
  const handleProductSelect = (index: number, newProductId: string) => {
      if (!allProducts) return;
      const selectedProd = allProducts.find(p => p.id === newProductId);
      if (!selectedProd) return;

      const newItems = [...items];
      const description = selectedProd.summary
        ? `${selectedProd.name}\n${selectedProd.summary}`
        : selectedProd.name;

      newItems[index] = {
          ...newItems[index],
          productId: newProductId,
          description: description,
          price: selectedProd.price,
      };
      setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { productId: '', description: '', quantity: 1, price: 0, individualFreight: 0 }]);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + item.quantity * item.price, 0);
  }, [items]);

  const total = useMemo(() => {
    const productsTotal = subtotal;
    if (isIndividualFreight) {
      const individualFreightsTotal = items.reduce((acc, item) => acc + (item.individualFreight || 0) * item.quantity, 0);
      return productsTotal + individualFreightsTotal;
    }
    return productsTotal + freight;
  }, [subtotal, freight, items, isIndividualFreight]);
  
  const handleGenerateAndSave = async () => {
    if (!firestore || !user || !userProfile || !storage) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, inicie sesión.' });
      return;
    }
    if (items.length === 0 || items.every(i => i.price === 0)) {
        toast({ variant: 'destructive', title: 'Error', description: 'Debe agregar al menos un producto con precio a la cotización.' });
        return;
    }
    if (((!isIndividualFreight && freight > 0) || isIndividualFreight) && !freightTo.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'El destino del flete es requerido.' });
      return;
    }

    setIsSubmitting(true);
    try {
      let clientDataForPdf: any;
      let opportunityId: string;
      const sellerName = assignToCompany ? 'Paisano Trailer' : `${userProfile.firstName} ${userProfile.lastName}`;

      if (clientMode === 'custom') {
        const isValid = await customClientForm.trigger();
        if (!isValid) {
          toast({ title: 'Datos de cliente inválidos', description: 'Por favor, revise los campos marcados en rojo.', variant: 'destructive' });
          setIsSubmitting(false);
          return;
        }
        const customClientValues = customClientForm.getValues();
        const leadData = {
          ...customClientValues,
          sellerId: user.uid, sellerName, status: 'New', createdDate: new Date().toISOString(),
          clienteNumber: '', region: '',
        };
        const newLeadRef = await addDoc(collection(firestore, 'leads'), leadData);
        clientDataForPdf = { ...leadData, id: newLeadRef.id };
        
        const opportunityData = {
          leadId: newLeadRef.id, sellerId: user.uid, sellerName, stage: 'Envió de Cotización' as const,
          name: `Oportunidad para ${leadData.clientName}`, value: total, currency, probability: 10,
          createdDate: new Date().toISOString(),
          expectedCloseDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
        };
        const newOppRef = await addDoc(collection(firestore, 'opportunities'), opportunityData);
        opportunityId = newOppRef.id;

      } else { // Registered client
        if (!selectedClient) {
          toast({ variant: 'destructive', title: 'Error', description: 'Por favor, seleccione un cliente.' });
          setIsSubmitting(false);
          return;
        }
        clientDataForPdf = selectedClient;
        const oppsCollection = collection(firestore, 'opportunities');
        const q = query(oppsCollection, where('leadId', '==', selectedClient.id));
        const oppsSnapshot = await getDocs(q);
        
        if (oppsSnapshot.empty) {
          const opportunityData = {
            leadId: selectedClient.id, sellerId: user.uid, sellerName, stage: 'Envió de Cotización' as const,
            name: `Oportunidad para ${selectedClient.clientName}`, value: total, currency, probability: 10,
            createdDate: new Date().toISOString(),
            expectedCloseDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
          };
          const newOppRef = await addDoc(oppsCollection, opportunityData);
          opportunityId = newOppRef.id;
        } else {
          opportunityId = oppsSnapshot.docs[0].id;
          await updateDoc(doc(firestore, 'opportunities', opportunityId), { stage: 'Envió de Cotización', value: total, currency });
        }
      }
      
      const currentNumberStr = quotationDetails.number.replace('QT-', '');
      const currentNumber = parseInt(currentNumberStr, 10);
  
      const docPdf = new jsPDF() as jsPDFWithAutoTable;
      // ... (Rest of PDF generation code, identical to before, using clientDataForPdf)
      const pageHeight = docPdf.internal.pageSize.height || docPdf.internal.pageSize.getHeight();
      const docWidth = docPdf.internal.pageSize.width || docPdf.internal.pageSize.getWidth();
      const margin = 15;
      let currentY = 0;
      const logoUrl = localStorage.getItem('sidebarLogo');
      const RED = '#8B0000';
      const BLACK = '#000000';
      const LIGHT_GRAY = '#F5F5F5';

      // PDF Header Coordinates
      const headerConfig = {
          lineHeight: 5, logoX: 15, logoY: 0, logoWidth: 65, textX: docWidth - margin, textY: 11
      };

      // Draw logo first
      if (logoUrl) {
        try {
          const response = await fetch(logoUrl);
          const blob = await response.blob();
          const base64Logo = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(blob);
          });
          const img = new Image();
          img.src = base64Logo;
          await new Promise<void>((resolve) => { img.onload = () => resolve(); });
          const format = blob.type.split('/')[1];
          docPdf.addImage(img.src, format.toUpperCase(), headerConfig.logoX, headerConfig.logoY, headerConfig.logoWidth, 0, undefined, 'NONE');
        } catch (e) { console.error("Error adding logo image to PDF:", e); }
      }

      // Header background
      docPdf.setFillColor(RED);
      docPdf.rect(0, 0, docPdf.internal.pageSize.getWidth(), headerConfig.lineHeight, 'F');
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(16);
      docPdf.setTextColor(BLACK);
      docPdf.text('PAISANO TRAILER', headerConfig.textX, headerConfig.textY, { align: 'right', baseline: 'top' });
      docPdf.setFont('helvetica', 'normal');
      docPdf.setFontSize(10);
      docPdf.setTextColor(100);
      const addressY = headerConfig.textY + 10;
      const addressLineSpacing = 5;
      docPdf.text('CAMPO MENONITA 51T, NAMIQUIPA,', docWidth - margin, addressY, { align: 'right' });
      docPdf.text('CHIH. MEX, CP 31978', docWidth - margin, addressY + addressLineSpacing, { align: 'right' });
      docPdf.text('RFC: SPA150217AM3', docWidth - margin, addressY + addressLineSpacing * 2, { align: 'right' });
      
      const separatorY = 43;
      docPdf.setDrawColor(RED);
      docPdf.setLineWidth(0.8);
      docPdf.line(margin, separatorY, docWidth - margin, separatorY);
      docPdf.setDrawColor(BLACK);
      docPdf.setLineWidth(0.3);
      docPdf.line(margin, separatorY + 1.5, docWidth - margin, separatorY + 1.5);
      currentY = separatorY + 8;
      
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(10);
      const quoteDetailsX = margin;
      docPdf.text('QUOTATION #:', quoteDetailsX, currentY);
      docPdf.text('DATE:', quoteDetailsX, currentY + 6);
      docPdf.text('VALIDITY:', quoteDetailsX, currentY + 12);
      docPdf.setFont('helvetica', 'normal');
      docPdf.text(quotationDetails.number.toUpperCase(), quoteDetailsX + 30, currentY);
      docPdf.text(new Date().toLocaleDateString('en-GB'), quoteDetailsX + 30, currentY + 6);
      docPdf.text(quotationDetails.validity.toUpperCase(), quoteDetailsX + 30, currentY + 12);
      currentY += 12 + 8;
      
      const infoStartY = currentY;
      const rightColX = docWidth / 2 + 5;
      const infoBoxHeight = 25;
      const titleBoxHeight = 7;
      const contentStartY = infoStartY + titleBoxHeight;
      const salesPersonBoxWidth = (docWidth / 2) - margin - 5;
      const buyerBoxWidth = (docWidth / 2) - margin - 5;

      docPdf.setFillColor(RED);
      docPdf.rect(margin, infoStartY, salesPersonBoxWidth, titleBoxHeight, 'F');
      docPdf.setFillColor(LIGHT_GRAY);
      docPdf.rect(margin, contentStartY, salesPersonBoxWidth, infoBoxHeight - titleBoxHeight, 'F');
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(10);
      docPdf.setTextColor('#FFFFFF');
      docPdf.text('SALES PERSON:', margin + 3, infoStartY + 4.5);
      docPdf.setFont('helvetica', 'normal');
      docPdf.setFontSize(9);
      docPdf.setTextColor(BLACK);
      if (assignToCompany) {
        docPdf.text('PAISANO TRAILER', margin + 3, contentStartY + 4);
        docPdf.text('paisanosales@gmail.com', margin + 3, contentStartY + 9);
        docPdf.text('915 408 7478', margin + 3, contentStartY + 14);
      } else if (userProfile) {
          docPdf.text(`${userProfile.firstName.toUpperCase()} ${userProfile.lastName.toUpperCase()}`, margin + 3, contentStartY + 4);
          if (userProfile.email) docPdf.text(userProfile.email.toLowerCase(), margin + 3, contentStartY + 9);
          if (userProfile.phone) docPdf.text(userProfile.phone, margin + 3, contentStartY + 14);
      }

      docPdf.setFillColor(RED);
      docPdf.rect(rightColX, infoStartY, buyerBoxWidth, titleBoxHeight, 'F');
      docPdf.setFillColor(LIGHT_GRAY);
      docPdf.rect(rightColX, contentStartY, buyerBoxWidth, infoBoxHeight - titleBoxHeight, 'F');
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(10);
      docPdf.setTextColor('#FFFFFF');
      docPdf.text('BUYER:', rightColX + 3, infoStartY + 4.5);
      docPdf.setFont('helvetica', 'normal');
      docPdf.setFontSize(9);
      docPdf.setTextColor(BLACK);
      docPdf.text(clientDataForPdf.clientName.toUpperCase(), rightColX + 3, contentStartY + 4);
      docPdf.text(`ATTN: ${clientDataForPdf.contactPerson.toUpperCase()}`, rightColX + 3, contentStartY + 9);
      const buyerContactInfo = [clientDataForPdf.email, clientDataForPdf.phone].filter(Boolean).join(' | ');
      if (buyerContactInfo) docPdf.text(buyerContactInfo.toLowerCase(), rightColX + 3, contentStartY + 14);
      currentY = infoStartY + infoBoxHeight + 8;
      
      const tableWidth = docWidth - (margin * 2);
      const columnStyles4 = { 0: { cellWidth: tableWidth * 0.60, halign: 'justify' as const }, 1: { cellWidth: tableWidth * 0.10, halign: 'center' as const }, 2: { cellWidth: tableWidth * 0.15, halign: 'right' as const }, 3: { cellWidth: tableWidth * 0.15, halign: 'right' as const }, };
      const columnStyles5 = { 0: { cellWidth: tableWidth * 0.55, halign: 'justify' as const }, 1: { cellWidth: tableWidth * 0.10, halign: 'center' as const }, 2: { cellWidth: tableWidth * 0.125, halign: 'right' as const }, 3: { cellWidth: tableWidth * 0.125, halign: 'right' as const }, 4: { cellWidth: tableWidth * 0.10, halign: 'right' as const }, };
      const tableHead = isIndividualFreight ? [["DESCRIPTION", "QTY", "UNIT PRICE", "UNIT FREIGHT", "TOTAL"]] : [["DESCRIPTION", "QTY", "UNIT PRICE", "TOTAL"]];
      const tableBody = items.map(item => {
          const itemTotal = item.quantity * item.price;
          if (isIndividualFreight) {
              const totalFreightForItem = item.individualFreight * item.quantity;
              return [ item.description, item.quantity, `$${item.price.toFixed(2)}`, `$${item.individualFreight.toFixed(2)}`, `$${(itemTotal + totalFreightForItem).toFixed(2)}` ];
          }
          return [ item.description, item.quantity, `$${item.price.toFixed(2)}`, `$${itemTotal.toFixed(2)}` ];
      });
      docPdf.autoTable({ head: tableHead, body: tableBody, startY: currentY, theme: 'striped', headStyles: { font: 'helvetica', fontStyle: 'bold', fillColor: [139, 0, 0], textColor: [255, 255, 255], fontSize: 9 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 }, columnStyles: isIndividualFreight ? columnStyles5 : columnStyles4, margin: { left: margin, right: margin } });
      currentY = (docPdf as any).autoTable.previous.finalY;
      currentY += 4;
      let lineY = currentY;
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(11);
      docPdf.text('SUBTOTAL:', docWidth - 70, lineY, { align: 'right' });
      docPdf.setFont('helvetica', 'normal');
      docPdf.text(`$${subtotal.toFixed(2)}`, docWidth - margin, lineY, { align: 'right' });
      lineY += 7;
      if (isIndividualFreight) {
        const totalIndividualFreight = items.reduce((acc, item) => acc + (item.individualFreight || 0) * item.quantity, 0);
        if (totalIndividualFreight > 0) {
          docPdf.setFont('helvetica', 'bold');
          docPdf.text('TOTAL FREIGHT:', docWidth - 70, lineY, { align: 'right' });
          docPdf.setFont('helvetica', 'normal');
          docPdf.text(`$${totalIndividualFreight.toFixed(2)}`, docWidth - margin, lineY, { align: 'right' });
          lineY += 7;
        }
      } else if (freight > 0) {
        docPdf.setFont('helvetica', 'bold');
        const freightText = `FREIGHT TO: ${freightTo.toUpperCase()}:`;
        docPdf.text(freightText, docWidth - 70, lineY, { align: 'right' });
        docPdf.setFont('helvetica', 'normal');
        docPdf.text(`$${freight.toFixed(2)}`, docWidth - margin, lineY, { align: 'right' });
        lineY += 7;
      }
      const totalY = lineY + 2;
      docPdf.setDrawColor(BLACK);
      docPdf.setLineWidth(0.2);
      docPdf.line(docWidth - 80, totalY, docWidth - margin, totalY);
      lineY = totalY + 7;
      docPdf.setFont('helvetica', 'bold');
      docPdf.text('TOTAL (DOLLARS):', docWidth - 70, lineY, { align: 'right' });
      docPdf.setTextColor(RED);
      docPdf.text(`$${total.toFixed(2)}`, docWidth - margin, lineY, { align: 'right' });
      currentY = lineY;
      docPdf.setTextColor(BLACK);

      currentY += 10;
      const termsBody = quotationDetails.terms ? quotationDetails.terms.toUpperCase() : '';
      if (termsBody) {
        const textMaxWidth = docWidth - (margin * 2);
        const textOptions = { align: 'justify' as const, maxWidth: textMaxWidth };
        docPdf.setFont('helvetica', 'normal');
        docPdf.setFontSize(7);
        const termsDim = docPdf.getTextDimensions(termsBody, { ...textOptions });
        const termsHeight = termsDim.h + 8; 
        if (currentY + termsHeight > pageHeight - 35) { docPdf.addPage(); currentY = margin; }
        docPdf.setFont('helvetica', 'bold');
        docPdf.setFontSize(8);
        docPdf.text('TERMS AND CONDITIONS', margin, currentY);
        currentY += 5;
        docPdf.setFont('helvetica', 'normal');
        docPdf.setFontSize(7);
        docPdf.text(termsBody, margin, currentY, textOptions);
        currentY += termsDim.h;
      }
      
      const fixedSpacingBeforeSignature = 4;
      const signatureHeight = 15;
      const notesBody = quotationDetails.notes ? quotationDetails.notes.toUpperCase() : '';
      let qrCodeDataUrl = '';
      try {
        const canvas = document.createElement('canvas');
        await QRCode.toCanvas(canvas, 'https://www.paisanotrailer.com/limited-warranty', { width: 150, errorCorrectionLevel: 'H' });
        const qrLogoUrl = localStorage.getItem('sidebarLogo');
        if (qrLogoUrl) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const img = new Image();
              img.crossOrigin = 'Anonymous';
              const imgPromise = new Promise<void>((resolve, reject) => {
                  img.onload = () => resolve();
                  img.onerror = (err) => reject(err);
                  img.src = qrLogoUrl;
              });
              await imgPromise;
              const center = canvas.width / 2;
              const logoSize = canvas.width * 0.25;
              const logoXCenter = center - logoSize / 2;
              const logoYCenter = center - logoSize / 2;
              ctx.fillStyle = 'white';
              ctx.fillRect(logoXCenter - 2, logoYCenter - 2, logoSize + 4, logoSize + 4);
              ctx.drawImage(img, logoXCenter, logoYCenter, logoSize, logoSize);
            }
        }
        qrCodeDataUrl = canvas.toDataURL('image/png');
      } catch (err) { console.error('Failed to generate QR code:', err); }
      const qrSize = 18;
      const qrSectionHeight = qrCodeDataUrl ? qrSize + 5 : 0;
      let notesHeight = 0;
      if (notesBody) {
        const textMaxWidth = docWidth - (margin * 2) - (qrCodeDataUrl ? qrSize + 5 : 0);
        const textOptions = { align: 'justify' as const, maxWidth: textMaxWidth };
        const notesDim = docPdf.getTextDimensions(notesBody, { ...textOptions });
        notesHeight = notesDim.h + 8;
      }
      const notesAndQrHeight = Math.max(notesHeight, qrSectionHeight);
      const combinedBlockHeight = 4 + notesAndQrHeight + fixedSpacingBeforeSignature + signatureHeight;
      if (currentY + combinedBlockHeight > pageHeight - 35) { docPdf.addPage(); currentY = margin; }
      currentY += 4;
      const notesAndQrStartY = currentY;
      if (notesBody) {
        docPdf.setFont('helvetica', 'bold');
        docPdf.setFontSize(8);
        docPdf.text('ADDITIONAL NOTES', margin, notesAndQrStartY);
        docPdf.setFont('helvetica', 'normal');
        docPdf.setFontSize(7);
        const textMaxWidth = docWidth - (margin * 2) - (qrCodeDataUrl ? qrSize + 5 : 0);
        docPdf.text(notesBody, margin, notesAndQrStartY + 5, { align: 'justify' as const, maxWidth: textMaxWidth });
      }
      if (qrCodeDataUrl) {
        const qrX = docWidth - margin - qrSize;
        docPdf.addImage(qrCodeDataUrl, 'PNG', qrX, notesAndQrStartY, qrSize, qrSize);
        docPdf.setFontSize(6);
        docPdf.setFont('helvetica', 'bold');
        docPdf.text('1 YEAR WARRANTY', qrX + qrSize / 2, notesAndQrStartY + qrSize + 3, { align: 'center' });
      }
      currentY = notesAndQrStartY + notesAndQrHeight;
      currentY += fixedSpacingBeforeSignature;
      const sigWidth = 80;
      const sigXStart = (docWidth - sigWidth) / 2;
      docPdf.line(sigXStart, currentY, sigXStart + sigWidth, currentY);
      docPdf.setFontSize(8);
      docPdf.setFont('helvetica', 'normal');
      docPdf.text('APPROVAL SIGNATURE', docWidth / 2, currentY + 5, { align: 'center' });
      let pageCount = (docPdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
          docPdf.setPage(i);
          const footerHeight = 20;
          const footerStartY = pageHeight - footerHeight;
          docPdf.setFillColor(RED);
          docPdf.rect(0, footerStartY, docWidth, footerHeight, 'F');
          docPdf.setFontSize(9);
          docPdf.setTextColor('#FFFFFF');
          docPdf.setFont('helvetica', 'normal');
          const footerTextY = footerStartY + (footerHeight / 2);
          const footerText = `paisanosales@gmail.com | 915 408 7478 | www.paisanotrailer.com`;
          docPdf.text(footerText, docWidth / 2, footerTextY, { align: 'center', baseline: 'middle' });
          docPdf.text(`PAGE ${i} OF ${pageCount}`, docWidth - margin, footerTextY, { align: 'right', baseline: 'middle' });
      }

      const pdfBlob = docPdf.output('blob');
      const fileName = `QT-${quotationDetails.number}-${clientDataForPdf.clientName.replace(/\s/g, '_')}.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
      
      const storageRef = ref(storage, `quotations/${opportunityId}/${pdfFile.name}`);
      const uploadTask = uploadBytesResumable(storageRef, pdfFile);
      toast({ title: 'Subiendo PDF...' });
      const snapshot = await uploadTask;
      const downloadURL = await getDownloadURL(snapshot.ref);
      toast({ title: 'PDF Subido, guardando datos...' });

      const quotesCollection = collection(firestore, 'quotations');
      const quotesQuery = query(quotesCollection, where('opportunityId', '==', opportunityId));
      const quotesSnapshot = await getDocs(quotesQuery);
      const newVersion = String(quotesSnapshot.size + 1);

      const quotationData = {
        opportunityId, sellerId: user.uid, sellerName, pdfUrl: downloadURL,
        value: total, currency, version: newVersion, status: 'Enviada' as const,
        createdDate: new Date().toISOString(),
      };
      await addDoc(quotesCollection, quotationData);

      localStorage.setItem('lastQuotationNumber', String(currentNumber));
      const nextNumber = currentNumber + 1;
      setQuotationDetails(prev => ({ ...prev, number: `QT-${String(nextNumber).padStart(6, '0')}` }));
      toast({ title: '¡Cotización Guardada!', description: 'La cotización se ha registrado en el historial.' });
      router.push('/dashboard/quotations');

    } catch(error) {
      console.error("Error creating quotation:", error);
      toast({ variant: 'destructive', title: 'Error al Guardar', description: 'Ocurrió un problema al guardar la cotización. Verifique los permisos e intente de nuevo.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = areLeadsLoading || areProductsLoading;

  return (
    <>
      <div className="grid gap-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-headline font-bold">NUEVA COTIZACIÓN</h1>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button variant="outline" onClick={() => setIsDetailsDialogOpen(true)} className="w-full sm:w-auto justify-center">
                <Settings className="mr-2 h-4 w-4" />
                DETALLES DE COTIZACIÓN
            </Button>
            <Button onClick={handleGenerateAndSave} disabled={(clientMode === 'registered' && !selectedClientId) || isSubmitting} className="w-full sm:w-auto justify-center">
                {isSubmitting ? 'GUARDANDO...' : <><FileDown className="mr-2 h-4 w-4" />GUARDAR COTIZACIÓN</>}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Detalles de la Cotización</CardTitle>
            <CardDescription>
              Seleccione un cliente y añada productos para generar el documento de cotización.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
              <Tabs value={clientMode} onValueChange={(value) => setClientMode(value as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="registered">Cliente Registrado</TabsTrigger>
                      <TabsTrigger value="custom">Cliente Personalizado</TabsTrigger>
                  </TabsList>
                  <TabsContent value="registered" className="pt-6">
                       <div className="max-w-sm">
                          <Label htmlFor="client-select">SELECCIONAR CLIENTE</Label>
                          <Select onValueChange={setSelectedClientId} value={selectedClientId} disabled={isLoading}>
                              <SelectTrigger id="client-select">
                                  <SelectValue placeholder="Elegir un cliente..." />
                              </SelectTrigger>
                              <SelectContent>
                                  {isLoading ? (
                                      <SelectItem value="loading" disabled>Cargando clientes...</SelectItem>
                                  ) : (
                                      leads?.map((lead: any) => (
                                          <SelectItem key={lead.id} value={lead.id}>
                                              {lead.clientName}
                                          </SelectItem>
                                      ))
                                  )}
                              </SelectContent>
                          </Select>
                      </div>
                  </TabsContent>
                  <TabsContent value="custom" className="pt-6">
                      <Form {...customClientForm}>
                        <form className="grid grid-cols-6 gap-x-4 gap-y-6">
                          <FormField control={customClientForm.control} name="contactPerson" render={({ field }) => ( <FormItem className="col-span-6 sm:col-span-3"><FormLabel>NOMBRE DEL CLIENTE</FormLabel><FormControl><Input placeholder="Juan Pérez" {...field} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={customClientForm.control} name="clientName" render={({ field }) => ( <FormItem className="col-span-6 sm:col-span-3"><FormLabel>NOMBRE DE EMPRESA</FormLabel><FormControl><Input placeholder="Constructora Acme" {...field} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={customClientForm.control} name="country" render={({ field }) => ( <FormItem className="col-span-6 sm:col-span-2"><FormLabel>PAÍS</FormLabel><Select onValueChange={(value) => { field.onChange(value); customClientForm.setValue('state', ''); customClientForm.setValue('city', ''); }} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un país" /></SelectTrigger></FormControl><SelectContent>{countries.map((country) => (<SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                          <FormField control={customClientForm.control} name="state" render={({ field }) => ( <FormItem className="col-span-6 sm:col-span-2"><FormLabel>ESTADO</FormLabel><Select onValueChange={(value) => { field.onChange(value); customClientForm.setValue('city', ''); }} value={field.value} disabled={!selectedCountry}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un estado" /></SelectTrigger></FormControl><SelectContent>{availableStates.map((state) => (<SelectItem key={state.code} value={state.code}>{state.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                          <FormField control={customClientForm.control} name="city" render={({ field }) => ( <FormItem key={selectedState} className="col-span-6 sm:col-span-2"><FormLabel>CIUDAD</FormLabel>{selectedState && availableCities.length > 0 ? (<Select onValueChange={field.onChange} value={field.value} ><FormControl><SelectTrigger><SelectValue placeholder="Seleccione una ciudad" /></SelectTrigger></FormControl><SelectContent>{availableCities.map(city => (<SelectItem key={city} value={city}>{city}</SelectItem>))}</SelectContent></Select>) : (<FormControl><Input placeholder="Ciudad" {...field} value={field.value || ''} disabled={!selectedState} /></FormControl>)}<FormMessage /></FormItem> )} />
                          <FormField control={customClientForm.control} name="contactMethod" render={({ field }) => ( <FormItem className="col-span-6 sm:col-span-2"><FormLabel>FORMA DE CONTACTO</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione una opción" /></SelectTrigger></FormControl><SelectContent>{contactMethods.map((method) => (<SelectItem key={method} value={method}>{method}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                          <FormField control={customClientForm.control} name="language" render={({ field }) => ( <FormItem className="col-span-6 sm:col-span-2"><FormLabel>IDIOMA</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un idioma" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Español">ESPAÑOL</SelectItem><SelectItem value="Inglés">INGLÉS</SelectItem><SelectItem value="Bilingüe">BILINGÜE</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                          <FormField control={customClientForm.control} name="clientType" render={({ field }) => ( <FormItem className="col-span-6 sm:col-span-2"><FormLabel>TIPO DE CLIENTE</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un tipo" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Dealer">Dealer</SelectItem><SelectItem value="EMPRESA DE TRANSPORTE">EMPRESA DE TRANSPORTE</SelectItem><SelectItem value="Sand Industry">Sand Industry</SelectItem><SelectItem value="USUARIO FINAL">USUARIO FINAL</SelectItem><SelectItem value="De construccion">De construccion</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                          <FormField control={customClientForm.control} name="website" render={({ field }) => ( <FormItem className="col-span-6 sm:col-span-2"><FormLabel>PÁGINA WEB</FormLabel><FormControl><Input placeholder="ejemplo.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={customClientForm.control} name="phone" render={({ field }) => ( <FormItem className="col-span-6 sm:col-span-2"><FormLabel>TELÉFONO</FormLabel><FormControl><Input placeholder="+1 (555) 123-4567" {...field} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={customClientForm.control} name="email" render={({ field }) => ( <FormItem className="col-span-6 sm:col-span-2"><FormLabel>EMAIL</FormLabel><FormControl><Input placeholder="contacto@ejemplo.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </form>
                      </Form>
                  </TabsContent>
              </Tabs>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="space-y-2">
                      <Label htmlFor="currency-select">MONEDA</Label>
                      <Select onValueChange={setCurrency} value={currency}>
                          <SelectTrigger id="currency-select">
                              <SelectValue placeholder="Seleccionar moneda..." />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="MXN">MXN</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="flex items-end pb-1.5">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="individual-freight" checked={isIndividualFreight} onCheckedChange={(checked) => setIsIndividualFreight(!!checked)} />
                        <Label htmlFor="individual-freight">Flete INDIVIDUAL</Label>
                    </div>
                  </div>
              </div>
              <div className="flex items-center space-x-2 mt-4">
                <Checkbox id="assign-to-company" checked={assignToCompany} onCheckedChange={(checked) => setAssignToCompany(!!checked)} />
                <Label htmlFor="assign-to-company">Sin Vendedor (usar datos generales de la empresa)</Label>
              </div>

              <div className="mt-8">
                  <Label>PRODUCTOS / SERVICIOS</Label>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead className="w-[40%]">PRODUCTO</TableHead>
                              <TableHead>CANTIDAD</TableHead>
                              <TableHead>PRECIO UNITARIO</TableHead>
                              {isIndividualFreight && <TableHead>FLETE</TableHead>}
                              <TableHead>TOTAL</TableHead>
                              <TableHead className="w-[50px]"><span className="sr-only">ACCIONES</span></TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {items.map((item, index) => (
                              <TableRow key={index}>
                                  <TableCell>
                                      <Select 
                                        onValueChange={(value) => handleProductSelect(index, value)}
                                        value={item.productId}
                                        disabled={isLoading}
                                      >
                                          <SelectTrigger>
                                              <SelectValue placeholder="Seleccionar un producto..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                              {isLoading ? (
                                                  <SelectItem value="loading" disabled>Cargando...</SelectItem>
                                              ) : (
                                                  allProducts?.map((prod) => (
                                                      <SelectItem key={prod.id} value={prod.id}>{prod.name}</SelectItem>
                                                  ))
                                              )}
                                          </SelectContent>
                                      </Select>
                                  </TableCell>
                                  <TableCell>
                                      <Input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className="w-20" />
                                  </TableCell>
                                  <TableCell>
                                      <Input type="number" value={item.price} onChange={(e) => handleItemChange(index, 'price', e.target.value)} className="w-32" />
                                  </TableCell>
                                  {isIndividualFreight && ( <TableCell><Input type="number" value={item.individualFreight} onChange={(e) => handleItemChange(index, 'individualFreight', e.target.value)} className="w-32" /></TableCell> )}
                                  <TableCell className="font-medium">${(isIndividualFreight ? ((item.quantity * item.price) + (item.quantity * item.individualFreight)) : (item.quantity * item.price)).toFixed(2)}</TableCell>
                                  <TableCell><Button variant="ghost" size="icon" onClick={() => removeItem(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
                  <Button variant="outline" size="sm" onClick={addItem} className="mt-4">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      AÑADIR PRODUCTO
                  </Button>
              </div>

              <div className="flex justify-end mt-8">
                  <div className="w-full max-w-sm space-y-4">
                      <div className="flex justify-between items-center font-medium"><p>SUBTOTAL:</p><p>${subtotal.toFixed(2)}</p></div>
                      <div className="flex justify-between items-center"><Label htmlFor="freight-to">FLETE A:</Label><Input id="freight-to" placeholder="Destino" value={freightTo} onChange={(e) => setFreightTo(e.target.value)} className="w-48" /></div>
                      {!isIndividualFreight && ( <div className="flex justify-between items-center"><Label htmlFor="freight-amount">MONTO DE FLETE</Label><Input id="freight-amount" type="number" value={freight} onChange={(e) => setFreight(Number(e.target.value))} className="w-32" /></div> )}
                      {isIndividualFreight && ( <div className="flex justify-between items-center font-medium"><p>TOTAL DE FLETES:</p><p>${items.reduce((acc, item) => acc + (item.individualFreight * item.quantity), 0).toFixed(2)}</p></div> )}
                      <div className="flex justify-between items-center text-lg font-bold"><p>TOTAL:</p><p>${total.toFixed(2)}</p></div>
                  </div>
              </div>
          </CardContent>
        </Card>
      </div>
      <QuotationDetailsDialog
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        initialDetails={quotationDetails}
        onSave={setQuotationDetails}
      />
    </>
  );
}

    