"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

declare global {
  interface Window {
    BarcodeDetector: new (options?: { formats: string[] }) => any;
  }
}

type BarcodeFormat =
  | 'code_128'
  | 'code_39'
  | 'ean_13'
  | 'ean_8'
  | 'upc_a'
  | 'upc_e'
  | 'qr_code';

type BarcodeScannerProps = {
  onScan: (result: string) => void;
  paused?: boolean;
};

const supportedFormats: BarcodeFormat[] = [
  'code_128',
  'code_39',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'qr_code',
];

export default function BarcodeScanner({
  onScan,
  paused = false,
}: BarcodeScannerProps) {
  const { toast } = useToast();
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>(undefined);
  const [isApiSupported, setIsApiSupported] = useState<boolean | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameId = useRef<number>();

  useEffect(() => {
    let stream: MediaStream;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Erro ao acessar a câmera:", error);
        setHasCameraPermission(false);
         toast({
          title: "Acesso à Câmera Negado",
          description: "Por favor, habilite o acesso à câmera para digitalizar.",
          variant: "destructive",
        });
      }
    };

    getCameraPermission();

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [toast]);

  useEffect(() => {
    if (paused || hasCameraPermission !== true) {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      return;
    }

    if (!('BarcodeDetector' in window)) {
        setIsApiSupported(false);
        return;
    }
    setIsApiSupported(true);

    const barcodeDetector = new window.BarcodeDetector({
      formats: supportedFormats,
    });

    const detectBarcode = async () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        try {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes.length > 0) {
            navigator.vibrate?.(100);
            onScan(barcodes[0].rawValue);
            // Don't request another frame, effectively pausing after a successful scan
            return; 
          }
        } catch (error) {
          console.error("Erro na detecção de código de barras:", error);
        }
      }
      // Continue detecting if no barcode is found
      animationFrameId.current = requestAnimationFrame(detectBarcode);
    };

    detectBarcode();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [paused, hasCameraPermission, onScan]);

  return (
    <div>
      <video ref={videoRef} className="w-full" autoPlay playsInline muted />
      {isApiSupported === false && (
         <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/50">
            <Alert variant="destructive">
                <AlertTitle>Navegador Incompatível</AlertTitle>
                <AlertDescription>
                    Este navegador não suporta a funcionalidade de leitura de código de barras. Tente usar o Chrome ou Safari mais recente.
                </AlertDescription>
            </Alert>
        </div>
      )}
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
