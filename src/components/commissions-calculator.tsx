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
import { PlusCircle, Trash2, Calculator, Wallet, Banknote, Award, Target, TrendingUp, FileDown, Truck, Droplets, Wind, Package, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Checkbox } from './ui/checkbox';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EditCommissionPaymentDialog, type EditPaymentPayload } from './edit-commission-payment-dialog';


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
    productType?: 'DUMP' | 'TANK WATTER' | 'SAND HOPPER' | 'OTHER';
    exchangeRate?: number;
    commissionStatus?: 'Pendiente' | 'Pagada';
}

interface Payment {
    id: string;
    sellerId: string;
    date: string;
    paidSaleIds: string[];
    totalAmountUSD: number;
    totalAmountMXN: number;
    notes?: string;
}

export function CommissionsCalculator() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [exchangeRate, setExchangeRate] = useState(18.0);
  const [selectedCommissionIds, setSelectedCommissionIds] = useState<Set<string>>(new Set());
  const [paymentToRevert, setPaymentToRevert] = useState<(Payment & {sales: Sale[], calculatedTotalMxn: number}) | null>(null);
  const [isRevertDialogOpen, setIsRevertDialogOpen] = useState(false);
  
  const [paymentToEdit, setPaymentToEdit] = useState<(Payment & {sales: Sale[], calculatedTotalMxn: number}) | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditingPayment, setIsEditingPayment] = useState(false);


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
  
  const pendingCommissions = useMemo(() => {
    if (!sales) return [];
    return sales.filter(s => s.paid && s.commissionStatus !== 'Pagada')
        .sort((a, b) => new Date(b.paidDate || 0).getTime() - new Date(a.paidDate || 0).getTime());
  }, [sales]);

  const paidPaymentsWithSales = useMemo(() => {
    if (!payments || !sales) return [];
    return payments.map(p => {
        const associatedSales = sales.filter(s => (p.paidSaleIds || []).includes(s.id));
        const totalMxnFromUsd = associatedSales
            .filter(s => s.currency === 'USD' && s.exchangeRate)
            .reduce((sum, s) => sum + ((s.commissionAmount || 0) * s.exchangeRate), 0);
        
        return {
            ...p,
            sales: associatedSales,
            calculatedTotalMxn: (p.totalAmountMXN || 0) + totalMxnFromUsd,
        }
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, sales]);

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
      commissionStatus: 'Pendiente',
    };
    addDocumentNonBlocking(collection(firestore, 'sales'), newSale);
  };

  const handleRemoveSale = (saleId: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'sales', saleId));
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

  const handleSaleChange = (saleId: string, field: keyof Omit<Sale, 'id' | 'sellerId' | 'sellerName'>, value: any) => {
    const sale = sales?.find(s => s.id === saleId);
    if (!sale) return;

    let updatedValues: Partial<Sale> = {};

    if (field === 'leadId') {
      const selectedLead = leads?.find(l => l.id === value);
      updatedValues = { leadId: value, clientName: selectedLead?.clientName };
    } else if (field === 'paid') {
      updatedValues = { paid: value, paidDate: value ? new Date().toISOString() : null };
      if (!value) {
        // If un-paid, reset commission status
        updatedValues.commissionStatus = 'Pendiente';
      }
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

  const handlePaySelectedCommissions = () => {
    if (selectedCommissionIds.size === 0) {
        toast({ title: 'Ninguna comisión seleccionada', variant: 'destructive' });
        return;
    }
    if (!user) return;

    const commissionsToPay = pendingCommissions.filter(c => selectedCommissionIds.has(c.id));
    const totals = commissionsToPay.reduce((acc, sale) => {
        const amount = sale.commissionAmount || 0;
        if (sale.currency === 'USD') acc.usd += amount;
        else if (sale.currency === 'MXN') acc.mxn += amount;
        return acc;
    }, { usd: 0, mxn: 0 });

    const newPayment = {
        sellerId: user.uid,
        date: new Date().toISOString(),
        paidSaleIds: Array.from(selectedCommissionIds),
        totalAmountUSD: totals.usd,
        totalAmountMXN: totals.mxn,
    };

    addDocumentNonBlocking(collection(firestore, 'commissionPayments'), newPayment);
    
    commissionsToPay.forEach(sale => {
        updateDocumentNonBlocking(doc(firestore, 'sales', sale.id), { commissionStatus: 'Pagada' });
    });

    toast({ title: 'Pago Registrado', description: `Se ha registrado el pago de ${selectedCommissionIds.size} comisiones.` });
    setSelectedCommissionIds(new Set());
  };

  const handleSelectCommission = (saleId: string, checked: boolean) => {
    setSelectedCommissionIds(prev => {
        const newSet = new Set(prev);
        if (checked) newSet.add(saleId);
        else newSet.delete(saleId);
        return newSet;
    });
  };

  const handleRevertPaymentClick = (payment: Payment & {sales: Sale[], calculatedTotalMxn: number}) => {
    setPaymentToRevert(payment);
    setIsRevertDialogOpen(true);
  };
  
  const handleRevertPaymentConfirm = () => {
    if (!paymentToRevert || !firestore) return;

    if (paymentToRevert.paidSaleIds && Array.isArray(paymentToRevert.paidSaleIds)) {
      paymentToRevert.paidSaleIds.forEach(saleId => {
          const saleRef = doc(firestore, 'sales', saleId);
          updateDocumentNonBlocking(saleRef, { commissionStatus: 'Pendiente' });
      });
    }

    const paymentRef = doc(firestore, 'commissionPayments', paymentToRevert.id);
    deleteDocumentNonBlocking(paymentRef);

    toast({
        title: 'Pago Revertido',
        description: 'Las comisiones asociadas están pendientes de nuevo.',
    });

    setIsRevertDialogOpen(false);
    setPaymentToRevert(null);
  };
  
  const handleEditPaymentClick = (payment: Payment & {sales: Sale[], calculatedTotalMxn: number}) => {
    setPaymentToEdit(payment);
    setIsEditDialogOpen(true);
  };

  const handleEditPaymentConfirm = (payload: EditPaymentPayload) => {
    if (!paymentToEdit || !firestore) return;
    
    setIsEditingPayment(true);
    const paymentRef = doc(firestore, 'commissionPayments', paymentToEdit.id);
    const { salesUpdates, ...paymentUpdates } = payload;
    
    // Update the payment document
    updateDocumentNonBlocking(paymentRef, paymentUpdates);

    // Update each sale document
    if (salesUpdates) {
      salesUpdates.forEach(update => {
        const saleRef = doc(firestore, 'sales', update.saleId);
        updateDocumentNonBlocking(saleRef, { exchangeRate: update.exchangeRate });
      });
    }
    
    toast({ title: 'Pago Actualizado', description: 'Los detalles del pago y tasas de cambio han sido guardados.' });
    setIsEditDialogOpen(false);
    setIsEditingPayment(false);
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
  
  const totalPaid = useMemo(() => {
    if (!paidPaymentsWithSales) return { usd: 0, mxn: 0 };
    
    return paidPaymentsWithSales.reduce((acc, payment) => {
      acc.usd += payment.totalAmountUSD || 0;
      acc.mxn += payment.calculatedTotalMxn || 0;
      return acc;
    }, { usd: 0, mxn: 0 });

  }, [paidPaymentsWithSales]);

  const balance = useMemo(() => {
    const pendingTotal = pendingCommissions.reduce((acc, sale) => {
        const amount = sale.commissionAmount || 0;
        if (sale.currency === 'USD') acc.usd += amount;
        else if (sale.currency === 'MXN') acc.mxn += amount;
        return acc;
    }, { usd: 0, mxn: 0 });
    return pendingTotal;
  }, [pendingCommissions]);

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

  const productStats = useMemo(() => {
    const stats = {
      DUMP: 0,
      'TANK WATTER': 0,
      'SAND HOPPER': 0,
      'SAND HOPPER externas': 0,
    };
    if (!sales) return stats;

    return sales.reduce((acc, sale) => {
      const units = sale.units || 0;
      switch (sale.productType) {
        case 'DUMP':
          acc.DUMP += units;
          break;
        case 'TANK WATTER':
          acc['TANK WATTER'] += units;
          break;
        case 'SAND HOPPER':
          if (sale.commissionType === 'VENTA_PROPIA' || sale.commissionType === 'VENTA_FINANCIADA') {
            acc['SAND HOPPER'] += units;
          } else if (sale.commissionType === 'VENTA_EXTERNA') {
            acc['SAND HOPPER externas'] += units;
          }
          break;
        default:
          break;
      }
      return acc;
    }, stats);
  }, [sales]);


  const handleDownloadReport = () => {
    // This function can be adapted to the new data model
    toast({ title: 'Función en desarrollo' });
  };

  return (
    <>
    <div className="grid gap-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-headline font-bold">Comisiones de Venta</h1>
         <Button onClick={handleDownloadReport} variant="outline" disabled={isLoading}>
          <FileDown className="mr-2 h-4 w-4" />
          Descargar Reporte
        </Button>
      </div>

       <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                <CardTitle className="text-xs font-medium">COMISIONES PENDIENTES POR PAGAR</CardTitle>
                <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
                <div className="space-y-1">
                    <div className="text-2xl font-bold text-red-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(balance.usd)} <span className="text-base font-medium text-muted-foreground">USD</span></div>
                    {balance.usd > 0 && <div className="text-sm text-muted-foreground">~ {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(balance.usd * exchangeRate)} MXN Aprox.</div>}
                    <div className="text-lg font-semibold text-muted-foreground">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(balance.mxn)} <span className="text-sm font-medium">MXN</span></div>
                </div>
            </CardContent>
        </Card>
        <Card className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                <CardTitle className="text-xs font-medium">TOTAL DE COMISIONES PAGADAS</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
                <div className="space-y-1">
                    <div className="text-2xl font-bold text-green-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalPaid.usd)} <span className="text-base font-medium text-muted-foreground">USD</span></div>
                    <div className="text-lg font-semibold text-muted-foreground">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalPaid.mxn)} <span className="text-sm font-medium">MXN</span></div>
                </div>
            </CardContent>
        </Card>
        <Card className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                <CardTitle className="text-xs font-medium">TOTAL COMISIONES GENERADAS</CardTitle>
                <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
                 <div className="space-y-1">
                    <div className="text-2xl font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCommission.usd)} <span className="text-base font-medium text-muted-foreground">USD</span></div>
                    {totalCommission.usd > 0 && <div className="text-sm text-muted-foreground">~ {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalCommission.usd * exchangeRate)} MXN Aprox.</div>}
                    <div className="text-lg font-semibold text-muted-foreground">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalCommission.mxn)} <span className="text-sm font-medium">MXN</span></div>
                </div>
            </CardContent>
        </Card>
      </div>
      
       <Card>
        <CardHeader>
          <CardTitle>Registro de Ventas General</CardTitle>
          <CardDescription>
            Añada o edite las ventas manualmente para calcular las comisiones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[20%]">Cliente</TableHead>
                <TableHead>Fecha Registro</TableHead>
                <TableHead>Pagado</TableHead>
                <TableHead>Tipo Comisión</TableHead>
                <TableHead>Monto Comisión</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({length: 3}).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-10" /></TableCell></TableRow>
                  ))
              ) : sortedSales?.map((sale) => (
                <TableRow
                  key={sale.id}
                  className={cn(sale.commissionStatus === 'Pagada' ? 'bg-blue-50 dark:bg-blue-950/40' : sale.paid ? 'bg-green-50 dark:bg-green-950/40' : '')}
                >
                  <TableCell>
                    <Select
                      value={sale.leadId}
                      onValueChange={(value) => handleSaleChange(sale.id, 'leadId', value)}
                      disabled={areLeadsLoading}
                    >
                      <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>{sortedLeads?.map((lead: any) => (<SelectItem key={lead.id} value={lead.id}>{lead.clientName}</SelectItem>))}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{sale.saleDate ? format(new Date(sale.saleDate), "dd MMM, yyyy", { locale: es }) : 'N/A'}</TableCell>
                  <TableCell>
                      <div className="flex justify-center">
                        <Checkbox checked={sale.paid} onCheckedChange={(checked) => handleSaleChange(sale.id, 'paid', !!checked)} />
                      </div>
                  </TableCell>
                  <TableCell>
                    <Select value={sale.commissionType || ''} onValueChange={(value) => handleCommissionChange(sale, value as CommissionType)}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="VENTA_PROPIA">Venta Propia (1%)</SelectItem>
                            <SelectItem value="VENTA_EXTERNA">Venta Externa (0.25%)</SelectItem>
                            <SelectItem value="VENTA_FINANCIADA">Venta Financiada (0.25% + $200)</SelectItem>
                        </SelectContent>
                    </Select>
                  </TableCell>
                   <TableCell className="font-semibold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: sale.currency || 'USD' }).format(sale.commissionAmount || 0)}</TableCell>
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
          <CardTitle>Comisiones Pendientes de Pago</CardTitle>
          <CardDescription>
            Seleccione las comisiones de ventas ya pagadas por el cliente para registrarlas como pagadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-12"><span className="sr-only">Select</span></TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Monto Comisión</TableHead>
                        <TableHead>Comisión (MXN Aprox)</TableHead>
                        <TableHead>Fecha Pago Cliente</TableHead>
                        <TableHead>Tipo Cambio</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        Array.from({length: 3}).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-10" /></TableCell></TableRow>
                        ))
                    ) : pendingCommissions.length > 0 ? (
                        pendingCommissions.map((sale) => (
                            <TableRow key={sale.id} className="bg-amber-50 dark:bg-amber-950/40">
                                <TableCell>
                                    <Checkbox
                                        checked={selectedCommissionIds.has(sale.id)}
                                        onCheckedChange={(checked) => handleSelectCommission(sale.id, !!checked)}
                                    />
                                </TableCell>
                                <TableCell className="font-semibold">{sale.clientName}</TableCell>
                                <TableCell className="font-semibold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: sale.currency }).format(sale.commissionAmount || 0)}</TableCell>
                                <TableCell>
                                    {sale.currency === 'USD' && sale.exchangeRate && sale.commissionAmount ? (
                                        <div className="font-semibold text-muted-foreground">
                                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(sale.commissionAmount * sale.exchangeRate)}
                                        </div>
                                    ) : 'N/A'}
                                </TableCell>
                                <TableCell>{sale.paidDate ? format(new Date(sale.paidDate), 'dd MMM, yyyy', { locale: es }) : 'N/A'}</TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        step="0.0001"
                                        className="w-24"
                                        value={sale.exchangeRate || ''}
                                        onChange={(e) => handleSaleChange(sale.id, 'exchangeRate', Number(e.target.value))}
                                        placeholder="18.0000"
                                    />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow><TableCell colSpan={6} className="text-center h-24">No hay comisiones pendientes.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
            <Button onClick={handlePaySelectedCommissions} className="mt-4" disabled={selectedCommissionIds.size === 0}>
                Registrar Pago de Seleccionadas ({selectedCommissionIds.size})
            </Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Historial de Pagos de Comisiones</CardTitle>
          <CardDescription>
            Lista de todos los pagos de comisiones que se han registrado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {isLoading ? (
              <Skeleton className="h-20" />
            ) : paidPaymentsWithSales.length > 0 ? (
              paidPaymentsWithSales.map((payment) => (
                <AccordionItem value={payment.id} key={payment.id}>
                  <div className="flex items-center hover:bg-muted/50 rounded-t-md">
                    <AccordionTrigger className="flex-1 text-left p-4 hover:no-underline">
                      <div className="flex justify-between items-center w-full">
                          <div className="text-left">
                              <p className="font-semibold">Pago del {format(new Date(payment.date), "dd MMM, yyyy", { locale: es })}</p>
                              <p className="text-sm text-muted-foreground">{payment.sales.length} comision(es) pagada(s)</p>
                              {payment.notes && <p className="text-xs text-muted-foreground italic mt-1">Nota: "{payment.notes}"</p>}
                          </div>
                          <div className="text-right">
                            {payment.totalAmountUSD > 0 && <p className="font-bold text-green-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(payment.totalAmountUSD)}</p>}
                            <p className="font-semibold text-gray-500">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(payment.calculatedTotalMxn)}</p>
                          </div>
                      </div>
                    </AccordionTrigger>
                    <div className="flex items-center gap-1 px-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditPaymentClick(payment)}
                        >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Editar Pago</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => handleRevertPaymentClick(payment)}
                        >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Revertir Pago</span>
                        </Button>
                    </div>
                  </div>
                  <AccordionContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Monto Comisión</TableHead><TableHead>Fecha Venta</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {payment.sales.map(sale => (
                                <TableRow key={sale.id}>
                                    <TableCell>{sale.clientName}</TableCell>
                                    <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: sale.currency }).format(sale.commissionAmount || 0)}</TableCell>
                                    <TableCell>{format(new Date(sale.saleDate), 'dd/MM/yyyy')}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">No se han registrado pagos.</div>
            )}
          </Accordion>
        </CardContent>
      </Card>

    </div>
    <AlertDialog open={isRevertDialogOpen} onOpenChange={setIsRevertDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Revertir este pago?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción eliminará el registro de pago y marcará las comisiones asociadas como "Pendientes" de nuevo. Esta acción no se puede deshacer.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleRevertPaymentConfirm} variant="destructive">
                    Sí, Revertir Pago
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
     <EditCommissionPaymentDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onConfirm={handleEditPaymentConfirm}
        payment={paymentToEdit}
        isSubmitting={isEditingPayment}
    />
    </>
  );
}

