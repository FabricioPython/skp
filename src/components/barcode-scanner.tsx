"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { BrowserMultiFormatReader } from "@zxing/library";
import { Result } from "@zxing/library";
import { useZxing } from "react-zxing";

type BarcodeScannerProps = {
  onScan: (result: string) => void;
  paused?: boolean;
};

export default function BarcodeScanner({
  onScan,
  paused = false,
}: BarcodeScannerProps) {
  const { toast } = useToast();
  
  const { ref } = useZxing({
    paused,
    onDecodeResult(result: Result) {
      navigator.vibrate?.(100);
      onScan(result.getText());
    },
    onDecodeError(error: Error) {
      console.error(error);
      if (error.name === "NotAllowedError") {
        toast({
          title: "Camera Access Denied",
          description:
            "Please allow camera access in your browser settings to scan barcodes.",
          variant: "destructive",
        });
      } else if (error.name === "NotFoundError") {
        toast({
          title: "No Camera Found",
          description: "Could not find a camera on this device.",
          variant: "destructive",
        });
      }
    },
    
  });

  return (
    <video ref={ref} className="w-full" />
  );
}