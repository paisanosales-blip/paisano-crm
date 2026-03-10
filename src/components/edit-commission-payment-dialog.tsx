'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CommissionPayment, Sale } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';


const paymentSchema = z.object({
  date: z.date({
    required_error: "La fecha es requerida.",
  }),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

export interface EditPaymentPayload {
  date: string;
  notes?: string;
  salesUpdates: {
    saleId: string;
    exchangeRate: number;
  }[];
}

interface EditCommissionPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: EditPaymentPayload) => void;
  payment: (CommissionPayment & { sales: Sale[] }) | null;
  isSubmitting: boolean;
}

export function EditCommissionPaymentDialog({
  open,
  onOpenChange,
  onConfirm,
  payment,
  isSubmitting,
}: EditCommissionPaymentDialogProps) {
  const [salesToUpdate, setSalesToUpdate] = useState<{ saleId: string; exchangeRate: number }[]>([]);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      date: new Date(),
      notes: '',
    },
  });
  
  useEffect(() => {
    if (payment) {
        form.reset({
            date: new Date(payment.date),
            notes: payment.notes || '',
        });
        setSalesToUpdate(payment.sales.map(s => ({ saleId: s.id, exchangeRate: s.exchangeRate || 0 })));
    }
  }, [payment, form]);

  const handleSaleExchangeRateChange = (saleId: string, newRate: number) => {
    setSalesToUpdate(currentSales => 
      currentSales.map(s => 
        s.saleId === saleId ? { ...s, exchangeRate: newRate } : s
      )
    );
  };

  const handleConfirm = (values: PaymentFormValues) => {
    onConfirm({
        date: values.date.toISOString(),
        notes: values.notes,
        salesUpdates: salesToUpdate,
    });
  };
  
  const clientNames = useMemo(() => {
    if (!payment?.sales) return '';
    const names = new Set(payment.sales.map(s => s.clientName));
    return Array.from(names).join(', ');
  }, [payment]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => { if (e.target instanceof HTMLElement && e.target.closest('[data-radix-popper-content-wrapper]')) { e.preventDefault(); } }}>
        <DialogHeader>
          <DialogTitle>Editar Pago de Comisión</DialogTitle>
          <DialogDescription>
            {clientNames && `Pago para: ${clientNames}. `}
            Modifique la fecha, notas o tasas de cambio asociadas a este pago.
          </DialogDescription>
        </DialogHeader>
         <Form {...form}>
            <form onSubmit={form.handleSubmit(handleConfirm)} className="space-y-4 py-4">
                <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <Label>Fecha del Pago</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                {field.value ? (
                                    format(field.value, "PPP", { locale: es })
                                ) : (
                                    <span>Elija una fecha</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                                }
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                        <Label>Notas (Opcional)</Label>
                        <FormControl>
                            <Textarea
                                placeholder="Ej. Pago parcial, ajuste por tipo de cambio, etc."
                                className="resize-none"
                                {...field}
                                value={field.value || ''}
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                {payment && payment.sales.length > 0 && (
                    <div className="space-y-2">
                        <Label>Tasas de Cambio de Ventas (USD)</Label>
                        <div className="space-y-3 rounded-md border p-3 max-h-48 overflow-y-auto">
                            {payment.sales.filter(s => s.currency === 'USD').map((sale) => (
                                <div key={sale.id} className="grid grid-cols-2 items-center gap-2 text-sm">
                                    <span className="truncate col-span-1">{sale.clientName}</span>
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor={`exchangeRate-${sale.id}`} className="text-xs text-muted-foreground">T.C.</Label>
                                        <Input
                                            id={`exchangeRate-${sale.id}`}
                                            type="number"
                                            step="0.0001"
                                            value={salesToUpdate.find(s => s.saleId === sale.id)?.exchangeRate || ''}
                                            onChange={(e) => handleSaleExchangeRateChange(sale.id, Number(e.target.value))}
                                            className="h-8"
                                        />
                                    </div>
                                </div>
                            ))}
                            {payment.sales.filter(s => s.currency === 'USD').length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-2">No hay ventas en USD en este pago.</p>
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
