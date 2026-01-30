'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Upload } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function IconSwitcher({ className }: { className?: string }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedLogo = localStorage.getItem('sidebarLogo');
    if (savedLogo) {
      setLogoUrl(savedLogo);
    }
    setIsLoading(false);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setLogoUrl(result);
        localStorage.setItem('sidebarLogo', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  if (isLoading) {
    return <Skeleton className={cn('h-8 w-8 rounded-full', className)} />;
  }

  return (
    <div className="relative group/logo-uploader" title="Cambiar logo">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />
      <button 
        onClick={handleUploadClick} 
        className={cn(
          "rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none", 
          "h-8 w-8 flex items-center justify-center",
          className
        )}
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="Logo"
            width={32}
            height={32}
            className="rounded-full object-cover h-8 w-8"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Upload className="h-5 w-5" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/logo-uploader:opacity-100 transition-opacity cursor-pointer">
          <Upload className="h-5 w-5 text-white" />
        </div>
      </button>
    </div>
  );
}
