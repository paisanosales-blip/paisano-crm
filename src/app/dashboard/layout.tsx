import Link from 'next/link';
import { Home, GanttChartSquare, Users, FileText } from 'lucide-react';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from '@/components/ui/sidebar';
import { PaisanoLogo } from '@/components/icons';
import { DashboardHeader } from '@/components/dashboard-header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link href="/dashboard" className="flex items-center gap-2">
            <PaisanoLogo className="h-8 w-8 text-primary" />
            <span className="text-xl font-semibold text-white font-headline">Paisano</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Dashboard">
                <Link href="/dashboard">
                  <Home />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Sales Pipeline">
                <Link href="/dashboard/pipeline">
                  <GanttChartSquare />
                  <span>Pipeline</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Clients">
                <Link href="/dashboard/clients">
                  <Users />
                  <span>Clients</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Quotations">
                <Link href="/dashboard/quotations">
                  <FileText />
                  <span>Quotations</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6 bg-muted/30">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
