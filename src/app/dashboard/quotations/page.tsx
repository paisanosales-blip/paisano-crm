import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { quotations, clients } from "@/lib/data";
import { MoreHorizontal, PlusCircle, FileDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export default function QuotationsPage() {
    return (
        <div className="grid gap-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-headline font-bold">Cotizaciones</h1>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nueva Cotización
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Historial de Cotizaciones</CardTitle>
                    <CardDescription>Rastrea y gestiona todas las cotizaciones de clientes.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID de Cotización</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Versión</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>PDF</TableHead>
                                <TableHead><span className="sr-only">Acciones</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quotations.map(quote => {
                                const client = clients.find(c => c.id === quote.clientId);
                                const statusVariant : 'default' | 'secondary' | 'destructive' | 'outline' = {
                                    'Enviada': 'default',
                                    'Aceptada': 'secondary',
                                    'Rechazada': 'destructive',
                                    'Borrador': 'outline',
                                }[quote.status] || 'default';

                                return (
                                <TableRow key={quote.id}>
                                    <TableCell className="font-mono text-xs">{quote.id}</TableCell>
                                    <TableCell className="font-semibold">{client?.nombreDelCliente}</TableCell>
                                    <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency }).format(quote.value)}</TableCell>
                                    <TableCell><Badge variant={statusVariant}>{quote.status}</Badge></TableCell>
                                    <TableCell className="text-center">v{quote.version}</TableCell>
                                    <TableCell>{new Date(quote.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                        <Button variant="outline" size="sm" disabled={!quote.pdfUrl}>
                                            <FileDown className="mr-2 h-3 w-3"/>
                                            Descargar
                                        </Button>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Toggle menu</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                <DropdownMenuItem>Editar</DropdownMenuItem>
                                                <DropdownMenuItem>Crear Nueva Versión</DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
