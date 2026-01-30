'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase'; // Import useUser
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  const router = useRouter();
  const { user, isUserLoading } = useUser(); // Get user state

  useEffect(() => {
    if (!isUserLoading) {
      if (user) {
        router.replace('/dashboard'); // If user, go to dashboard
      } else {
        router.replace('/login'); // If no user, go to login
      }
    }
  }, [user, isUserLoading, router]);

  // Show a loading skeleton while checking auth state
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
    </div>
  );
}
