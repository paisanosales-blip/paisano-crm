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
    validity: '30 days',
    terms: 'Payment Terms: 50% down payment, 50% upon delivery.\nPrices do not include VAT.\nDelivery times are subject to change without prior notice.',
    notes: 'Thank you for your preference.',
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
      alert('Please select a client.');
      return;
    }

    const doc = new jsPDF() as jsPDFWithAutoTable;
    const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
    const docWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
    const margin = 15;
    let finalY = 0;

    const logoUrl = localStorage.getItem('sidebarLogo');

    // --- HEADER ---
    if (logoUrl) {
        try {
            const format = logoUrl.substring(logoUrl.indexOf('/') + 1, logoUrl.indexOf(';'));
            doc.addImage(logoUrl, format.toUpperCase(), margin, 12, 50, 25);
        } catch (e) {
            console.error("Error adding logo image to PDF:", e);
        }
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('PAISANO TRAILER MANUFACTURING', docWidth - margin, 20, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('paisanosales@gmail.com', docWidth - margin, 26, { align: 'right' });
    doc.text('915 408 7478', docWidth - margin, 30, { align: 'right' });
    doc.text('www.paisanotrailer.com', docWidth - margin, 34, { align: 'right' });
    
    finalY = 45;

    doc.setDrawColor(220, 220, 220); // light grey
    doc.line(margin, finalY, docWidth - margin, finalY);

    // --- INFO SECTION ---
    const infoStartY = finalY + 10;
    
    // Client Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text('BILL TO:', margin, infoStartY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(selectedClient.clientName, margin, infoStartY + 6);
    doc.text(`Attn: ${selectedClient.contactPerson}`, margin, infoStartY + 11);
    if(selectedClient.email) doc.text(selectedClient.email, margin, infoStartY + 16);
    if(selectedClient.phone) doc.text(selectedClient.phone, margin, infoStartY + 21);

    // Quotation & Seller Info
    const rightColX = docWidth - margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('QUOTATION #:', rightColX - 45, infoStartY, { align: 'left' });
    doc.text('DATE:', rightColX - 45, infoStartY + 6, { align: 'left' });
    doc.text('VALIDITY:', rightColX - 45, infoStartY + 12, { align: 'left' });
    doc.text('SALESPERSON:', rightColX - 45, infoStartY + 18, { align: 'left' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(quotationDetails.number, rightColX, infoStartY, { align: 'right' });
    doc.text(new Date().toLocaleDateString('en-US'), rightColX, infoStartY + 6, { align: 'right' });
    doc.text(quotationDetails.validity, rightColX, infoStartY + 12, { align: 'right' });
    if (userProfile) {
        doc.text(`${userProfile.firstName} ${userProfile.lastName}`, rightColX, infoStartY + 18, { align: 'right' });
    }

    finalY = infoStartY + 30;

    // --- PRODUCTS TABLE ---
    const tableColumn = ["Description", "Qty.", "Unit Price", "Total"];
    const tableRows: (string | number)[][] = [];

    products.forEach(prod => {
        const productData = [
            prod.description,
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
        headStyles: { fillColor: [139, 0, 0] }, // Deep Red
        styles: { fontSize: 9, cellPadding: 3 },
        margin: { left: margin, right: margin }
    });
    
    finalY = doc.autoTable.previous.finalY;
    
    // --- TOTALS ---
    const totalsY = finalY + 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', docWidth - 70, totalsY, { align: 'right' });
    doc.text(`$${subtotal.toFixed(2)}`, docWidth - margin, totalsY, { align: 'right' });

    doc.text('Freight:', docWidth - 70, totalsY + 7, { align: 'right' });
    doc.text(`$${freight.toFixed(2)}`, docWidth - margin, totalsY + 7, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Total:', docWidth - 70, totalsY + 15, { align: 'right' });
    doc.text(`$${total.toFixed(2)}`, docWidth - margin, totalsY + 15, { align: 'right' });
    
    let currentY = totalsY + 30;

    // --- TERMS, NOTES, SIGNATURE ---
    if (quotationDetails.notes) {
       if (currentY + 20 > pageHeight) { doc.addPage(); currentY = margin; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Additional Notes', margin, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const notesLines = doc.splitTextToSize(quotationDetails.notes, docWidth - (margin * 2));
      doc.text(notesLines, margin, currentY + 5);
      currentY += (notesLines.length * 4) + 10;
    }

    if (quotationDetails.terms) {
      if (currentY + 20 > pageHeight) { doc.addPage(); currentY = margin; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Terms and Conditions', margin, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const termsLines = doc.splitTextToSize(quotationDetails.terms, docWidth - (margin * 2));
      doc.text(termsLines, margin, currentY + 5);
      currentY += (termsLines.length * 4) + 10;
    }
    
    // --- FOOTER ---
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const isLastPage = i === pageCount;
        
        if (isLastPage) {
            // Add signature only on last page
            let sigY = pageHeight - 50;
            if (currentY > sigY) sigY = currentY + 10; // make sure it doesn't overlap
            
            doc.line(margin, sigY, docWidth / 2 - margin, sigY);
            doc.setFontSize(8);
            doc.text('Approval Signature', margin, sigY + 5);
        }
        
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, docWidth / 2, pageHeight - margin + 5, { align: 'center' });
    }

    doc.save(`Quotation-${selectedClient.clientName.replace(/\s/g, '_')}-${quotationDetails.number}.pdf`);
  };

  return (
    <>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-headline font-bold">New Quotation</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsDetailsDialogOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Quotation Details
            </Button>
            <Button onClick={generatePdf} disabled={!selectedClientId}>
                <FileDown className="mr-2 h-4 w-4" />
                Generate PDF
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quotation Details</CardTitle>
            <CardDescription>
              Select a client and add products to generate the quotation document.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
              <div className="max-w-sm">
                  <Label htmlFor="client-select">Select Client</Label>
                  <Select onValueChange={setSelectedClientId} value={selectedClientId} disabled={areLeadsLoading}>
                      <SelectTrigger id="client-select">
                          <SelectValue placeholder="Choose a client..." />
                      </SelectTrigger>
                      <SelectContent>
                          {areLeadsLoading ? (
                              <SelectItem value="loading" disabled>Loading clients...</SelectItem>
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
                  <Label>Products / Services</Label>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead className="w-[60%]">Description</TableHead>
                              <TableHead>Quantity</TableHead>
                              <TableHead>Unit Price</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead className="w-[50px]"><span className="sr-only">Actions</span></TableHead>
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
                      Add Product
                  </Button>
              </div>

              <div className="flex justify-end">
                  <div className="w-full max-w-sm space-y-4">
                      <div className="flex justify-between items-center">
                          <Label>Freight</Label>
                          <Input type="number" value={freight} onChange={(e) => setFreight(Number(e.target.value))} className="w-32" />
                      </div>
                      <div className="flex justify-between items-center font-medium">
                          <p>Subtotal:</p>
                          <p>${subtotal.toFixed(2)}</p>
                      </div>
                      <div className="flex justify-between items-center text-lg font-bold">
                          <p>Total:</p>
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
