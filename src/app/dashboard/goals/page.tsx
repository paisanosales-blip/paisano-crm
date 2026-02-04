'use client';

import React from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Target, TrendingUp, Award, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const WEEKLY_GOAL = 10;

export default function GoalsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const opportunitiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'opportunities'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: opportunities, isLoading: areOppsLoading } = useCollection(opportunitiesQuery);

  const isLoading = isUserLoading || areOppsLoading;

  const weeklyProgress = React.useMemo(() => {
    if (!opportunities) {
      return { count: 0, percentage: 0 };
    }
    const today = new Date();
    // Week starts on Monday
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const end = endOfWeek(today, { weekStartsOn: 1 });

    const prospectsThisWeek = opportunities.filter(opp => {
      if (!opp.createdDate) return false;
      const createdDate = new Date(opp.createdDate);
      return isWithinInterval(createdDate, { start, end });
    });

    const count = prospectsThisWeek.length;
    const percentage = Math.min((count / WEEKLY_GOAL) * 100, 100);

    return { count, percentage };
  }, [opportunities]);
  
  const getMotivationalMessage = () => {
    if (weeklyProgress.percentage === 100) {
      return {
        title: '¡Meta Cumplida!',
        message: '¡Felicidades! Has alcanzado tu meta semanal de 10 nuevos prospectos. ¡Sigue así y prepárate para superar nuevos récords!',
        icon: <Award className="h-8 w-8 text-yellow-500" />,
      };
    }
    if (weeklyProgress.count === 0) {
      return {
        title: '¡Empecemos la semana con todo!',
        message: 'Tu meta es generar 10 nuevos prospectos. ¡Cada llamada, cada correo, cada contacto cuenta! Vamos por el primero.',
        icon: <TrendingUp className="h-8 w-8 text-blue-500" />,
      };
    }
    if (weeklyProgress.count < 5) {
      return {
        title: '¡Buen comienzo!',
        message: `Ya tienes ${weeklyProgress.count} prospectos. Estás en el camino correcto. ¡No pierdas el impulso y sigue adelante!`,
        icon: <TrendingUp className="h-8 w-8 text-blue-500" />,
      };
    }
    return {
      title: '¡Ya casi lo logras!',
      message: `¡Excelente trabajo! Con ${weeklyProgress.count} prospectos, estás muy cerca de tu meta. Un último esfuerzo y lo conseguirás.`,
      icon: <Target className="h-8 w-8 text-green-500" />,
    };
  };

  const motivational = getMotivationalMessage();

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-bold">Mis Metas</h1>
        <Button asChild>
          <Link href="/dashboard/pipeline">
            Ir al Flujo de Ventas <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-6 w-6" />
            Meta Semanal: 10 Nuevos Prospectos
          </CardTitle>
          <CardDescription>
            Tu progreso para la semana actual. La semana comienza el lunes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-1/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : (
            <div className="flex items-center gap-6 p-6 rounded-lg bg-muted/50">
              <div className="shrink-0">{motivational.icon}</div>
              <div>
                <h3 className="text-lg font-semibold">{motivational.title}</h3>
                <p className="text-muted-foreground">{motivational.message}</p>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
             <div className="flex justify-between items-center font-bold text-lg">
                <p>Progreso:</p>
                <p>{weeklyProgress.count} / {WEEKLY_GOAL}</p>
            </div>
             <Progress value={weeklyProgress.percentage} className="h-4" />
          </div>
        </CardContent>
      </Card>
      
       <Card>
        <CardHeader>
          <CardTitle>Reportes Mensuales</CardTitle>
          <CardDescription>
            Próximamente: Aquí podrás ver tus resultados mensuales, comparativas y análisis de rendimiento.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground border-2 border-dashed rounded-lg">
            (Sección de Reportes en Construcción)
        </CardContent>
      </Card>
    </div>
  );
}
