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
                <h1 className="text-2xl font-headline font-bold">Quotations</h1>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Quotation
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Quotation History</CardTitle>
                    <CardDescription>Track and manage all client quotations.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Quotation ID</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Value</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Version</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>PDF</TableHead>
                                <TableHead><span className="sr-only">Actions</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quotations.map(quote => {
                                const client = clients.find(c => c.id === quote.clientId);
                                const statusVariant : 'default' | 'secondary' | 'destructive' | 'outline' = {
                                    'Sent': 'default',
                                    'Accepted': 'secondary', // Using secondary for success state
                                    'Rejected': 'destructive',
                                    'Draft': 'outline',
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
                                            Download
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
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem>Edit</DropdownMenuItem>
                                                <DropdownMenuItem>Create New Version</DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
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
