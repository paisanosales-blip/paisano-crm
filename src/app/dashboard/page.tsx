import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Activity, DollarSign, Users, TrendingUp } from 'lucide-react';
import { opportunities, activities, clients } from '@/lib/data';
import { DashboardCharts } from '@/components/dashboard-charts';

export default function DashboardPage() {
    const totalRevenue = opportunities.filter(o => o.stage === 'Ganada').reduce((sum, o) => sum + o.value, 0);
    const activeOpportunities = opportunities.filter(o => !['Ganada', 'Perdida'].includes(o.stage)).length;
    const conversionRate = (opportunities.filter(o => o.stage === 'Ganada').length / opportunities.length * 100).toFixed(0);

    return (
        <div className="grid gap-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">+20.1% desde el mes pasado</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Oportunidades Activas</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeOpportunities}</div>
                        <p className="text-xs text-muted-foreground">{opportunities.length} en total</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Nuevos Clientes</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{clients.length}</div>
                        <p className="text-xs text-muted-foreground">Este trimestre</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{conversionRate}%</div>
                        <p className="text-xs text-muted-foreground">+5% desde el mes pasado</p>
                    </CardContent>
                </Card>
            </div>

            <DashboardCharts />

            <Card>
                <CardHeader>
                    <CardTitle>Actividad Reciente</CardTitle>
                    <CardDescription>Un registro de las últimas interacciones y notas.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Notas</TableHead>
                                <TableHead className="text-right">Fecha</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activities.slice(0, 4).map((activity) => {
                                const client = clients.find(c => c.id === activity.entityId);
                                return (
                                    <TableRow key={activity.id}>
                                        <TableCell className="font-medium">{client?.nombreDelCliente || 'No disponible'}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{activity.type}</Badge>
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate">{activity.notes}</TableCell>
                                        <TableCell className="text-right">{activity.date}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
