'use client'
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Shield } from 'lucide-react';
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

export function DashboardHeader() {
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
                  <Shield />
                  Usuarios
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>
      {isSettingsOpen && (
        <ProfileSettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      )}
    </>
  );
}
