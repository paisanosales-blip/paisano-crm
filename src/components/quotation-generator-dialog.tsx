'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { type QuotationFormValues } from './quotation-upload-dialog';

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

interface QuotationGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect: any;
  onConfirm: (values: QuotationFormValues) => void;
  isSubmitting: boolean;
}

export function QuotationGeneratorDialog({ open, onOpenChange, prospect, onConfirm, isSubmitting }: QuotationGeneratorDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'products');
  }, [firestore]);
  const { data: allProducts, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

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

  useEffect(() => {
    const lastNumberStr = localStorage.getItem('lastQuotationNumber');
    const lastNumber = lastNumberStr ? parseInt(lastNumberStr, 10) : 1000;
    const nextNumber = lastNumber + 1;
    setQuotationDetails(prev => ({
      ...prev,
      number: `QT-${String(nextNumber).padStart(6, '0')}`,
    }));
  }, []);

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
  
  const generateAndConfirm = () => {
    if (!prospect) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se ha seleccionado un prospecto.' });
      return;
    }
    if (((!isIndividualFreight && freight > 0) || isIndividualFreight) && !freightTo.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'El destino del flete es requerido.' });
      return;
    }
    if (items.length === 0 || items.every(i => i.quantity === 0)) {
        toast({ variant: 'destructive', title: 'Error', description: 'Debe agregar al menos un producto a la cotización.' });
        return;
    }
    
    const currentNumberStr = quotationDetails.number.replace('QT-', '');
    const currentNumber = parseInt(currentNumberStr, 10);

    const doc = new jsPDF() as jsPDFWithAutoTable;
    const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
    const docWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
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
        doc.addImage(logoUrl, format.toUpperCase(), margin, 0, imgWidth, 0, undefined, 'NONE');
      } catch (e) {
        console.error("Error adding logo image to PDF:", e);
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(BLACK);
    doc.text('PAISANO TRAILER', docWidth - margin, headerTextY, { align: 'right', baseline: 'top' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100);

    const addressY = headerTextY + 7;
    const addressLineSpacing = 5;
    doc.text('CAMPO MENONITA 51T, NAMIQUIPA,', docWidth - margin, addressY, { align: 'right' });
    doc.text('CHIH. MEX, CP 31978', docWidth - margin, addressY + addressLineSpacing, { align: 'right' });
    doc.text('RFC: SPA150217AM3', docWidth - margin, addressY + addressLineSpacing * 2, { align: 'right' });

    const separatorY = 41;
    doc.setDrawColor(RED);
    doc.setLineWidth(0.8);
    doc.line(margin, separatorY, docWidth - margin, separatorY);
    doc.setDrawColor(BLACK);
    doc.setLineWidth(0.3);
    doc.line(margin, separatorY + 1.5, docWidth - margin, separatorY + 1.5);
    
    currentY = separatorY + 10;
    
    const quoteDetailsX = docWidth - margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('QUOTATION #:', quoteDetailsX - 45, currentY, { align: 'left' });
    doc.text('DATE:', quoteDetailsX - 45, currentY + 6, { align: 'left' });
    doc.text('VALIDITY:', quoteDetailsX - 45, currentY + 12, { align: 'left' });

    doc.setFont('helvetica', 'normal');
    doc.text(quotationDetails.number.toUpperCase(), quoteDetailsX, currentY, { align: 'right' });
    doc.text(new Date().toLocaleDateString('en-GB'), quoteDetailsX, currentY + 6, { align: 'right' });
    doc.text(quotationDetails.validity.toUpperCase(), quoteDetailsX, currentY + 12, { align: 'right' });
    
    currentY += 12 + 10;
    
    const infoStartY = currentY;
    const rightColX = docWidth / 2 + 10;
    const infoBoxHeight = 40;
    const titleBoxHeight = 7;
    const contentStartY = infoStartY + titleBoxHeight;
    
    const salesPersonBoxWidth = (docWidth / 2) - margin - 5;
    const buyerBoxWidth = (docWidth / 2) - margin - 10;

    // --- Sales Person Box ---
    doc.setFillColor(RED);
    doc.rect(margin, infoStartY, salesPersonBoxWidth, titleBoxHeight, 'F');
    doc.setFillColor(LIGHT_GRAY);
    doc.rect(margin, contentStartY, salesPersonBoxWidth, infoBoxHeight - titleBoxHeight, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor('#FFFFFF');
    doc.text('SALES PERSON:', margin + 3, infoStartY + 4.5);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(BLACK);
    if (userProfile) {
        doc.text(`${userProfile.firstName.toUpperCase()} ${userProfile.lastName.toUpperCase()}`, margin + 3, contentStartY + 5);
        if (userProfile.email) doc.text(userProfile.email.toLowerCase(), margin + 3, contentStartY + 10);
        if (userProfile.phone) doc.text(userProfile.phone, margin + 3, contentStartY + 15);
    }

    // --- Buyer Box ---
    doc.setFillColor(RED);
    doc.rect(rightColX, infoStartY, buyerBoxWidth, titleBoxHeight, 'F');
    doc.setFillColor(LIGHT_GRAY);
    doc.rect(rightColX, contentStartY, buyerBoxWidth, infoBoxHeight - titleBoxHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#FFFFFF');
    doc.text('BUYER:', rightColX + 3, infoStartY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(BLACK);
    doc.text(prospect.clientName.toUpperCase(), rightColX + 3, contentStartY + 5);
    doc.text(`ATTN: ${prospect.contactPerson.toUpperCase()}`, rightColX + 3, contentStartY + 10);
    if(prospect.email) doc.text(prospect.email.toLowerCase(), rightColX + 3, contentStartY + 15);
    if(prospect.phone) doc.text(prospect.phone, rightColX + 3, contentStartY + 20);
    
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

    doc.autoTable({
        head: tableHead,
        body: tableBody,
        startY: currentY,
        theme: 'striped',
        headStyles: { fillColor: [139, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: isIndividualFreight ? columnStyles5 : columnStyles4,
        margin: { left: margin, right: margin }
    });
    
    currentY = (doc as any).autoTable.previous.finalY;
    
    currentY += 4;
    const totalsY = currentY;
    let lineY = totalsY;
    doc.setFontSize(11);
    
    doc.setFont('helvetica', 'bold');
    doc.text('SUBTOTAL:', docWidth - 70, lineY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`$${subtotal.toFixed(2)}`, docWidth - margin, lineY, { align: 'right' });
    lineY += 7;

    if (isIndividualFreight) {
      const totalIndividualFreight = items.reduce((acc, item) => acc + (item.individualFreight || 0) * item.quantity, 0);
      if (totalIndividualFreight > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL FREIGHT:', docWidth - 70, lineY, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.text(`$${totalIndividualFreight.toFixed(2)}`, docWidth - margin, lineY, { align: 'right' });
        lineY += 7;
      }
    } else if (freight > 0) {
      doc.setFont('helvetica', 'bold');
      const freightText = `FREIGHT TO: ${freightTo.toUpperCase()}:`;
      doc.text(freightText, docWidth - 70, lineY, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.text(`$${freight.toFixed(2)}`, docWidth - margin, lineY, { align: 'right' });
      lineY += 7;
    }

    const totalY = lineY + 2;
    doc.setDrawColor(BLACK);
    doc.setLineWidth(0.2);
    doc.line(docWidth - 80, totalY, docWidth - margin, totalY);
    lineY = totalY + 7;
    
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL (${currency}):`, docWidth - 70, lineY, { align: 'right' });
    doc.setTextColor(RED);
    doc.text(`$${total.toFixed(2)}`, docWidth - margin, lineY, { align: 'right' });
    
    currentY = lineY;
    doc.setTextColor(BLACK);

    // New two-column section for terms and notes
    currentY += 10;
    const colGap = 10;
    const colWidth = (docWidth - margin * 2 - colGap) / 2;
    const colPadding = 4;
    const textMaxWidth = colWidth - (colPadding * 2);
    const col1X = margin;
    const col2X = margin + colWidth + colGap;

    doc.setFontSize(8);
    const lineHeight = doc.getLineHeight() / doc.internal.scaleFactor;
    
    const textOptions = {
        align: 'justify' as const,
        maxWidth: textMaxWidth
    };

    const termsBody = quotationDetails.terms ? quotationDetails.terms.toUpperCase() : '';
    const notesBody = quotationDetails.notes ? quotationDetails.notes.toUpperCase() : '';

    const termsDim = doc.getTextDimensions(termsBody, { ...textOptions, fontSize: 8 });
    const notesDim = doc.getTextDimensions(notesBody, { ...textOptions, fontSize: 8 });

    const termsContentHeight = termsBody ? (lineHeight * 2) + termsDim.h : 0;
    const notesContentHeight = notesBody ? (lineHeight * 2) + notesDim.h : 0;
    
    const sectionHeight = Math.max(termsContentHeight, notesContentHeight) + (colPadding * 2);

    if (currentY + sectionHeight > pageHeight - 35) { // 35 for footer
        doc.addPage();
        currentY = margin;
    }
    
    const boxStartY = currentY;
    
    if (termsContentHeight > 0 || notesContentHeight > 0) {
      doc.setFillColor(LIGHT_GRAY);
      if (termsContentHeight > 0) doc.rect(col1X, boxStartY, colWidth, sectionHeight, 'F');
      if (notesContentHeight > 0) doc.rect(col2X, boxStartY, colWidth, sectionHeight, 'F');
    }
    
    const titleY = boxStartY + colPadding + 2;
    const bodyY = titleY + lineHeight + 2;

    if (termsBody) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(BLACK);
      doc.text('TERMS AND CONDITIONS', col1X + colPadding, titleY);
      doc.setFont('helvetica', 'normal');
      doc.text(termsBody, col1X + colPadding, bodyY + 2, textOptions);
    }

    if (notesBody) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(BLACK);
      doc.text('ADDITIONAL NOTES', col2X + colPadding, titleY);
      doc.setFont('helvetica', 'normal');
      doc.text(notesBody, col2X + colPadding, bodyY + 2, textOptions);
    }
    
    if (termsContentHeight > 0 || notesContentHeight > 0) {
      currentY += sectionHeight;
    }
    
    const signatureHeight = 25;
    if (currentY + signatureHeight > pageHeight - 35) {
        doc.addPage();
        currentY = margin;
    }
    currentY += 5;
    
    const sigWidth = 80;
    const sigXStart = (docWidth - sigWidth) / 2;
    doc.line(sigXStart, currentY, sigXStart + sigWidth, currentY);
    doc.setFontSize(9);
    doc.text('APPROVAL SIGNATURE', docWidth / 2, currentY + 5, { align: 'center' });
    
    let pageCount = (doc as any).internal.getNumberOfPages();
    const footerHeight = 20;
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const footerStartY = pageHeight - footerHeight;

        doc.setFillColor(RED);
        doc.rect(0, footerStartY, docWidth, footerHeight, 'F');
        
        doc.setFontSize(9);
        doc.setTextColor('#FFFFFF');

        const footerTextY = footerStartY + (footerHeight / 2);
        const footerText = `paisanosales@gmail.com | 915 408 7478 | www.paisanotrailer.com`;
        doc.text(footerText, docWidth / 2, footerTextY, { align: 'center', baseline: 'middle' });
        doc.text(`PAGE ${i} OF ${pageCount}`, docWidth - margin, footerTextY, { align: 'right', baseline: 'middle' });
    }

    const pdfFile = new File([doc.output('blob')], `QT-${quotationDetails.number}-${prospect.clientName.replace(/\s/g, '_')}.pdf`, { type: 'application/pdf' });

    onConfirm({
      value: total,
      currency,
      pdf: pdfFile,
    });
    
    localStorage.setItem('lastQuotationNumber', String(currentNumber));
    const nextNumber = currentNumber + 1;
    setQuotationDetails(prev => ({ ...prev, number: `QT-${String(nextNumber).padStart(6, '0')}` }));
    setItems([{ productId: '', description: '', quantity: 1, price: 0, individualFreight: 0 }]);
    setFreight(0);
    setFreightTo('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl h-[90vh] flex flex-col" onPointerDownOutside={(e) => { if (e.target instanceof HTMLElement && e.target.closest('[data-radix-popper-content-wrapper]')) { e.preventDefault(); } }}>
        <DialogHeader>
          <DialogTitle>GENERAR COTIZACIÓN PARA {prospect?.clientName.toUpperCase()}</DialogTitle>
          <DialogDescription>
            Añada productos, configure el flete y genere la cotización en PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto pr-6 -mr-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label>MONEDA</Label>
                       <Select onValueChange={setCurrency} value={currency}>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccione una moneda" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="USD">USD - Dólar Americano</SelectItem>
                            <SelectItem value="MXN">MXN - Peso Mexicano</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end pb-1.5">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="individual-freight-dialog" checked={isIndividualFreight} onCheckedChange={(checked) => setIsIndividualFreight(!!checked)} />
                        <Label htmlFor="individual-freight-dialog">Flete Individual por Producto</Label>
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
                              {isIndividualFreight && <TableHead>FLETE UNITARIO</TableHead>}
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
                                        disabled={areProductsLoading}
                                      >
                                          <SelectTrigger>
                                              <SelectValue placeholder="Seleccionar producto..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                              {areProductsLoading ? (
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
                          <Label htmlFor="freight-to-dialog">FLETE A:</Label>
                          <Input
                              id="freight-to-dialog"
                              placeholder="Destino"
                              value={freightTo}
                              onChange={(e) => setFreightTo(e.target.value)}
                              className="w-48"
                          />
                      </div>
                      {!isIndividualFreight && (
                        <div className="flex justify-between items-center">
                            <Label htmlFor="freight-amount-dialog">MONTO DE FLETE</Label>
                            <Input
                                id="freight-amount-dialog"
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
          </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDetailsDialogOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Detalles PDF
          </Button>
          <div className="flex-grow" />
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={generateAndConfirm} disabled={!prospect || isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Generar y Guardar Cotización'}
          </Button>
        </DialogFooter>
       <QuotationDetailsDialog
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        initialDetails={quotationDetails}
        onSave={setQuotationDetails}
      />
    </DialogContent>
    </Dialog>
  );
}
