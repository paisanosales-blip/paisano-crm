'use client'
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Shield, Bell, CalendarOff, History, Undo2, ThumbsUp } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileSettingsDialog } from '@/components/profile-settings-dialog';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export type Notification = {
  id: string;
  type: 'new_submission' | 'changes_requested' | 'task_approved' | 'overdue_follow_up';
  message: string;
  link: string;
  timestamp: string;
  isRead: boolean;
};

interface DashboardHeaderProps {
  notifications: Notification[];
  onOpenNotifications: () => void;
}

export function DashboardHeader({ notifications, onOpenNotifications }: DashboardHeaderProps) {
  const auth = useAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const handleSignOut = () => {
    auth.signOut();
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName) return '...';
    return `${firstName.charAt(0)}${lastName ? lastName.charAt(0) : ''}`.toUpperCase();
  };

  const isLoading = isAuthLoading || (user && isProfileLoading);
  const displayName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}`.trim() : user?.email;
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const notificationIcons: Record<Notification['type'], React.ReactNode> = {
    new_submission: <History className="h-4 w-4 text-gray-500" />,
    changes_requested: <Undo2 className="h-4 w-4 text-yellow-500" />,
    task_approved: <ThumbsUp className="h-4 w-4 text-green-500" />,
    overdue_follow_up: <CalendarOff className="h-4 w-4 text-red-500" />,
  };

  return (
    <>
      <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6 sticky top-0 z-30">
        <SidebarTrigger />
        <div className="flex-1">
          <form>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar en todo..."
                className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3"
              />
            </div>
          </form>
        </div>
        <div className="flex items-center gap-2">
            <DropdownMenu onOpenChange={(open) => { if (open) onOpenNotifications(); }}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-8 w-8">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 shrink-0 justify-center rounded-full p-0 text-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                )}
                <span className="sr-only">Notificaciones</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length > 0 ? (
                notifications.slice(0, 7).map(notification => ( // Show latest 7
                    <DropdownMenuItem key={notification.id} asChild className="cursor-pointer">
                    <Link href={notification.link} className="flex items-start gap-3">
                        <div className="mt-1">{notificationIcons[notification.type]}</div>
                        <div className="flex-1">
                        <p className={`text-xs text-wrap ${!notification.isRead ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{notification.message}</p>
                        <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true, locale: es })}
                        </p>
                        </div>
                    </Link>
                    </DropdownMenuItem>
                ))
                ) : (
                <DropdownMenuItem disabled>No hay notificaciones nuevas.</DropdownMenuItem>
                )}
            </DropdownMenuContent>
            </DropdownMenu>

            {isLoading ? (
            <div className="flex items-center gap-2">
                <div className="text-right hidden md:block">
                    <Skeleton className="h-4 w-20 mb-1" />
                    <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-9 w-9 rounded-full" />
            </div>
            ) : (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative flex items-center gap-3 h-auto p-1 pr-2 rounded-full">
                        <div className="text-right hidden md:block">
                            <div className="text-sm font-semibold">{displayName}</div>
                            <div className="text-xs text-muted-foreground capitalize">{userProfile?.role}</div>
                        </div>
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={userProfile?.avatarUrl} alt={displayName || ''} />
                            <AvatarFallback>{getInitials(userProfile?.firstName, userProfile?.lastName)}</AvatarFallback>
                        </Avatar>
                        <span className="sr-only">Menú de usuario</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setIsSettingsOpen(true)}>Configuración</DropdownMenuItem>
                <DropdownMenuItem>Soporte</DropdownMenuItem>
                {userProfile?.role?.toLowerCase() === 'manager' && (
                    <DropdownMenuItem onSelect={() => router.push('/dashboard/users')}>
                    <Shield className="mr-2"/>
                    <span>Usuarios</span>
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                    Cerrar sesión
                </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            )}
        </div>
      </header>
      {isSettingsOpen && (
        <ProfileSettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      )}
    </>
  );
}
