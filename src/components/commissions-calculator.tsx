'use client';

import React, { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
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
import { PlusCircle, Trash2, Calculator, Wallet, Banknote, Award, Target, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Checkbox } from './ui/checkbox';
import { Skeleton } from './ui/skeleton';


type CommissionType = 'VENTA_PROPIA' | 'VENTA_EXTERNA' | 'VENTA_FINANCIADA';

interface Sale {
    id: string;
    leadId: string;
    clientName: string;
    units: number;
    pricePerUnit: number;
    currency: 'USD' | 'MXN';
    saleDate: string;
    paid: boolean;
    paidDate?: string | null;
    sellerId: string;
    sellerName: string;
    commissionType?: CommissionType;
    commissionAmount?: number;
}

interface Payment {
    id: string;
    sellerId: string;
    description: string;
    amount: number;
    date: string;
    currency: 'USD' | 'MXN';
}

export function CommissionsCalculator() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const leadsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'leads'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  const { data: leads, isLoading: areLeadsLoading } = useCollection(leadsQuery);

  const salesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'sales'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  const { data: sales, isLoading: areSalesLoading } = useCollection<Sale>(salesQuery);
  
  const paymentsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'commissionPayments'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  const { data: payments, isLoading: arePaymentsLoading } = useCollection<Payment>(paymentsQuery);
  
  const isLoading = areLeadsLoading || areSalesLoading || arePaymentsLoading;

  const sortedLeads = useMemo(() => {
    if (!leads) return [];
    return [...(leads as any[])].sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [leads]);
  
  const sortedSales = useMemo(() => {
    if (!sales) return [];
    return [...sales].sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());
  }, [sales]);

  const handleAddSale = () => {
    if (!user) return;
    const newSale: Omit<Sale, 'id'> = {
      leadId: '',
      clientName: '',
      units: 1,
      pricePerUnit: 0,
      currency: 'USD',
      saleDate: new Date().toISOString(),
      paid: false,
      sellerId: user.uid,
      sellerName: user.displayName || 'Vendedor',
    };
    addDocumentNonBlocking(collection(firestore, 'sales'), newSale);
  };

  const handleRemoveSale = (saleId: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'sales', saleId));
  };

  const handleSaleChange = (saleId: string, field: keyof Omit<Sale, 'id' | 'sellerId' | 'sellerName'>, value: any) => {
    const sale = sales?.find(s => s.id === saleId);
    if (!sale) return;

    let updatedValues: Partial<Sale> = {};

    if (field === 'leadId') {
      const selectedLead = leads?.find(l => l.id === value);
      updatedValues = { leadId: value, clientName: selectedLead?.clientName };
    } else if (field === 'paid') {
      updatedValues = { paid: value, paidDate: value ? new Date().toISOString() : null };
    } else {
      updatedValues = { [field]: value };
    }

    const saleRef = doc(firestore, 'sales', saleId);
    updateDocumentNonBlocking(saleRef, updatedValues);

    const newSaleData = { ...sale, ...updatedValues };
    if ((field === 'pricePerUnit' || field === 'units' || field === 'currency') && newSaleData.commissionType) {
      handleCommissionChange(newSaleData, newSaleData.commissionType);
    }
  };

  const handleCommissionChange = (sale: Sale, type: CommissionType) => {
    if (!sale || sale.pricePerUnit === undefined || sale.units === undefined) return;

    const totalValue = sale.pricePerUnit * sale.units;
    let commissionAmount = 0;
    switch (type) {
      case 'VENTA_PROPIA':
        commissionAmount = totalValue * 0.01;
        break;
      case 'VENTA_EXTERNA':
        commissionAmount = totalValue * 0.0025;
        break;
      case 'VENTA_FINANCIADA':
        commissionAmount = totalValue * 0.0025;
        if (sale.currency === 'USD') {
          commissionAmount += 200;
        }
        break;
      default:
        commissionAmount = 0;
    }

    const saleRef = doc(firestore, 'sales', sale.id);
    updateDocumentNonBlocking(saleRef, { commissionType: type, commissionAmount });
  };
  
  const handleAddPayment = () => {
    if (!user) return;
    const newPayment: Omit<Payment, 'id'> = {
      sellerId: user.uid,
      description: 'Abono',
      amount: 0,
      date: new Date().toISOString(),
      currency: 'USD',
    };
    addDocumentNonBlocking(collection(firestore, 'commissionPayments'), newPayment);
  };

  const handleRemovePayment = (paymentId: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'commissionPayments', paymentId));
  };

  const handlePaymentChange = (paymentId: string, field: 'description' | 'amount' | 'currency', value: any) => {
    const numericValue = field === 'amount' ? Number(value) : value;
    updateDocumentNonBlocking(doc(firestore, 'commissionPayments', paymentId), { [field]: numericValue });
  };
  
  const totalCommission = useMemo(() => {
    if (!sales) return { usd: 0, mxn: 0 };
    return sales.reduce((acc, sale) => {
      const amount = sale.commissionAmount || 0;
      if (sale.currency === 'USD') {
        acc.usd += amount;
      } else if (sale.currency === 'MXN') {
        acc.mxn += amount;
      }
      return acc;
    }, { usd: 0, mxn: 0 });
  }, [sales]);
  
  const totalCommissionFromPaidSales = useMemo(() => {
    if (!sales) return { usd: 0, mxn: 0 };
    return sales
      .filter(sale => sale.paid)
      .reduce((acc, sale) => {
        const amount = sale.commissionAmount || 0;
        if (sale.currency === 'USD') {
          acc.usd += amount;
        } else if (sale.currency === 'MXN') {
          acc.mxn += amount;
        }
        return acc;
    }, { usd: 0, mxn: 0 });
  }, [sales]);
  
  const totalPaid = useMemo(() => {
    if (!payments) return { usd: 0, mxn: 0 };
    return payments.reduce((acc, payment) => {
      const amount = payment.amount || 0;
      if (payment.currency === 'USD') {
        acc.usd += amount;
      } else if (payment.currency === 'MXN') {
        acc.mxn += amount;
      }
      return acc;
    }, { usd: 0, mxn: 0 });
  }, [payments]);

  const balance = useMemo(() => {
    return {
      usd: totalCommissionFromPaidSales.usd - totalPaid.usd,
      mxn: totalCommissionFromPaidSales.mxn - totalPaid.mxn,
    };
  }, [totalCommissionFromPaidSales, totalPaid]);

  const commissionStats = useMemo(() => {
    const stats = {
        propia: { usd: { amount: 0, units: 0 }, mxn: { amount: 0, units: 0 } },
        externa: { usd: { amount: 0, units: 0 }, mxn: { amount: 0, units: 0 } },
        financiada: { usd: { amount: 0, units: 0 }, mxn: { amount: 0, units: 0 } },
    };
    if (!sales) return stats;

    return sales.reduce((acc, sale) => {
        const units = sale.units || 0;
        const commissionAmount = sale.commissionAmount || 0;
        const currencyKey = sale.currency === 'USD' ? 'usd' : 'mxn';

        if (sale.commissionType === 'VENTA_PROPIA') {
            acc.propia[currencyKey].amount += commissionAmount;
            acc.propia[currencyKey].units += units;
        } else if (sale.commissionType === 'VENTA_EXTERNA') {
            acc.externa[currencyKey].amount += commissionAmount;
            acc.externa[currencyKey].units += units;
        } else if (sale.commissionType === 'VENTA_FINANCIADA') {
            acc.financiada[currencyKey].amount += commissionAmount;
            acc.financiada[currencyKey].units += units;
        }
        return acc;
    }, stats);
  }, [sales]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-headline font-bold">Comisiones de Venta</h1>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                <CardTitle className="text-xs font-medium">TOTAL DE COMISIONES</CardTitle>
                <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
                <div className="text-2xl font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCommission.usd)}</div>
                <p className="text-sm text-muted-foreground">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalCommission.mxn)}</p>
            </CardContent>
        </Card>
         <Card className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                <CardTitle className="text-xs font-medium">Total Pagado</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
                <div className="text-2xl font-bold text-green-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalPaid.usd)}</div>
                <p className="text-sm text-muted-foreground">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalPaid.mxn)}</p>
            </CardContent>
        </Card>
         <Card className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                <CardTitle className="text-xs font-medium">Saldo Pendiente (de Ventas Pagadas)</CardTitle>
                <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
                <div className="text-2xl font-bold text-red-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(balance.usd)}</div>
                 <p className="text-sm text-muted-foreground">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(balance.mxn)}</p>
            </CardContent>
        </Card>

        <Card className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                <CardTitle className="text-xs font-medium">Comisión Venta Propia</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
                <div className="text-xl font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(commissionStats.propia.usd.amount)}</div>
                <p className="text-xs text-muted-foreground">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(commissionStats.propia.mxn.amount)}</p>
                <p className="text-xs text-muted-foreground mt-1">{commissionStats.propia.usd.units + commissionStats.propia.mxn.units} unidades</p>
            </CardContent>
        </Card>
        <Card className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                <CardTitle className="text-xs font-medium">Comisión Venta Externa</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
                <div className="text-xl font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(commissionStats.externa.usd.amount)}</div>
                <p className="text-xs text-muted-foreground">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(commissionStats.externa.mxn.amount)}</p>
                <p className="text-xs text-muted-foreground mt-1">{commissionStats.externa.usd.units + commissionStats.externa.mxn.units} unidades</p>
            </CardContent>
        </Card>
        <Card className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                <CardTitle className="text-xs font-medium">Comisión Venta Financiada</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
                <div className="text-xl font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(commissionStats.financiada.usd.amount)}</div>
                <p className="text-xs text-muted-foreground">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(commissionStats.financiada.mxn.amount)}</p>
                <p className="text-xs text-muted-foreground mt-1">{commissionStats.financiada.usd.units + commissionStats.financiada.mxn.units} unidades</p>
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
                <TableHead className="w-[20%]">Cliente</TableHead>
                <TableHead>Fecha Registro</TableHead>
                <TableHead>Unidades</TableHead>
                <TableHead>Precio por Unidad</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Pagado</TableHead>
                <TableHead>Fecha Pago</TableHead>
                <TableHead>Tipo Comisión</TableHead>
                <TableHead>Monto Comisión</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({length: 3}).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={10}><Skeleton className="h-10" /></TableCell></TableRow>
                  ))
              ) : sortedSales?.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <Select
                      value={sale.leadId}
                      onValueChange={(value) => handleSaleChange(sale.id, 'leadId', value)}
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
                      onChange={(e) => handleSaleChange(sale.id, 'units', Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={sale.pricePerUnit}
                      onChange={(e) => handleSaleChange(sale.id, 'pricePerUnit', Number(e.target.value))}
                    />
                  </TableCell>
                   <TableCell>
                    <Select
                      value={sale.currency}
                      onValueChange={(value) => handleSaleChange(sale.id, 'currency', value)}
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
                            onCheckedChange={(checked) => handleSaleChange(sale.id, 'paid', !!checked)}
                        />
                      </div>
                  </TableCell>
                  <TableCell>
                    {sale.paid ? (
                      <Input
                        type="date"
                        className="w-[150px]"
                        value={sale.paidDate ? format(new Date(sale.paidDate), 'yyyy-MM-dd') : ''}
                        onChange={(e) => {
                            const newDate = e.target.value ? new Date(e.target.value + 'T00:00:00').toISOString() : null;
                            handleSaleChange(sale.id, 'paidDate', newDate);
                        }}
                      />
                    ) : (
                      'Pendiente'
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                        value={sale.commissionType || ''}
                        onValueChange={(value) => handleCommissionChange(sale, value as CommissionType)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="VENTA_PROPIA">Venta Propia (1%)</SelectItem>
                            <SelectItem value="VENTA_EXTERNA">Venta Externa (0.25%)</SelectItem>
                            <SelectItem value="VENTA_FINANCIADA">Venta Financiada (0.25% + $200)</SelectItem>
                        </SelectContent>
                    </Select>
                  </TableCell>
                   <TableCell className="font-semibold">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: sale.currency || 'USD' }).format(sale.commissionAmount || 0)}
                   </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveSale(sale.id)}>
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
                <TableHead>Moneda</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({length: 1}).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10" /></TableCell></TableRow>
                  ))
              ) : payments?.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <Input
                      placeholder="Ej: Abono de comisiones"
                      value={payment.description}
                      onChange={(e) => handlePaymentChange(payment.id, 'description', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    {format(new Date(payment.date), "dd MMM, yyyy", { locale: es })}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={payment.amount}
                      onChange={(e) => handlePaymentChange(payment.id, 'amount', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={payment.currency}
                      onValueChange={(value) => handlePaymentChange(payment.id, 'currency', value)}
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
                    <Button variant="ghost" size="icon" onClick={() => handleRemovePayment(payment.id)}>
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
