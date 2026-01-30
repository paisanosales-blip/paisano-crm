'use client';

import React, { useState, useEffect } from 'react';
import { PaisanoLogo } from '@/components/icons';
import { Truck, Ship, Cog } from 'lucide-react';
import { Button } from '@/components/ui/button';

const icons: { name: string; component: React.FC<any> }[] = [
  { name: 'PaisanoLogo', component: PaisanoLogo },
  { name: 'Truck', component: Truck },
  { name: 'Ship', component: Ship },
  { name: 'Cog', component: Cog },
];

export function IconSwitcher({ className }: { className?: string }) {
  const [currentIconIndex, setCurrentIconIndex] = useState(0);

  useEffect(() => {
    const savedIconIndex = localStorage.getItem('sidebarIconIndex');
    if (savedIconIndex !== null) {
      setCurrentIconIndex(Number(savedIconIndex));
    }
  }, []);

  const handleIconChange = () => {
    const nextIndex = (currentIconIndex + 1) % icons.length;
    setCurrentIconIndex(nextIndex);
    localStorage.setItem('sidebarIconIndex', String(nextIndex));
  };

  const IconComponent = icons[currentIconIndex].component;

  return (
    <Button
      variant="ghost"
      className="p-0 h-auto w-auto hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
      onClick={handleIconChange}
      title="Cambiar icono"
    >
      <IconComponent className={className} />
    </Button>
  );
}
