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
import { PlusCircle, Trash2, Calculator } from 'lucide-react';

interface Sale {
    id: string;
    leadId: string;
    clientName: string;
    units: number;
    totalPrice: number;
    currency: string;
    saleDate: string;
}

interface Commission {
    saleId: string;
    commissionPercentage: number;
    commissionAmount: number;
}

export function CommissionsCalculator() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const leadsQuery = useMemoFirebase(() => collection(firestore, 'leads'), [firestore]);
  const { data: leads, isLoading: areLeadsLoading } = useCollection(leadsQuery);

  const [sales, setSales] = useState<Partial<Sale>[]>([]);
  const [commissions, setCommissions] = useState<Record<string, Commission>>({});

  const handleAddSale = () => {
    setSales([...sales, { id: `new-${Date.now()}`, units: 1, totalPrice: 0, currency: 'USD' }]);
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

  const totalCommission = useMemo(() => {
    return Object.values(commissions).reduce((acc, comm) => acc + (comm.commissionAmount || 0), 0);
  }, [commissions]);


  return (
    <div className="grid gap-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-headline font-bold">Comisiones de Venta</h1>
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
                <TableHead className="w-[30%]">Cliente</TableHead>
                <TableHead>Unidades</TableHead>
                <TableHead>Precio Total</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Comisión (%)</TableHead>
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
                        {leads?.map((lead: any) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.clientName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
            <CardTitle className="flex items-center gap-2">
                <Calculator className="h-6 w-6" />
                Total de Comisiones
            </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-3xl font-bold">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCommission)}
            </p>
             <p className="text-sm text-muted-foreground">
                Suma de todas las comisiones calculadas.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
