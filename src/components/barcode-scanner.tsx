"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Result } from "@zxing/library";
import { useZxing } from "react-zxing";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

type BarcodeScannerProps = {
  onScan: (result: string) => void;
  paused?: boolean;
};

export default function BarcodeScanner({
  onScan,
  paused = false,
}: BarcodeScannerProps) {
  const { toast } = useToast();
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>(undefined);
  
  const hints = new Map();
  const formats = [BarcodeFormat.CODE_128];
  hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
  
  const { ref } = useZxing({
    paused: paused || !hasCameraPermission,
    hints,
    onDecodeResult(result: Result) {
      navigator.vibrate?.(100);
      onScan(result.getText());
    },
    onDecodeError(error: Error) {
      console.error(error);
      if (error.name === "NotAllowedError") {
        setHasCameraPermission(false);
      } else if (error.name === "NotFoundError") {
        toast({
          title: "Nenhuma Câmera Encontrada",
          description: "Não foi possível encontrar uma câmera neste dispositivo.",
          variant: "destructive",
        });
        setHasCameraPermission(false);
      }
    },
  });

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        // Request permission and get stream
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        // Important: Stop the stream immediately after getting permission.
        // useZxing will manage its own stream.
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.error('Erro ao acessar a câmera:', error);
        setHasCameraPermission(false);
      }
    };

    getCameraPermission();
  }, []); // Empty dependency array means this runs only once on mount


  return (
    <div>
        <video ref={ref} className="w-full" />
        {hasCameraPermission === false && (
            <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/50">
                <Alert variant="destructive">
                    <AlertTitle>Acesso à Câmera Necessário</AlertTitle>
                    <AlertDescription>
                        Por favor, permita o acesso à câmera nas configurações do seu navegador para digitalizar códigos de barras. Pode ser necessário atualizar a página.
                    </AlertDescription>
                </Alert>
            </div>
        )}
    </div>
  );
}
