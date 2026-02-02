'use client';

import React, { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
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

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

type Product = {
  description: string;
  quantity: number;
  price: number;
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
  const { user } = useUser();
  const firestore = useFirestore();

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

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([
    { description: '', quantity: 1, price: 0 },
  ]);
  const [freight, setFreight] = useState(0);
  const [freightTo, setFreightTo] = useState('');
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [quotationDetails, setQuotationDetails] = useState<QuotationDetails>({
    number: `QT-${Date.now().toString().slice(-6)}`,
    validity: '30 DAYS',
    terms: 'PAYMENT TERMS: 10% DOWN PAYMENT, 90% UPON DELIVERY.\nPRICES DO NOT INCLUDE VAT.\nDELIVERY TIMES ARE SUBJECT TO CHANGE WITHOUT PRIOR NOTICE.',
    notes: 'THANK YOU FOR YOUR PREFERENCE.',
  });

  const selectedClient = useMemo(() => {
    if (!leads || !selectedClientId) return null;
    return (leads as Client[]).find(lead => lead.id === selectedClientId) || null;
  }, [leads, selectedClientId]);

  const handleProductChange = (index: number, field: keyof Product, value: string | number) => {
    const newProducts = [...products];
    if (typeof newProducts[index][field] === 'number') {
      newProducts[index] = { ...newProducts[index], [field]: Number(value) };
    } else {
      newProducts[index] = { ...newProducts[index], [field]: value };
    }
    setProducts(newProducts);
  };

  const addProduct = () => {
    setProducts([...products, { description: '', quantity: 1, price: 0 }]);
  };

  const removeProduct = (index: number) => {
    const newProducts = products.filter((_, i) => i !== index);
    setProducts(newProducts);
  };

  const subtotal = useMemo(() => {
    return products.reduce((acc, product) => acc + product.quantity * product.price, 0);
  }, [products]);

  const total = useMemo(() => {
    return subtotal + freight;
  }, [subtotal, freight]);
  
  const generatePdf = () => {
    if (!selectedClient) {
      alert('PLEASE SELECT A CLIENT.');
      return;
    }
    if (freight > 0 && !freightTo.trim()) {
      alert('FREIGHT DESTINATION IS REQUIRED WHEN FREIGHT AMOUNT IS ADDED.');
      return;
    }

    const doc = new jsPDF() as jsPDFWithAutoTable;
    const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
    const docWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
    const margin = 15;
    let finalY = 0;

    const logoUrl = localStorage.getItem('sidebarLogo');
    const RED = '#8B0000';
    const BLACK = '#000000';
    const LIGHT_GRAY = '#F5F5F5';

    // --- HEADER ---
    if (logoUrl) {
        try {
            const format = logoUrl.substring(logoUrl.indexOf('/') + 1, logoUrl.indexOf(';'));
            // Use 0 for height to maintain aspect ratio
            doc.addImage(logoUrl, format.toUpperCase(), margin, 15, 90, 0); 
        } catch (e) {
            console.error("Error adding logo image to PDF:", e);
        }
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(BLACK);
    doc.text('PAISANO TRAILER', docWidth - margin, 15, { align: 'right', baseline: 'top' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('CAMPO MENONITA 51T, NAMIQUIPA,', docWidth - margin, 30, { align: 'right' });
    doc.text('CHIH. MEX, CP 31978', docWidth - margin, 34, { align: 'right' });
    doc.text('RFC: SPA150217AM3', docWidth - margin, 38, { align: 'right' });


    // Decorative Separator
    doc.setDrawColor(RED);
    doc.setLineWidth(0.8);
    doc.line(margin, 45, docWidth - margin, 45);
    doc.setDrawColor(BLACK);
    doc.setLineWidth(0.3);
    doc.line(margin, 46.5, docWidth - margin, 46.5);

    finalY = 57; // Increased space after separator

    // --- QUOTATION DETAILS ---
    const quoteDetailsX = docWidth - margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('QUOTATION #:', quoteDetailsX - 45, finalY, { align: 'left' });
    doc.text('DATE:', quoteDetailsX - 45, finalY + 6, { align: 'left' });
    doc.text('VALIDITY:', quoteDetailsX - 45, finalY + 12, { align: 'left' });

    doc.setFont('helvetica', 'normal');
    doc.text(quotationDetails.number.toUpperCase(), quoteDetailsX, finalY, { align: 'right' });
    doc.text(new Date().toLocaleDateString('en-GB'), quoteDetailsX, finalY + 6, { align: 'right' });
    doc.text(quotationDetails.validity.toUpperCase(), quoteDetailsX, finalY + 12, { align: 'right' });

    finalY += 12 + 10; // Block height + space after


    // --- INFO SECTION ---
    const infoStartY = finalY;
    const rightColX = docWidth / 2 + 10;
    const infoBoxHeight = 28;

    // Add background boxes
    doc.setFillColor(LIGHT_GRAY);
    doc.rect(margin, infoStartY - 2, (docWidth / 2) - margin - 5, infoBoxHeight, 'F');
    doc.rect(rightColX, infoStartY - 2, (docWidth / 2) - margin - 10, infoBoxHeight, 'F');
    
    // Salesperson Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(BLACK);
    doc.text('SALES PERSON:', margin + 3, infoStartY + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    if (userProfile) {
        doc.text(`${userProfile.firstName.toUpperCase()} ${userProfile.lastName.toUpperCase()}`, margin + 3, infoStartY + 10);
        if (userProfile.email) doc.text(userProfile.email.toUpperCase(), margin + 3, infoStartY + 15);
    }

    // Client Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('BUYER:', rightColX + 3, infoStartY + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(selectedClient.clientName.toUpperCase(), rightColX + 3, infoStartY + 10);
    doc.text(`ATTN: ${selectedClient.contactPerson.toUpperCase()}`, rightColX + 3, infoStartY + 15);
    if(selectedClient.email) doc.text(selectedClient.email.toUpperCase(), rightColX + 3, infoStartY + 20);

    finalY = infoStartY + infoBoxHeight + 8; // Optimized space

    // --- PRODUCTS TABLE ---
    const tableColumn = ["DESCRIPTION", "QTY", "UNIT PRICE", "TOTAL"];
    const tableRows: (string | number)[][] = [];

    products.forEach(prod => {
        const productData = [
            prod.description.toUpperCase(),
            prod.quantity,
            `$${prod.price.toFixed(2)}`,
            `$${(prod.quantity * prod.price).toFixed(2)}`
        ];
        tableRows.push(productData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: finalY,
        theme: 'striped',
        headStyles: { fillColor: [139, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 11 },
        styles: { fontSize: 11, cellPadding: 3 },
        margin: { left: margin, right: margin }
    });
    
    let currentY = (doc as any).autoTable.previous.finalY;
    
    // --- TOTALS ---
    const totalsY = currentY + 6; // Optimized space
    let lineY = totalsY;
    doc.setFontSize(11);
    
    // Subtotal
    doc.setFont('helvetica', 'bold');
    doc.text('SUBTOTAL:', docWidth - 70, lineY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`$${subtotal.toFixed(2)}`, docWidth - margin, lineY, { align: 'right' });
    lineY += 7;

    // Freight
    if (freight > 0) {
      doc.setFont('helvetica', 'bold');
      const freightText = `FREIGHT TO: ${freightTo.toUpperCase()}:`;
      doc.text(freightText, docWidth - margin, lineY, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    }

    // Total
    const totalY = lineY + 2; // Optimized space
    doc.setDrawColor(BLACK);
    doc.setLineWidth(0.2);
    doc.line(docWidth - 80, totalY, docWidth - margin, totalY);
    lineY = totalY + 7;
    
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL (DOLLARS):', docWidth - 70, lineY, { align: 'right' });
    doc.setTextColor(RED);
    doc.text(`$${total.toFixed(2)}`, docWidth - margin, lineY, { align: 'right' });
    
    currentY = lineY;
    doc.setTextColor(BLACK);

    const addSection = (title: string, content: string, fontSize: number) => {
      const lines = doc.splitTextToSize(content.toUpperCase(), docWidth - (margin * 2));
      const sectionHeight = (lines.length * (fontSize / 2.5)) + 8;
      
      if (currentY + sectionHeight > pageHeight - 35) { // Check space
        doc.addPage();
        currentY = margin;
      } else {
        currentY += 10;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      doc.text(title.toUpperCase(), margin, currentY);
      currentY += 4;
      doc.setFont('helvetica', 'normal');
      doc.text(lines, margin, currentY);
      currentY += (lines.length * (fontSize / 2.5));
    };

    if (quotationDetails.notes) {
      addSection('ADDITIONAL NOTES', quotationDetails.notes, 8);
    }
    if (quotationDetails.terms) {
      addSection('TERMS AND CONDITIONS', quotationDetails.terms, 8);
    }
    
    // --- APPROVAL SIGNATURE ---
    const signatureHeight = 25;
    if (currentY + signatureHeight > pageHeight - 35) { // Check space for signature
        doc.addPage();
        currentY = margin;
    }
    currentY += 20;
    
    const sigWidth = 80;
    const sigXStart = (docWidth - sigWidth) / 2;
    doc.line(sigXStart, currentY, sigXStart + sigWidth, currentY);
    doc.setFontSize(9);
    doc.text('APPROVAL SIGNATURE', docWidth / 2, currentY + 5, { align: 'center' });
    
    
    // --- FOOTER ---
    let pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const footerY = pageHeight - 25;

        doc.setDrawColor(RED);
        doc.setLineWidth(0.5);
        doc.line(margin, footerY, docWidth - margin, footerY);

        doc.setFontSize(9);
        doc.setTextColor(100);
        const footerText = `PAISANOSALES@GMAIL.COM | 915 408 7478 | WWW.PAISANOTRAILER.COM`;
        doc.text(footerText, docWidth / 2, footerY + 8, { align: 'center' });
        doc.text(`PAGE ${i} OF ${pageCount}`, docWidth - margin, footerY + 8, { align: 'right' });
    }

    doc.save(`QUOTATION-${selectedClient.clientName.replace(/\s/g, '_')}-${quotationDetails.number}.pdf`);

    setQuotationDetails(prev => ({
        ...prev,
        number: `QT-${Date.now().toString().slice(-6)}`
    }));
  };

  return (
    <>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-headline font-bold">NEW QUOTATION</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsDetailsDialogOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                QUOTATION DETAILS
            </Button>
            <Button onClick={generatePdf} disabled={!selectedClientId}>
                <FileDown className="mr-2 h-4 w-4" />
                GENERATE PDF
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>QUOTATION DETAILS</CardTitle>
            <CardDescription>
              SELECT A CLIENT AND ADD PRODUCTS TO GENERATE THE QUOTATION DOCUMENT.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
              <div className="max-w-sm">
                  <Label htmlFor="client-select">SELECT CLIENT</Label>
                  <Select onValueChange={setSelectedClientId} value={selectedClientId} disabled={areLeadsLoading}>
                      <SelectTrigger id="client-select">
                          <SelectValue placeholder="CHOOSE A CLIENT..." />
                      </SelectTrigger>
                      <SelectContent>
                          {areLeadsLoading ? (
                              <SelectItem value="loading" disabled>LOADING CLIENTS...</SelectItem>
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

              <div>
                  <Label>PRODUCTS / SERVICES</Label>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead className="w-[60%]">DESCRIPTION</TableHead>
                              <TableHead>QUANTITY</TableHead>
                              <TableHead>UNIT PRICE</TableHead>
                              <TableHead>TOTAL</TableHead>
                              <TableHead className="w-[50px]"><span className="sr-only">ACTIONS</span></TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {products.map((product, index) => (
                              <TableRow key={index}>
                                  <TableCell>
                                      <Input
                                          type="text"
                                          placeholder="Product description..."
                                          value={product.description}
                                          onChange={(e) => handleProductChange(index, 'description', e.target.value)}
                                      />
                                  </TableCell>
                                  <TableCell>
                                      <Input
                                          type="number"
                                          value={product.quantity}
                                          onChange={(e) => handleProductChange(index, 'quantity', e.target.value)}
                                          className="w-20"
                                      />
                                  </TableCell>
                                  <TableCell>
                                      <Input
                                          type="number"
                                          value={product.price}
                                          onChange={(e) => handleProductChange(index, 'price', e.target.value)}
                                          className="w-32"
                                      />
                                  </TableCell>
                                  <TableCell className="font-medium">
                                      ${(product.quantity * product.price).toFixed(2)}
                                  </TableCell>
                                  <TableCell>
                                      <Button variant="ghost" size="icon" onClick={() => removeProduct(index)}>
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                  </TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
                  <Button variant="outline" size="sm" onClick={addProduct} className="mt-4">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      ADD PRODUCT
                  </Button>
              </div>

              <div className="flex justify-end">
                  <div className="w-full max-w-sm space-y-4">
                      <div className="flex justify-between items-center font-medium">
                          <p>SUBTOTAL:</p>
                          <p>${subtotal.toFixed(2)}</p>
                      </div>
                      <div className="flex justify-between items-center">
                          <Label htmlFor="freight-to">FREIGHT TO:</Label>
                          <Input
                              id="freight-to"
                              placeholder="Destination"
                              value={freightTo}
                              onChange={(e) => setFreightTo(e.target.value)}
                              className="w-48"
                          />
                      </div>
                      <div className="flex justify-between items-center">
                          <Label htmlFor="freight-amount">FREIGHT AMOUNT</Label>
                          <Input
                              id="freight-amount"
                              type="number"
                              value={freight}
                              onChange={(e) => setFreight(Number(e.target.value))}
                              className="w-32"
                          />
                      </div>
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
