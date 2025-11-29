"use client";

import { useState, useMemo, useCallback } from "react";
import { Camera, RefreshCcw } from "lucide-react";
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

type ScanTarget = "initial" | "final";

export default function Home() {
  const [initialCode, setInitialCode] = useState<string | null>(null);
  const [finalCode, setFinalCode] = useState<string | null>(null);
  const [scanningFor, setScanningFor] = useState<ScanTarget | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = (result: string) => {
    setError(null);
    const codeRegex = /^\d{10}$/;
    if (!codeRegex.test(result)) {
      setError("Invalid barcode format. Expected a 10-digit number.");
      setScanningFor(null);
      return;
    }

    if (scanningFor === "initial") {
      setInitialCode(result);
      // Reset final code if initial is re-scanned
      setFinalCode(null);
    } else if (scanningFor === "final") {
      setFinalCode(result);
    }
    setScanningFor(null);
  };

  const resetAll = useCallback(() => {
    setInitialCode(null);
    setFinalCode(null);
    setError(null);
  }, []);
  
  const count = useMemo(() => {
    if (initialCode && finalCode) {
      const initialNum = BigInt(initialCode);
      const finalNum = BigInt(finalCode);

      if (finalNum <= initialNum) {
        setError("Final sequence must be greater than the initial sequence.");
        return null;
      }
      
      setError(null);
      return finalNum - initialNum + 1n;
    }
    return null;
  }, [initialCode, finalCode]);


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

        <div className="space-y-4">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Initial Barcode</CardTitle>
              <CardDescription>Scan the first item's barcode.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-20 bg-muted rounded-md">
                <p className="text-2xl font-mono tracking-widest text-foreground">
                  {initialCode || "----------"}
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={() => setScanningFor("initial")}>
                <Camera className="mr-2 h-4 w-4" /> Scan Initial
              </Button>
            </CardFooter>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Final Barcode</CardTitle>
              <CardDescription>Scan the last item's barcode.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-20 bg-muted rounded-md">
                <p className="text-2xl font-mono tracking-widest text-foreground">
                  {finalCode || "----------"}
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => setScanningFor("final")}
                disabled={!initialCode}
              >
                <Camera className="mr-2 h-4 w-4" /> Scan Final
              </Button>
            </CardFooter>
          </Card>
        </div>

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
