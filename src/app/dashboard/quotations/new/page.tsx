'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, PlusCircle, FileDown } from 'lucide-react';
import { PaisanoLogoFull } from '@/components/paisano-logo-full';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

    const doc = new jsPDF();
    const docWidth = doc.internal.pageSize.getWidth();
    
    // Add Logo
    doc.addImage(PaisanoLogoFull, 'PNG', 15, 15, 60, 20);
    
    // Company Info
    doc.setFontSize(10);
    doc.text('PAISANO TRAILER MANUFACTURING LLC', docWidth - 15, 20, { align: 'right' });
    doc.text('8410 W University, Odessa, TX, 79764', docWidth - 15, 25, { align: 'right' });
    doc.text('Phone: 432-305-1972', docWidth - 15, 30, { align: 'right' });
    doc.text('Email: sales@paisanotrailer.com', docWidth - 15, 35, { align: 'right' });

    // Quotation Title
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('COTIZACIÓN', 15, 50);
    doc.setLineWidth(0.5);
    doc.line(15, 52, docWidth - 15, 52);

    // Client Info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', 15, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedClient.clientName, 15, 67);
    doc.text(`Attn: ${selectedClient.contactPerson}`, 15, 74);
    doc.text(selectedClient.email || '', 15, 81);
    doc.text(selectedClient.phone || '', 15, 88);

    // Quotation Details
    doc.setFont('helvetica', 'bold');
    doc.text('Cotización #:', docWidth - 60, 60);
    doc.text('Fecha:', docWidth - 60, 67);
    doc.setFont('helvetica', 'normal');
    doc.text('12345', docWidth - 15, 60, { align: 'right' });
    doc.text(new Date().toLocaleDateString('es-MX'), docWidth - 15, 67, { align: 'right' });

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

    (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 100,
        theme: 'grid',
        headStyles: { fillColor: [139, 0, 0] },
    });
    
    // Totals
    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Subtotal:', docWidth - 60, finalY + 10);
    doc.text('Flete:', docWidth - 60, finalY + 17);
    doc.text('Total:', docWidth - 60, finalY + 24);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`$${subtotal.toFixed(2)}`, docWidth - 15, finalY + 10, { align: 'right' });
    doc.text(`$${freight.toFixed(2)}`, docWidth - 15, finalY + 17, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`$${total.toFixed(2)}`, docWidth - 15, finalY + 24, { align: 'right' });


    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for(var i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text('Gracias por su preferencia.', 15, doc.internal.pageSize.getHeight() - 10);
        doc.text(`Página ${i} de ${pageCount}`, docWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }

    doc.save(`Cotizacion-${selectedClient.clientName}.pdf`);
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-bold">Nueva Cotización</h1>
        <Button onClick={generatePdf} disabled={!selectedClientId}>
            <FileDown className="mr-2 h-4 w-4" />
            Generar PDF
        </Button>
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
  );
}
