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
    validity: '30 días',
    terms: 'Condiciones de pago: 50% de anticipo, 50% contra entrega.\nLos precios no incluyen IVA.\nTiempo de entrega sujeto a cambios sin previo aviso.',
    notes: 'Gracias por su preferencia.',
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
      alert('Por favor seleccione un cliente.');
      return;
    }

    const doc = new jsPDF() as jsPDFWithAutoTable;
    const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
    const docWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
    let finalY = 0;

    const logoUrl = localStorage.getItem('sidebarLogo');

    // Header
    doc.setFillColor(20, 20, 20); // Black
    doc.rect(0, 0, docWidth, 35, 'F');

    if (logoUrl) {
        try {
            const format = logoUrl.substring(logoUrl.indexOf('/') + 1, logoUrl.indexOf(';'));
            doc.addImage(logoUrl, format.toUpperCase(), 15, 5, 50, 25);
        } catch (e) {
            console.error("Error adding logo image to PDF:", e);
        }
    }
    
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255); // White
    doc.setFont('helvetica', 'bold');
    doc.text('PAISANO TRAILER MANUFACTURING', docWidth - 15, 12, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text('paisanosales@gmail.com', docWidth - 15, 18, { align: 'right' });
    doc.text('915 408 7478', docWidth - 15, 24, { align: 'right' });
    doc.text('www.paisanotrailer.com', docWidth - 15, 30, { align: 'right' });
    

    // Title
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0); // Black
    doc.setFont('helvetica', 'bold');
    doc.text('COTIZACIÓN', 15, 50);

    // Info sections
    const infoStartY = 60;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('VENDIDO A:', 15, infoStartY);
    doc.text('VENDEDOR:', docWidth / 2, infoStartY);

    doc.setLineWidth(0.2);
    doc.line(15, infoStartY + 2, docWidth - 15, infoStartY + 2);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // Client Info
    doc.text(selectedClient.clientName, 15, infoStartY + 8);
    doc.text(`Attn: ${selectedClient.contactPerson}`, 15, infoStartY + 13);
    if(selectedClient.email) doc.text(selectedClient.email, 15, infoStartY + 18);
    if(selectedClient.phone) doc.text(selectedClient.phone, 15, infoStartY + 23);
    
    // Seller Info
    if (userProfile) {
        doc.text(`${userProfile.firstName} ${userProfile.lastName}`, docWidth / 2, infoStartY + 8);
        doc.text(userProfile.email || '', docWidth / 2, infoStartY + 13);
    }
    
    // Quotation Details
    doc.text(`COTIZACIÓN #: ${quotationDetails.number}`, docWidth - 15, infoStartY + 8, { align: 'right' });
    doc.text(`FECHA: ${new Date().toLocaleDateString('es-MX')}`, docWidth - 15, infoStartY + 13, { align: 'right' });
    doc.text(`VALIDEZ: ${quotationDetails.validity}`, docWidth - 15, infoStartY + 18, { align: 'right' });


    // Products Table
    const tableColumn = ["Descripción", "Cant.", "Precio Unitario", "Total"];
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
        startY: infoStartY + 30,
        theme: 'grid',
        headStyles: { fillColor: [139, 0, 0] }, // Deep Red
        styles: { fontSize: 9 },
    });
    
    finalY = doc.autoTable.previous.finalY;
    
    // Totals
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', docWidth - 60, finalY + 10);
    doc.text(`$${subtotal.toFixed(2)}`, docWidth - 15, finalY + 10, { align: 'right' });

    doc.text('Flete:', docWidth - 60, finalY + 17);
    doc.text(`$${freight.toFixed(2)}`, docWidth - 15, finalY + 17, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    doc.text('Total:', docWidth - 60, finalY + 24);
    doc.text(`$${total.toFixed(2)}`, docWidth - 15, finalY + 24, { align: 'right' });
    
    finalY = finalY + 30;

    let currentY = finalY + 20;

    // Signature
    doc.line(15, currentY, docWidth / 2 - 15, currentY);
    doc.setFontSize(8);
    doc.text('Firma de Aprobación', 15, currentY + 5);
    currentY += 15;

    // Terms and Notes
    if (quotationDetails.terms) {
      if (currentY + 20 > pageHeight) { // Check if new page is needed
        doc.addPage();
        currentY = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Términos y Condiciones', 15, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const termsLines = doc.splitTextToSize(quotationDetails.terms, docWidth - 30);
      doc.text(termsLines, 15, currentY + 5);
      currentY += (termsLines.length * 4) + 10;
    }
    
    if (quotationDetails.notes) {
       if (currentY + 20 > pageHeight) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Notas Adicionales', 15, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const notesLines = doc.splitTextToSize(quotationDetails.notes, docWidth - 30);
      doc.text(notesLines, 15, currentY + 5);
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(20, 20, 20);
        doc.rect(0, pageHeight - 15, docWidth, 15, 'F');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(`Página ${i} de ${pageCount}`, docWidth / 2, pageHeight - 7, { align: 'center' });
    }

    doc.save(`Cotizacion-${selectedClient.clientName.replace(/\s/g, '_')}-${quotationDetails.number}.pdf`);
  };

  return (
    <>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-headline font-bold">Nueva Cotización</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsDetailsDialogOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Datos de la Cotización
            </Button>
            <Button onClick={generatePdf} disabled={!selectedClientId}>
                <FileDown className="mr-2 h-4 w-4" />
                Generar PDF
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Detalles de la Cotización</CardTitle>
            <CardDescription>
              Seleccione un cliente y agregue los productos para generar el documento de cotización.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
              <div className="max-w-sm">
                  <Label htmlFor="client-select">Seleccionar Cliente</Label>
                  <Select onValueChange={setSelectedClientId} value={selectedClientId} disabled={areLeadsLoading}>
                      <SelectTrigger id="client-select">
                          <SelectValue placeholder="Elija un cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                          {areLeadsLoading ? (
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

              <div>
                  <Label>Productos / Servicios</Label>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead className="w-[60%]">Descripción</TableHead>
                              <TableHead>Cantidad</TableHead>
                              <TableHead>Precio Unitario</TableHead>
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
                                          placeholder="Descripción del producto..."
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
                      Agregar Producto
                  </Button>
              </div>

              <div className="flex justify-end">
                  <div className="w-full max-w-sm space-y-4">
                      <div className="flex justify-between items-center">
                          <Label>Flete</Label>
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
