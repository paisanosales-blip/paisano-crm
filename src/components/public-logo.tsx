'use client';

import React from 'react';
import Image from 'next/image';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { PaisanoLogo } from '@/components/icons';
import { cn } from '@/lib/utils';

interface PublicLogoProps {
  className?: string;
}

export function PublicLogo({ className }: PublicLogoProps) {
  const firestore = useFirestore();

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'app');
  }, [firestore]);
  const { data: appSettings, isLoading } = useDoc(settingsRef);

  if (isLoading) {
    return <Skeleton className={cn('rounded-full', className)} />;
  }

  const logoUrl = appSettings?.logoUrl;

  return logoUrl ? (
    <div className={cn("relative", className)}>
        <Image
            src={logoUrl}
            alt="Logo"
            fill
            className="rounded-full object-cover"
        />
    </div>
  ) : (
    <PaisanoLogo className={className} />
  );
}
