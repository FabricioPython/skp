"use client";

import { useState, useCallback } from "react";
import { Camera, RefreshCcw, Calculator, Save, Archive, Search, FileText } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";

type ScanTarget = "initial" | "final";

export default function Home() {
  const [initialCode, setInitialCode] = useState<string | null>(null);
  const [finalCode, setFinalCode] = useState<string | null>(null);
  const [scanningFor, setScanningFor] = useState<ScanTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<bigint | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [savedCounts, setSavedCounts] = useState<Record<string, bigint>>({});
  
  const [agencyNumber, setAgencyNumber] = useState<string>("");
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [agencyError, setAgencyError] = useState<string | null>(null);
  const [isFetchingAgency, setIsFetchingAgency] = useState(false);
  const [reportDate, setReportDate] = useState<string | null>(null);


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
    setCategory(null);
  }, []);

  const handleSave = () => {
    if (category && count !== null) {
      setSavedCounts(prevCounts => ({
        ...prevCounts,
        [category]: (prevCounts[category] || 0n) + count,
      }));
      // Reset for next count
      resetAll();
    }
  };
  
  const handleFetchAgency = async () => {
    if (!agencyNumber) {
      setAgencyError("Please enter an agency number.");
      return;
    }
    setIsFetchingAgency(true);
    setAgencyError(null);
    setAgencyName(null);
    setReportDate(null);
    try {
      const response = await fetch(`https://gxtlxh2du6.execute-api.us-east-1.amazonaws.com/agencia/${agencyNumber}`);
      if (!response.ok) {
        throw new Error(`Agency not found or API error. Status: ${response.status}`);
      }
      const data = await response.json();
      setAgencyName(data.nome_agencia || "Name not found");
      setReportDate(new Date().toLocaleDateString());
    } catch (e) {
      setAgencyError((e as Error).message || "Failed to fetch agency name. Check your connection or the API endpoint.");
    } finally {
      setIsFetchingAgency(false);
    }
  };

  const grandTotal = Object.values(savedCounts).reduce((acc, current) => acc + current, 0n);

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
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Initial Barcode
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center justify-center h-16 bg-muted rounded-md px-2">
                  <p className="text-lg font-mono tracking-wide text-foreground break-all text-center">
                    {initialCode || "----------"}
                  </p>
                </div>
                <Button variant="outline" size="icon" className="h-16 w-16" onClick={() => setScanningFor("initial")}>
                  <Camera className="h-6 w-6" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Final Barcode
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center justify-center h-16 bg-muted rounded-md px-2">
                  <p className="text-lg font-mono tracking-wide text-foreground break-all text-center">
                    {finalCode || "----------"}
                  </p>
                </div>
                <Button variant="outline" size="icon" className="h-16 w-16" onClick={() => setScanningFor("final")} disabled={!initialCode}>
                  <Camera className="h-6 w-6" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="flex flex-col gap-4">
            <Button
              size="lg"
              onClick={handleCount}
              disabled={!initialCode || !finalCode}
            >
              <Calculator className="mr-2 h-4 w-4" /> Contar
            </Button>
            
            {count !== null && (
              <RadioGroup onValueChange={setCategory} value={category || ""} className="flex justify-center gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="a" id="r1" />
                  <Label htmlFor="r1">Tipo A</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="b" id="r2" />
                  <Label htmlFor="r2">Tipo B</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="c" id="r3" />
                  <Label htmlFor="r3">Tipo C</Label>
                </div>
              </RadioGroup>
            )}

            {category && count !== null && (
              <Button size="lg" onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" /> Salvar
              </Button>
            )}

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

            {Object.keys(savedCounts).length > 0 && (
              <Card className="bg-secondary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Archive className="h-5 w-5" />
                    Category Totals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(savedCounts).map(([cat, total]) => (
                    <div key={cat} className="flex justify-between items-center bg-muted p-2 rounded-md">
                      <span className="font-medium">Tipo {cat.toUpperCase()}</span>
                      <span className="font-bold text-lg">{total.toString()}</span>
                    </div>
                  ))}
                  <Separator className="my-4 bg-border" />
                  <div className="flex justify-between items-center p-2">
                    <span className="font-bold text-lg">Total Geral</span>
                    <span className="font-extrabold text-xl">{grandTotal.toString()}</span>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {Object.keys(savedCounts).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Find Agency</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Enter agency number"
                      value={agencyNumber}
                      onChange={(e) => setAgencyNumber(e.target.value)}
                      disabled={isFetchingAgency}
                    />
                    <Button onClick={handleFetchAgency} disabled={isFetchingAgency || !agencyNumber}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  {isFetchingAgency && <p>Loading...</p>}
                  {agencyError && (
                    <Alert variant="destructive">
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{agencyError}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}
            
            {agencyName && reportDate && (
              <Card className="bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <FileText className="h-6 w-6 text-primary" />
                    Relatório de Contagem
                  </CardTitle>
                  <CardDescription>
                    Resumo da contagem de estoque para a agência.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <p><span className="font-semibold">Agência:</span> {agencyName}</p>
                    <p><span className="font-semibold">Data:</span> {reportDate}</p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Totais por Categoria:</h4>
                    <div className="space-y-2">
                      {Object.entries(savedCounts).map(([cat, total]) => (
                        <div key={cat} className="flex justify-between items-center bg-muted p-2 rounded-md">
                          <span className="font-medium">Tipo {cat.toUpperCase()}</span>
                          <span className="font-bold text-lg">{total.toString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center p-2 rounded-md bg-primary text-primary-foreground">
                    <span className="font-bold text-lg">Total Geral</span>
                    <span className="font-extrabold text-2xl">{grandTotal.toString()}</span>
                  </div>
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

    