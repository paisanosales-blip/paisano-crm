import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clients, users } from "@/lib/data";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export default function ClientsPage() {
    return (
        <div className="grid gap-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-headline font-bold">Clients</h1>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Client
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Client List</CardTitle>
                    <CardDescription>Manage your prospects and clients.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Customer ID</TableHead>
                                <TableHead>Client Name</TableHead>
                                <TableHead>Region</TableHead>
                                <TableHead>Assigned Seller</TableHead>
                                <TableHead>Created At</TableHead>
                                <TableHead><span className="sr-only">Actions</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {clients.map(client => {
                                const seller = users.find(u => u.id === client.sellerId);
                                return (
                                <TableRow key={client.id}>
                                    <TableCell className="font-medium">{client.numeroDeCliente}</TableCell>
                                    <TableCell className="font-semibold">{client.nombreDelCliente}</TableCell>
                                    <TableCell><Badge variant="secondary">{client.region}</Badge></TableCell>
                                    <TableCell>{seller?.name || 'Unassigned'}</TableCell>
                                    <TableCell>{new Date(client.createdAt).toLocaleDateString()}</TableCell>
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
                                                <DropdownMenuItem>View Details</DropdownMenuItem>
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
