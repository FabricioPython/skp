"use client";

import { useState, useCallback } from "react";
import { Camera, RefreshCcw, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import BarcodeScanner from "@/components/barcode-scanner";
import { Separator } from "@/components/ui/separator";

type ScanTarget = "initial" | "final";

export default function Home() {
  const [initialCode, setInitialCode] = useState<string | null>(null);
  const [finalCode, setFinalCode] = useState<string | null>(null);
  const [scanningFor, setScanningFor] = useState<ScanTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<bigint | null>(null);

  const handleScan = (result: string) => {
    setError(null);
    const sanitizedResult = result.replace(/[\D\t]/g, '');

    if (scanningFor === "initial") {
      setInitialCode(sanitizedResult);
      // Reset final code and count if initial is re-scanned
      setFinalCode(null);
      setCount(null);
    } else if (scanningFor === "final") {
      setFinalCode(sanitizedResult);
      setCount(null);
    }
    setScanningFor(null);
  };
  
  const handleCount = () => {
    if (initialCode && finalCode) {
      try {
        const initialNum = BigInt(initialCode);
        const finalNum = BigInt(finalCode);

        if (finalNum <= initialNum) {
          setError("Final sequence must be greater than the initial sequence.");
          setCount(null);
          return;
        }
        
        setError(null);
        setCount(finalNum - initialNum + 1n);
      } catch (e) {
        setError("Barcodes must contain numbers to calculate the count.");
        setCount(null);
      }
    }
  };

  const resetAll = useCallback(() => {
    setInitialCode(null);
    setFinalCode(null);
    setError(null);
    setCount(null);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-4xl font-bold font-headline text-primary">
            Stock Counter
          </h1>
          <p className="text-muted-foreground mt-2">
            Scan barcodes to count stock items quickly.
          </p>
        </header>

        <Card className="shadow-md bg-white">
          <CardHeader>
            <CardTitle>Barcode Scanning</CardTitle>
            <CardDescription>
              Scan the first and last item's barcode to calculate the total.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Initial Barcode
              </h3>
              <div className="flex items-center justify-center h-20 bg-muted rounded-md px-2">
                <p className="text-xl font-mono tracking-wide text-foreground break-all text-center">
                  {initialCode || "----------"}
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Final Barcode
              </h3>
              <div className="flex items-center justify-center h-20 bg-muted rounded-md px-2">
                <p className="text-xl font-mono tracking-wide text-foreground break-all text-center">
                  {finalCode || "----------"}
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button className="w-full" onClick={() => setScanningFor("initial")}>
              <Camera className="mr-2 h-4 w-4" /> Scan Initial
            </Button>
            <Button
              className="w-full"
              onClick={() => setScanningFor("final")}
              disabled={!initialCode}
            >
              <Camera className="mr-2 h-4 w-4" /> Scan Final
            </Button>
          </CardFooter>
        </Card>
        
        <div className="flex flex-col gap-4">
            <Button
              size="lg"
              onClick={handleCount}
              disabled={!initialCode || !finalCode}
            >
              <Calculator className="mr-2 h-4 w-4" /> Contar
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {count !== null && count > 0 && (
              <Card className="bg-accent text-accent-foreground shadow-xl transition-all duration-300">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">Total Items</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-7xl font-bold">{count.toString()}</p>
                </CardContent>
              </Card>
            )}
            
            {(initialCode || finalCode) && (
              <div className="text-center">
                <Button variant="outline" onClick={resetAll}>
                  <RefreshCcw className="mr-2 h-4 w-4" /> Reset
                </Button>
              </div>
            )}
        </div>
      </div>

      <Dialog open={!!scanningFor} onOpenChange={(open) => !open && setScanningFor(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Scan {scanningFor === 'initial' ? 'Initial' : 'Final'} Barcode</DialogTitle>
          </DialogHeader>
          <div className="relative -mx-6 -mb-6 bg-black rounded-b-lg overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="w-[90%] h-px bg-red-500/80 animate-pulse"></div>
            </div>
            <BarcodeScanner onScan={handleScan} paused={!scanningFor} />
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
