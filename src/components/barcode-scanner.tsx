"use client";

import { useState, useEffect, useRef } from "react";
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
          title: "No Camera Found",
          description: "Could not find a camera on this device.",
          variant: "destructive",
        });
        setHasCameraPermission(false);
      }
    },
  });

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        // We don't need to manually set srcObject for useZxing's ref
        stream.getTracks().forEach(track => track.stop()); // Stop the stream as useZxing will manage it.
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
      }
    };

    if (!paused) {
      getCameraPermission();
    }
  }, [paused]);


  return (
    <div>
        <video ref={ref} className="w-full" />
        {hasCameraPermission === false && (
            <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/50">
                <Alert variant="destructive">
                    <AlertTitle>Camera Access Required</AlertTitle>
                    <AlertDescription>
                        Please allow camera access in your browser settings to scan barcodes. You may need to refresh the page.
                    </AlertDescription>
                </Alert>
            </div>
        )}
    </div>
  );
}
