'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

  const opportunitiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'opportunities'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  const { data: opportunities, isLoading: areOppsLoading } = useCollection(opportunitiesQuery);

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
    terms: 'PAYMENT TERMS: 10% DOWN PAYMENT, 90% UPON DELIVERY.\nPRICES DO NOT INCLUDE VAT.\nDELIVERY TIMES ARE SUBJECT TO CHANGE WITHOUT PRIOR NOTICE.',
    notes: 'THANK YOU FOR YOUR PREFERENCE.',
  });
  const [currency, setCurrency] = useState('USD');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!selectedClient || !firestore || !user || !userProfile || !storage) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor, seleccione un cliente e inicie sesión.',
      });
      return;
    }
    if (((!isIndividualFreight && freight > 0) || isIndividualFreight) && !freightTo.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'El destino del flete es requerido cuando se agrega un monto de flete o se usa flete individual.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Find or create opportunity
      let opportunityId: string;
      const oppsCollection = collection(firestore, 'opportunities');
      const q = query(oppsCollection, where('leadId', '==', selectedClient.id));
      const oppsSnapshot = await getDocs(q);

      if (oppsSnapshot.empty) {
        const opportunityData = {
          leadId: selectedClient.id,
          sellerId: user.uid,
          sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
          stage: 'Primer contacto',
          name: `Oportunidad para ${selectedClient.clientName}`,
          value: total,
          currency,
          probability: 10,
          createdDate: new Date().toISOString(),
          expectedCloseDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
        };
        const newOppRef = await addDoc(oppsCollection, opportunityData);
        opportunityId = newOppRef.id;
      } else {
        opportunityId = oppsSnapshot.docs[0].id;
      }
      
      const opportunityRef = doc(firestore, 'opportunities', opportunityId);

      const currentNumberStr = quotationDetails.number.replace('QT-', '');
      const currentNumber = parseInt(currentNumberStr, 10);
  
      const docPdf = new jsPDF() as jsPDFWithAutoTable;
      const pageHeight = docPdf.internal.pageSize.height || docPdf.internal.pageSize.getHeight();
      const docWidth = docPdf.internal.pageSize.width || docPdf.internal.pageSize.getWidth();
      const margin = 15;
      let currentY = 0;
      const logoUrl = localStorage.getItem('sidebarLogo');
      const RED = '#8B0000';
      const BLACK = '#000000';
      const LIGHT_GRAY = '#F5F5F5';
      const headerTextY = 15;

      if (logoUrl) {
        try {
          const format = logoUrl.substring(logoUrl.indexOf('/') + 1, logoUrl.indexOf(';'));
          const img = new Image();
          img.src = logoUrl;
          const imgWidth = 65;
          docPdf.addImage(logoUrl, format.toUpperCase(), margin, 0, imgWidth, 0, undefined, 'NONE');
        } catch (e) {
          console.error("Error adding logo image to PDF:", e);
        }
      }

      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(16);
      docPdf.setTextColor(BLACK);
      docPdf.text('PAISANO TRAILER', docWidth - margin, headerTextY, { align: 'right', baseline: 'top' });
      docPdf.setFont('helvetica', 'normal');
      docPdf.setFontSize(10);
      docPdf.setTextColor(100);
      const addressY = headerTextY + 7;
      const addressLineSpacing = 5;
      docPdf.text('CAMPO MENONITA 51T, NAMIQUIPA,', docWidth - margin, addressY, { align: 'right' });
      docPdf.text('CHIH. MEX, CP 31978', docWidth - margin, addressY + addressLineSpacing, { align: 'right' });
      docPdf.text('RFC: SPA150217AM3', docWidth - margin, addressY + addressLineSpacing * 2, { align: 'right' });
      
      const separatorY = 41;
      docPdf.setDrawColor(RED);
      docPdf.setLineWidth(0.8);
      docPdf.line(margin, separatorY, docWidth - margin, separatorY);
      docPdf.setDrawColor(BLACK);
      docPdf.setLineWidth(0.3);
      docPdf.line(margin, separatorY + 1.5, docWidth - margin, separatorY + 1.5);
      
      currentY = separatorY + 10;
      const quoteDetailsX = docWidth - margin;
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(10);
      docPdf.text('QUOTATION #:', quoteDetailsX - 45, currentY, { align: 'left' });
      docPdf.text('DATE:', quoteDetailsX - 45, currentY + 6, { align: 'left' });
      docPdf.text('VALIDITY:', quoteDetailsX - 45, currentY + 12, { align: 'left' });
      docPdf.setFont('helvetica', 'normal');
      docPdf.text(quotationDetails.number.toUpperCase(), quoteDetailsX, currentY, { align: 'right' });
      docPdf.text(new Date().toLocaleDateString('en-GB'), quoteDetailsX, currentY + 6, { align: 'right' });
      docPdf.text(quotationDetails.validity.toUpperCase(), quoteDetailsX, currentY + 12, { align: 'right' });

      currentY += 12 + 10;
      
      const infoStartY = currentY;
      const rightColX = docWidth / 2 + 10;
      const infoBoxHeight = 40;
      const titleBoxHeight = 7;
      const contentStartY = infoStartY + titleBoxHeight;
      
      const salesPersonBoxWidth = (docWidth / 2) - margin - 5;
      const buyerBoxWidth = (docWidth / 2) - margin - 10;

      // --- Sales Person Box ---
      docPdf.setFillColor(RED);
      docPdf.rect(margin, infoStartY, salesPersonBoxWidth, titleBoxHeight, 'F');
      docPdf.setFillColor(LIGHT_GRAY);
      docPdf.rect(margin, contentStartY, salesPersonBoxWidth, infoBoxHeight - titleBoxHeight, 'F');
      
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(9);
      docPdf.setTextColor('#FFFFFF');
      docPdf.text('SALES PERSON:', margin + 3, infoStartY + 4.5);
      
      docPdf.setFont('helvetica', 'normal');
      docPdf.setTextColor(BLACK);
      if (userProfile) {
          docPdf.text(`${userProfile.firstName.toUpperCase()} ${userProfile.lastName.toUpperCase()}`, margin + 3, contentStartY + 5);
          if (userProfile.email) docPdf.text(userProfile.email.toLowerCase(), margin + 3, contentStartY + 10);
          if (userProfile.phone) docPdf.text(userProfile.phone, margin + 3, contentStartY + 15);
      }

      // --- Buyer Box ---
      docPdf.setFillColor(RED);
      docPdf.rect(rightColX, infoStartY, buyerBoxWidth, titleBoxHeight, 'F');
      docPdf.setFillColor(LIGHT_GRAY);
      docPdf.rect(rightColX, contentStartY, buyerBoxWidth, infoBoxHeight - titleBoxHeight, 'F');

      docPdf.setFont('helvetica', 'bold');
      docPdf.setTextColor('#FFFFFF');
      docPdf.text('BUYER:', rightColX + 3, infoStartY + 4.5);

      docPdf.setFont('helvetica', 'normal');
      docPdf.setTextColor(BLACK);
      docPdf.text(selectedClient.clientName.toUpperCase(), rightColX + 3, contentStartY + 5);
      docPdf.text(`ATTN: ${selectedClient.contactPerson.toUpperCase()}`, rightColX + 3, contentStartY + 10);
      if(selectedClient.email) docPdf.text(selectedClient.email.toLowerCase(), rightColX + 3, contentStartY + 15);
      if(selectedClient.phone) docPdf.text(selectedClient.phone, rightColX + 3, contentStartY + 20);
      
      currentY = infoStartY + infoBoxHeight + 6;
      
      const tableWidth = docWidth - (margin * 2);
      const columnStyles4 = {
        0: { cellWidth: tableWidth * 0.60, halign: 'justify' as const },
        1: { cellWidth: tableWidth * 0.10, halign: 'center' as const },
        2: { cellWidth: tableWidth * 0.15, halign: 'right' as const },
        3: { cellWidth: tableWidth * 0.15, halign: 'right' as const },
      };
      const columnStyles5 = {
        0: { cellWidth: tableWidth * 0.55, halign: 'justify' as const },
        1: { cellWidth: tableWidth * 0.10, halign: 'center' as const },
        2: { cellWidth: tableWidth * 0.125, halign: 'right' as const },
        3: { cellWidth: tableWidth * 0.125, halign: 'right' as const },
        4: { cellWidth: tableWidth * 0.10, halign: 'right' as const },
      };

      const tableHead = isIndividualFreight
          ? [["DESCRIPTION", "QTY", "UNIT PRICE", "UNIT FREIGHT", "TOTAL"]]
          : [["DESCRIPTION", "QTY", "UNIT PRICE", "TOTAL"]];
      const tableBody = items.map(item => {
          const itemTotal = item.quantity * item.price;
          if (isIndividualFreight) {
              const totalFreightForItem = item.individualFreight * item.quantity;
              return [
                  item.description,
                  item.quantity,
                  `$${item.price.toFixed(2)}`,
                  `$${item.individualFreight.toFixed(2)}`,
                  `$${(itemTotal + totalFreightForItem).toFixed(2)}`
              ];
          }
          return [
              item.description,
              item.quantity,
              `$${item.price.toFixed(2)}`,
              `$${itemTotal.toFixed(2)}`
          ];
      });
      docPdf.autoTable({
          head: tableHead,
          body: tableBody,
          startY: currentY,
          theme: 'striped',
          headStyles: { fillColor: [139, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
          styles: { fontSize: 10, cellPadding: 3 },
          columnStyles: isIndividualFreight ? columnStyles5 : columnStyles4,
          margin: { left: margin, right: margin }
      });
      currentY = (docPdf as any).autoTable.previous.finalY;
      currentY += 4;
      const totalsY = currentY;
      let lineY = totalsY;
      docPdf.setFontSize(11);
      docPdf.setFont('helvetica', 'bold');
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

      // New two-column section for terms and notes
      currentY += 10;
      const colGap = 10;
      const colWidth = (docWidth - margin * 2 - colGap) / 2;
      const colPadding = 4;
      const textMaxWidth = colWidth - (colPadding * 2);
      const col1X = margin;
      const col2X = margin + colWidth + colGap;

      docPdf.setFontSize(8);
      const lineHeight = docPdf.getLineHeight() / docPdf.internal.scaleFactor;
      
      const textOptions = {
          align: 'justify' as const,
          maxWidth: textMaxWidth
      };

      const termsBody = quotationDetails.terms ? quotationDetails.terms.toUpperCase() : '';
      const notesBody = quotationDetails.notes ? quotationDetails.notes.toUpperCase() : '';

      const termsDim = docPdf.getTextDimensions(termsBody, { ...textOptions, fontSize: 8 });
      const notesDim = docPdf.getTextDimensions(notesBody, { ...textOptions, fontSize: 8 });

      const termsContentHeight = termsBody ? (lineHeight * 2) + termsDim.h : 0;
      const notesContentHeight = notesBody ? (lineHeight * 2) + notesDim.h : 0;
      
      const sectionHeight = Math.max(termsContentHeight, notesContentHeight) + (colPadding * 2);

      if (currentY + sectionHeight > pageHeight - 35) { // 35 for footer
          docPdf.addPage();
          currentY = margin;
      }
      
      const boxStartY = currentY;
      
      if (termsContentHeight > 0 || notesContentHeight > 0) {
        docPdf.setFillColor(LIGHT_GRAY);
        if (termsContentHeight > 0) docPdf.rect(col1X, boxStartY, colWidth, sectionHeight, 'F');
        if (notesContentHeight > 0) docPdf.rect(col2X, boxStartY, colWidth, sectionHeight, 'F');
      }
      
      const titleY = boxStartY + colPadding + 2;
      const bodyY = titleY + lineHeight + 2;

      if (termsBody) {
        docPdf.setFont('helvetica', 'bold');
        docPdf.setTextColor(BLACK);
        docPdf.text('TERMS AND CONDITIONS', col1X + colPadding, titleY);
        docPdf.setFont('helvetica', 'normal');
        docPdf.text(termsBody, col1X + colPadding, bodyY + 2, textOptions);
      }

      if (notesBody) {
        docPdf.setFont('helvetica', 'bold');
        docPdf.setTextColor(BLACK);
        docPdf.text('ADDITIONAL NOTES', col2X + colPadding, titleY);
        docPdf.setFont('helvetica', 'normal');
        docPdf.text(notesBody, col2X + colPadding, bodyY + 2, textOptions);
      }
      
      if (termsContentHeight > 0 || notesContentHeight > 0) {
        currentY += sectionHeight;
      }

      const signatureHeight = 25;
      if (currentY + signatureHeight > pageHeight - 35) {
          docPdf.addPage();
          currentY = margin;
      }
      currentY += 5;
      const sigWidth = 80;
      const sigXStart = (docWidth - sigWidth) / 2;
      docPdf.line(sigXStart, currentY, sigXStart + sigWidth, currentY);
      docPdf.setFontSize(9);
      docPdf.text('APPROVAL SIGNATURE', docWidth / 2, currentY + 5, { align: 'center' });
      let pageCount = (docPdf as any).internal.getNumberOfPages();
      const footerHeight = 20;
      for (let i = 1; i <= pageCount; i++) {
          docPdf.setPage(i);
          const footerStartY = pageHeight - footerHeight;
          
          docPdf.setFillColor(RED);
          docPdf.rect(0, footerStartY, docWidth, footerHeight, 'F');
          
          docPdf.setFontSize(9);
          docPdf.setTextColor('#FFFFFF');

          const footerTextY = footerStartY + (footerHeight / 2);
          const footerText = `paisanosales@gmail.com | 915 408 7478 | www.paisanotrailer.com`;
          docPdf.text(footerText, docWidth / 2, footerTextY, { align: 'center', baseline: 'middle' });
          docPdf.text(`PAGE ${i} OF ${pageCount}`, docWidth - margin, footerTextY, { align: 'right', baseline: 'middle' });
      }

      const pdfBlob = docPdf.output('blob');
      const pdfFile = new File([pdfBlob], `QT-${quotationDetails.number}-${selectedClient.clientName.replace(/\s/g, '_')}.pdf`, { type: 'application/pdf' });
      
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
        opportunityId,
        sellerId: user.uid,
        sellerName: `${userProfile.firstName} ${userProfile.lastName}`,
        pdfUrl: downloadURL,
        value: total,
        currency,
        version: newVersion,
        status: 'Enviada' as const,
        createdDate: new Date().toISOString(),
      };
      await addDoc(quotesCollection, quotationData);
      await updateDoc(opportunityRef, { stage: 'Envió de Cotización', value: total, currency });

      localStorage.setItem('lastQuotationNumber', String(currentNumber));
      const nextNumber = currentNumber + 1;
      setQuotationDetails(prev => ({
          ...prev,
          number: `QT-${String(nextNumber).padStart(6, '0')}`
      }));
      toast({
        title: '¡Cotización Guardada!',
        description: 'La cotización se ha registrado en el historial.',
      });

      router.push('/dashboard/quotations');

    } catch(error) {
      console.error("Error creating quotation:", error);
      toast({
        variant: 'destructive',
        title: 'Error al Guardar',
        description: 'Ocurrió un problema al guardar la cotización. Verifique los permisos e intente de nuevo.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = areLeadsLoading || areOppsLoading || areProductsLoading;

  return (
    <>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-headline font-bold">NUEVA COTIZACIÓN</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsDetailsDialogOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                DETALLES DE COTIZACIÓN
            </Button>
            <Button onClick={handleGenerateAndSave} disabled={!selectedClientId || isSubmitting}>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                   <div className="max-w-sm">
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

              <div>
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
                                      <Input
                                          type="number"
                                          value={item.quantity}
                                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                          className="w-20"
                                      />
                                  </TableCell>
                                  <TableCell>
                                      <Input
                                          type="number"
                                          value={item.price}
                                          onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                                          className="w-32"
                                      />
                                  </TableCell>
                                  {isIndividualFreight && (
                                    <TableCell>
                                        <Input
                                            type="number"
                                            value={item.individualFreight}
                                            onChange={(e) => handleItemChange(index, 'individualFreight', e.target.value)}
                                            className="w-32"
                                        />
                                    </TableCell>
                                  )}
                                  <TableCell className="font-medium">
                                    ${(isIndividualFreight 
                                          ? ((item.quantity * item.price) + (item.quantity * item.individualFreight)) 
                                          : (item.quantity * item.price)
                                      ).toFixed(2)}
                                  </TableCell>
                                  <TableCell>
                                      <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                  </TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
                  <Button variant="outline" size="sm" onClick={addItem} className="mt-4">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      AÑADIR PRODUCTO
                  </Button>
              </div>

              <div className="flex justify-end">
                  <div className="w-full max-w-sm space-y-4">
                      <div className="flex justify-between items-center font-medium">
                          <p>SUBTOTAL:</p>
                          <p>${subtotal.toFixed(2)}</p>
                      </div>
                      <div className="flex justify-between items-center">
                          <Label htmlFor="freight-to">FLETE A:</Label>
                          <Input
                              id="freight-to"
                              placeholder="Destino"
                              value={freightTo}
                              onChange={(e) => setFreightTo(e.target.value)}
                              className="w-48"
                          />
                      </div>
                      {!isIndividualFreight && (
                        <div className="flex justify-between items-center">
                            <Label htmlFor="freight-amount">MONTO DE FLETE</Label>
                            <Input
                                id="freight-amount"
                                type="number"
                                value={freight}
                                onChange={(e) => setFreight(Number(e.target.value))}
                                className="w-32"
                            />
                        </div>
                      )}
                      {isIndividualFreight && (
                        <div className="flex justify-between items-center font-medium">
                            <p>TOTAL DE FLETES:</p>
                            <p>${items.reduce((acc, item) => acc + (item.individualFreight * item.quantity), 0).toFixed(2)}</p>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-lg font-bold">
                          <p>TOTAL:</p>
                          <p>${total.toFixed(2)}</p>
                      </div>
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
