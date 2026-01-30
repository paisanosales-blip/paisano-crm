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
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [quotationDetails, setQuotationDetails] = useState<QuotationDetails>({
    number: `QT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    validity: '30 DAYS',
    terms: 'PAYMENT TERMS: 50% DOWN PAYMENT, 50% UPON DELIVERY.\nPRICES DO NOT INCLUDE VAT.\nDELIVERY TIMES ARE SUBJECT TO CHANGE WITHOUT PRIOR NOTICE.',
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

    const doc = new jsPDF() as jsPDFWithAutoTable;
    const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
    const docWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
    const margin = 15;
    let finalY = 0;

    const logoUrl = localStorage.getItem('sidebarLogo');
    const RED = '#8B0000';
    const BLACK = '#000000';

    // --- HEADER ---
    if (logoUrl) {
        try {
            const format = logoUrl.substring(logoUrl.indexOf('/') + 1, logoUrl.indexOf(';'));
            doc.addImage(logoUrl, format.toUpperCase(), margin, 15, 50, 25);
        } catch (e) {
            console.error("Error adding logo image to PDF:", e);
        }
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(BLACK);
    doc.text('PAISANO TRAILER', docWidth - margin, 25, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('CAMPO MENONITA 51T, NAMIQUIPA,', docWidth - margin, 32, { align: 'right' });
    doc.text('CHIH. MEX, CP 31978', docWidth - margin, 36, { align: 'right' });

    // Decorative Separator
    doc.setDrawColor(RED);
    doc.setLineWidth(0.8);
    doc.line(margin, 45, docWidth - margin, 45);

    finalY = 55;

    // --- INFO SECTION ---
    const infoStartY = finalY;
    const rightColX = docWidth / 2 + 10;

    // Salesperson Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(BLACK);
    doc.text('SALESPERSON:', margin, infoStartY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    if (userProfile) {
        doc.text(`${userProfile.firstName.toUpperCase()} ${userProfile.lastName.toUpperCase()}`, margin, infoStartY + 6);
        if (userProfile.email) doc.text(userProfile.email.toUpperCase(), margin, infoStartY + 11);
    }

    // Client Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('BILL TO:', rightColX, infoStartY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(selectedClient.clientName.toUpperCase(), rightColX, infoStartY + 6);
    doc.text(`ATTN: ${selectedClient.contactPerson.toUpperCase()}`, rightColX, infoStartY + 11);
    if(selectedClient.email) doc.text(selectedClient.email.toUpperCase(), rightColX, infoStartY + 16);
    if(selectedClient.phone) doc.text(selectedClient.phone.toUpperCase(), rightColX, infoStartY + 21);


    // Quotation Details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const quoteDetailsX = docWidth - margin;
    doc.text('QUOTATION #:', quoteDetailsX - 45, infoStartY + 35, { align: 'left' });
    doc.text('DATE:', quoteDetailsX - 45, infoStartY + 41, { align: 'left' });
    doc.text('VALIDITY:', quoteDetailsX - 45, infoStartY + 47, { align: 'left' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(quotationDetails.number.toUpperCase(), quoteDetailsX, infoStartY + 35, { align: 'right' });
    doc.text(new Date().toLocaleDateString('en-US'), quoteDetailsX, infoStartY + 41, { align: 'right' });
    doc.text(quotationDetails.validity.toUpperCase(), quoteDetailsX, infoStartY + 47, { align: 'right' });

    finalY = infoStartY + 60;

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
        headStyles: { fillColor: [139, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 3 },
        margin: { left: margin, right: margin }
    });
    
    finalY = doc.autoTable.previous.finalY;
    
    // --- TOTALS ---
    const totalsY = finalY + 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SUBTOTAL:', docWidth - 70, totalsY, { align: 'right' });
    doc.text(`$${subtotal.toFixed(2)}`, docWidth - margin, totalsY, { align: 'right' });

    doc.text('FREIGHT:', docWidth - 70, totalsY + 7, { align: 'right' });
    doc.text(`$${freight.toFixed(2)}`, docWidth - margin, totalsY + 7, { align: 'right' });
    
    doc.setDrawColor(BLACK);
    doc.setLineWidth(0.2);
    doc.line(docWidth - 80, totalsY + 11, docWidth - margin, totalsY + 11);

    doc.setFontSize(12);
    doc.setTextColor(RED);
    doc.text('TOTAL:', docWidth - 70, totalsY + 16, { align: 'right' });
    doc.setTextColor(BLACK);
    doc.text(`$${total.toFixed(2)}`, docWidth - margin, totalsY + 16, { align: 'right' });
    
    let currentY = totalsY + 30;

    // --- TERMS, NOTES ---
    if (quotationDetails.notes) {
       if (currentY + 20 > pageHeight) { doc.addPage(); currentY = margin; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('ADDITIONAL NOTES', margin, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const notesLines = doc.splitTextToSize(quotationDetails.notes.toUpperCase(), docWidth - (margin * 2));
      doc.text(notesLines, margin, currentY + 5);
      currentY += (notesLines.length * 4) + 10;
    }

    if (quotationDetails.terms) {
      if (currentY + 20 > pageHeight) { doc.addPage(); currentY = margin; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('TERMS AND CONDITIONS', margin, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const termsLines = doc.splitTextToSize(quotationDetails.terms.toUpperCase(), docWidth - (margin * 2));
      doc.text(termsLines, margin, currentY + 5);
      currentY += (termsLines.length * 4) + 10;
    }
    
    // --- FOOTER AND SIGNATURE ---
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const isLastPage = i === pageCount;
        
        let footerY = pageHeight - 25;
        
        if (isLastPage) {
            let sigY = footerY - 30;
            // Add a new page if the content + signature block will overflow
            if (currentY > sigY && i === (doc as any).internal.getCurrentPageInfo().pageNumber) {
                doc.addPage();
                // Redefine page count as we have added a new page
                const newPageCount = doc.internal.getNumberOfPages();
                doc.setPage(newPageCount);
                currentY = margin; 
                sigY = pageHeight - 55;
            }
            
            doc.line(margin, sigY, docWidth / 2 - margin, sigY);
            doc.setFontSize(9);
            doc.text('APPROVAL SIGNATURE', margin, sigY + 5);
        }

        doc.setDrawColor(RED);
        doc.setLineWidth(0.5);
        doc.line(margin, footerY, docWidth - margin, footerY);

        doc.setFontSize(9);
        doc.setTextColor(100);
        const footerText = `PAISANOSALES@GMAIL.COM | 915 408 7478 | WWW.PAISANOTRAILER.COM`;
        doc.text(footerText, docWidth / 2, footerY + 8, { align: 'center' });
        doc.text(`PAGE ${i} OF ${doc.internal.getNumberOfPages()}`, docWidth - margin, footerY + 8, { align: 'right' });
    }

    doc.save(`QUOTATION-${selectedClient.clientName.replace(/\s/g, '_')}-${quotationDetails.number}.pdf`);
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
                      <div className="flex justify-between items-center">
                          <Label>FREIGHT</Label>
                          <Input type="number" value={freight} onChange={(e) => setFreight(Number(e.target.value))} className="w-32" />
                      </div>
                      <div className="flex justify-between items-center font-medium">
                          <p>SUBTOTAL:</p>
                          <p>${subtotal.toFixed(2)}</p>
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
