'use client';

import React, { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Calculator, Wallet, Banknote } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Checkbox } from './ui/checkbox';

interface Sale {
    id: string;
    leadId: string;
    clientName: string;
    units: number;
    totalPrice: number;
    currency: string;
    saleDate: string;
    paid: boolean;
}

interface Commission {
    saleId: string;
    commissionPercentage: number;
    commissionAmount: number;
}

interface Payment {
    id: string;
    description: string;
    amount: number;
    date: string;
}

export function CommissionsCalculator() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const leadsQuery = useMemoFirebase(() => collection(firestore, 'leads'), [firestore]);
  const { data: leads, isLoading: areLeadsLoading } = useCollection(leadsQuery);

  const [sales, setSales] = useState<Partial<Sale>[]>([]);
  const [commissions, setCommissions] = useState<Record<string, Commission>>({});
  const [payments, setPayments] = useState<Payment[]>([]);

  const sortedLeads = useMemo(() => {
    if (!leads) return [];
    return [...(leads as any[])].sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [leads]);

  const handleAddSale = () => {
    setSales([...sales, { id: `new-sale-${Date.now()}`, units: 1, totalPrice: 0, currency: 'USD', saleDate: new Date().toISOString(), paid: false }]);
  };

  const handleRemoveSale = (index: number) => {
    const saleIdToRemove = sales[index].id;
    setSales(sales.filter((_, i) => i !== index));
    if (saleIdToRemove) {
      setCommissions(prev => {
        const newCommissions = { ...prev };
        delete newCommissions[saleIdToRemove];
        return newCommissions;
      });
    }
  };

  const handleSaleChange = (index: number, field: keyof Sale, value: any) => {
    const newSales = [...sales];
    const sale = newSales[index];
    if (field === 'leadId') {
        const selectedLead = leads?.find(l => l.id === value);
        newSales[index] = { ...sale, leadId: value, clientName: selectedLead?.clientName };
    } else {
        newSales[index] = { ...sale, [field]: value };
    }
    setSales(newSales);
  };
  
  const handleCommissionChange = (saleId: string, percentage: number) => {
      const sale = sales.find(s => s.id === saleId);
      if (!sale) return;

      const commissionAmount = (sale.totalPrice || 0) * (percentage / 100);
      setCommissions(prev => ({
          ...prev,
          [saleId]: {
              saleId,
              commissionPercentage: percentage,
              commissionAmount,
          }
      }));
  };
  
  const handleAddPayment = () => {
    setPayments([...payments, { id: `payment-${Date.now()}`, description: 'Abono', amount: 0, date: new Date().toISOString() }]);
  };

  const handleRemovePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };
  
  const handlePaymentChange = (index: number, field: keyof Omit<Payment, 'id' | 'date'>, value: any) => {
    const newPayments = [...payments];
    newPayments[index] = { ...newPayments[index], [field]: value };
    setPayments(newPayments);
  };


  const totalCommission = useMemo(() => {
    return sales.reduce((acc, sale) => {
      if (sale.paid && sale.id && commissions[sale.id]) {
        return acc + (commissions[sale.id].commissionAmount || 0);
      }
      return acc;
    }, 0);
  }, [sales, commissions]);
  
  const totalPaid = useMemo(() => {
    return payments.reduce((acc, payment) => acc + (payment.amount || 0), 0);
  }, [payments]);

  const balance = useMemo(() => totalCommission - totalPaid, [totalCommission, totalPaid]);


  return (
    <div className="grid gap-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-headline font-bold">Comisiones de Venta</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                <CardTitle className="text-xs font-medium">Total Comisión (Pagadas)</CardTitle>
                <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
                <div className="text-2xl font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCommission)}</div>
            </CardContent>
        </Card>
         <Card className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                <CardTitle className="text-xs font-medium">Total Pagado</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
                <div className="text-2xl font-bold text-green-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalPaid)}</div>
            </CardContent>
        </Card>
         <Card className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                <CardTitle className="text-xs font-medium">Saldo Pendiente</CardTitle>
                <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
                <div className="text-2xl font-bold text-red-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(balance)}</div>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registro de Ventas</CardTitle>
          <CardDescription>
            Añada las ventas manualmente para calcular las comisiones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[25%]">Cliente</TableHead>
                <TableHead>Fecha Venta</TableHead>
                <TableHead>Unidades</TableHead>
                <TableHead>Precio Total</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Pagado</TableHead>
                <TableHead>% Comisión</TableHead>
                <TableHead>Monto Comisión</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale, index) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <Select
                      value={sale.leadId}
                      onValueChange={(value) => handleSaleChange(index, 'leadId', value)}
                      disabled={areLeadsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedLeads?.map((lead: any) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.clientName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {sale.saleDate ? format(new Date(sale.saleDate), "dd MMM, yyyy", { locale: es }) : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={sale.units}
                      onChange={(e) => handleSaleChange(index, 'units', Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={sale.totalPrice}
                      onChange={(e) => handleSaleChange(index, 'totalPrice', Number(e.target.value))}
                    />
                  </TableCell>
                   <TableCell>
                    <Select
                      value={sale.currency}
                      onValueChange={(value) => handleSaleChange(index, 'currency', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="MXN">MXN</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                      <div className="flex justify-center">
                        <Checkbox
                            checked={sale.paid}
                            onCheckedChange={(checked) => handleSaleChange(index, 'paid', !!checked)}
                        />
                      </div>
                  </TableCell>
                  <TableCell>
                    <Input
                        type="number"
                        placeholder="%"
                        value={commissions[sale.id!]?.commissionPercentage || ''}
                        onChange={(e) => handleCommissionChange(sale.id!, Number(e.target.value))}
                    />
                  </TableCell>
                   <TableCell className="font-semibold">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: sale.currency || 'USD' }).format(commissions[sale.id!]?.commissionAmount || 0)}
                   </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveSale(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button onClick={handleAddSale} variant="outline" className="mt-4">
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Venta
          </Button>
        </CardContent>
      </Card>
      
       <Card>
        <CardHeader>
          <CardTitle>Registro de Pagos de Comisiones</CardTitle>
          <CardDescription>
            Añada los abonos o pagos realizados a las comisiones.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Descripción</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment, index) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <Input
                      placeholder="Ej: Abono de comisiones"
                      value={payment.description}
                      onChange={(e) => handlePaymentChange(index, 'description', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    {format(new Date(payment.date), "dd MMM, yyyy", { locale: es })}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={payment.amount}
                      onChange={(e) => handlePaymentChange(index, 'amount', Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleRemovePayment(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button onClick={handleAddPayment} variant="outline" className="mt-4">
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Pago
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
