'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { initiateEmailSignUp } from '@/firebase/non-blocking-login';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { PaisanoLogo } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const registerSchema = z.object({
  name: z.string().min(1, { message: 'El nombre es requerido.' }),
  email: z.string().email({ message: 'Correo electrónico inválido.' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading, userError } = useUser();

  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState<RegisterFormValues | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  // Effect to handle user creation and profile setup
  useEffect(() => {
    if (isRegistering && user && formData && firestore) {
      const [firstName, ...lastNameParts] = formData.name.split(' ');
      const lastName = lastNameParts.join(' ');
      
      const userProfile = {
        id: user.uid,
        firebaseUid: user.uid,
        firstName: firstName || '',
        lastName: lastName || '',
        email: user.email,
        phone: '',
        role: 'seller', // Default role for new users
      };

      const userDocRef = doc(firestore, 'users', user.uid);
      setDocumentNonBlocking(userDocRef, userProfile, { merge: true });

      setIsRegistering(false);
      setFormData(null);
      toast({
        title: '¡Cuenta Creada!',
        description: 'Bienvenido a Paisano Sales Hub.',
      });
      router.replace('/dashboard');
    }
  }, [isRegistering, user, formData, firestore, router, toast]);

  // Effect to redirect if already logged in
  useEffect(() => {
    if (!isUserLoading && user && !isRegistering) {
      router.replace('/dashboard');
    }
  }, [user, isUserLoading, router, isRegistering]);

  // Effect to show registration errors
  useEffect(() => {
    if (userError && isRegistering) {
      toast({
        variant: 'destructive',
        title: 'Error de Registro',
        description: 'Este correo electrónico ya está en uso o la contraseña es inválida.',
      });
      setIsRegistering(false);
      setFormData(null);
    }
  }, [userError, isRegistering, toast]);


  function onSubmit(values: RegisterFormValues) {
    setIsRegistering(true);
    setFormData(values);
    initiateEmailSignUp(auth, values.email, values.password);
  }

  if (isUserLoading || (!isUserLoading && user)) {
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

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <PaisanoLogo className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline">Crear una cuenta</CardTitle>
          <CardDescription>Ingrese sus datos para registrarse.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="name">Nombre</Label>
                    <FormControl>
                      <Input id="name" type="text" placeholder="Juan Pérez" required {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="email">Correo electrónico</Label>
                    <FormControl>
                      <Input id="email" type="email" placeholder="m@example.com" required {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="password">Contraseña</Label>
                    <FormControl>
                      <Input id="password" type="password" required {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isRegistering}>
                {isRegistering ? 'Registrando...' : 'Registrarse'}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            ¿Ya tiene una cuenta?{' '}
            <Link href="/login" className="underline">
              Inicia sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
