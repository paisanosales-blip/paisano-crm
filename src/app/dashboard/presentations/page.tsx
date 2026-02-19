'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { generatePresentationVideo } from '@/ai/flows/generate-presentation-video';
import { Loader2, Video, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function PresentationsPage() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [videoDataUri, setVideoDataUri] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerateClick = async () => {
    if (!prompt.trim()) {
      toast({
        variant: 'destructive',
        title: 'Prompt requerido',
        description: 'Por favor, ingrese un tema para la presentación.',
      });
      return;
    }
    setIsLoading(true);
    setVideoDataUri(null);
    try {
      const result = await generatePresentationVideo(prompt);
      if (result && result.videoDataUri) {
        setVideoDataUri(result.videoDataUri);
        toast({
          title: '¡Video Generado!',
          description: 'Tu presentación en video está lista.',
        });
      } else {
        throw new Error('La respuesta de la IA no incluyó un video.');
      }
    } catch (error) {
      console.error('Error generating presentation video:', error);
      toast({
        variant: 'destructive',
        title: 'Error al generar el video',
        description: 'No se pudo crear la presentación en este momento. Inténtelo de nuevo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-headline font-bold">Generador de Presentaciones</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Crea una Presentación en Video con IA</CardTitle>
          <CardDescription>
            Describe el tema de tu presentación (ej. "resumen de ventas trimestral" o "análisis de oportunidades perdidas") y la IA generará un video corto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="default" className="bg-yellow-100 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200 [&>svg]:text-yellow-600">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-bold">Aviso Importante Sobre Costos y Límites</AlertTitle>
            <AlertDescription>
              La generación de video con IA es una función avanzada que consume recursos de Google Cloud y puede incurrir en costos. Aunque suele haber un nivel de uso gratuito, los límites específicos dependen de tu cuenta y pueden cambiar.
              <br/>
              <strong className="mt-2 block">Para evitar sorpresas, te recomendamos encarecidamente revisar tus cuotas y precios directamente en tu Consola de Google Cloud.</strong>
            </AlertDescription>
          </Alert>
          <div className="grid w-full gap-2">
            <Label htmlFor="prompt">Tema de la Presentación</Label>
            <Textarea
              id="prompt"
              placeholder="Ej: Un video cinematográfico de un resumen de las métricas clave del último mes."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              disabled={isLoading}
            />
          </div>
           <div className="flex justify-center">
             <Button onClick={handleGenerateClick} disabled={isLoading || !prompt.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando Video (esto puede tardar hasta un minuto)...
                  </>
                ) : (
                  'Generar Presentación'
                )}
              </Button>
           </div>
        </CardContent>
        {videoDataUri && (
          <CardFooter className="flex flex-col items-center gap-4">
            <div className="w-full aspect-video rounded-lg overflow-hidden border bg-muted">
                 <video
                    src={videoDataUri}
                    controls
                    className="h-full w-full object-contain"
                    autoPlay
                 >
                    Tu navegador no soporta el tag de video.
                 </video>
            </div>
             <Button asChild variant="outline">
                <a href={videoDataUri} download={`presentacion_${new Date().toISOString()}.mp4`}>
                    Descargar Video
                </a>
            </Button>
          </CardFooter>
        )}
         {isLoading && !videoDataUri && (
            <CardFooter className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-md">
                <Video className="h-12 w-12 text-muted-foreground animate-pulse" />
                <p className="mt-4 text-sm text-muted-foreground">La IA está creando tu video...</p>
            </CardFooter>
         )}
      </Card>
    </div>
  );
}
