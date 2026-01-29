import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Activity, DollarSign, Users, TrendingUp } from 'lucide-react';
import { opportunities, activities, clients } from '@/lib/data';
import { DashboardCharts } from '@/components/dashboard-charts';

export default function DashboardPage() {
    const totalRevenue = opportunities.filter(o => o.stage === 'Closed Won').reduce((sum, o) => sum + o.value, 0);
    const activeOpportunities = opportunities.filter(o => !['Closed Won', 'Closed Lost'].includes(o.stage)).length;
    const conversionRate = (opportunities.filter(o => o.stage === 'Closed Won').length / opportunities.length * 100).toFixed(0);

    return (
        <div className="grid gap-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">+20.1% from last month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Opportunities</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeOpportunities}</div>
                        <p className="text-xs text-muted-foreground">{opportunities.length} total</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">New Clients</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{clients.length}</div>
                        <p className="text-xs text-muted-foreground">This quarter</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{conversionRate}%</div>
                        <p className="text-xs text-muted-foreground">+5% from last month</p>
                    </CardContent>
                </Card>
            </div>

            <DashboardCharts />

            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>A log of the latest interactions and notes.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Client</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead className="text-right">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activities.slice(0, 4).map((activity) => {
                                const client = clients.find(c => c.id === activity.entityId);
                                return (
                                    <TableRow key={activity.id}>
                                        <TableCell className="font-medium">{client?.nombreDelCliente || 'N/A'}</TableCell>
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
