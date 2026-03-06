'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { KeyRound } from 'lucide-react';
import { CommissionsCalculator } from '@/components/commissions-calculator';

const ACCESS_CODE = 'PAISANO2026';
const AUTH_KEY = 'commissionsAuthDate';

export default function CommissionsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [code, setCode] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const authDate = localStorage.getItem(AUTH_KEY);
    if (authDate === today) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    if (code === ACCESS_CODE) {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(AUTH_KEY, today);
      setIsAuthenticated(true);
    } else {
      toast({
        variant: 'destructive',
        title: 'Código Incorrecto',
        description: 'El código de acceso es inválido.',
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Acceso a Comisiones</CardTitle>
            <CardDescription>
              Ingrese el código especial para acceder a la sección de comisiones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="relative">
                <KeyRound className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="password"
                    placeholder="Ingrese el código"
                    className="pl-8"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleLogin();
                        }
                    }}
                />
            </div>
            <Button onClick={handleLogin} className="w-full">
              Acceder
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <CommissionsCalculator />;
}
