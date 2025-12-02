"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Camera, RefreshCcw, Calculator, Save, Archive, Search, FileText, Share2 } from "lucide-react";
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
import { agencies } from "@/lib/agencies";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";

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

  const reportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (agencyName) {
      setReportDate(new Date().toLocaleDateString());
    }
  }, [agencyName]);


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
    
    // Simulate a short delay for user experience
    await new Promise(resolve => setTimeout(resolve, 300));

    const agency = agencies.find(a => a.id === parseInt(agencyNumber, 10));

    if (agency) {
      setAgencyName(agency.name);
    } else {
      setAgencyError("Agency not found. Please check the number.");
    }
    
    setIsFetchingAgency(false);
  };

  const handleShare = async () => {
    if (!reportRef.current) {
      toast({
        title: "Error",
        description: "Could not capture report.",
        variant: "destructive",
      });
      return;
    }

    try {
      const canvas = await html2canvas(reportRef.current, {
        useCORS: true,
        backgroundColor: null,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast({
            title: "Error",
            description: "Failed to create image from report.",
            variant: "destructive",
          });
          return;
        }

        const file = new File([blob], "stock-report.png", { type: "image/png" });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Stock Count Report',
            text: `Here is the stock count report for ${agencyName} on ${reportDate}.`,
          });
        } else {
          // Fallback for desktop or browsers that don't support sharing files
          const link = document.createElement('a');
          link.href = URL.createObjectURL(file);
          link.download = 'stock-report.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast({
            title: "Image Saved",
            description: "Report image downloaded. You can now share it manually.",
          });
        }
      }, 'image/png');
    } catch (error) {
      console.error("Sharing failed:", error);
      toast({
        title: "Sharing Failed",
        description: "Could not share the report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const grandTotal = Object.values(savedCounts).reduce((acc, current) => acc + current, 0n);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 md:p-8 bg-gray-50">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-4xl font-bold font-headline text-primary">
            counterSKP
          </h1>
          <p className="text-muted-foreground mt-2">
            Scan barcodes to count stock items quickly.
          </p>
        </header>

        <Card className="shadow-lg bg-white rounded-xl">
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
                <div className="flex-1 flex items-center justify-center h-16 bg-muted rounded-md px-2 border">
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
                <div className="flex-1 flex items-center justify-center h-16 bg-muted rounded-md px-2 border">
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
          <CardFooter className="flex-col gap-4">
            <Button
              size="lg"
              onClick={handleCount}
              disabled={!initialCode || !finalCode}
              className="w-full rounded-full"
            >
              <Calculator className="mr-2 h-4 w-4" /> Contar
            </Button>
            {(initialCode || finalCode) && (
              <Button variant="outline" onClick={resetAll} className="w-full rounded-full">
                <RefreshCcw className="mr-2 h-4 w-4" /> Reset
              </Button>
            )}
          </CardFooter>
        </Card>
        
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {count !== null && (
          <Card className="shadow-lg bg-white rounded-xl">
            <CardHeader>
              <CardTitle>Count Result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-accent text-accent-foreground rounded-xl p-4">
                <p className="text-center text-xl">Total Items</p>
                <p className="text-center text-7xl font-bold">{count.toString()}</p>
              </div>
              <div>
                <Label>Select Category to Save</Label>
                <RadioGroup onValueChange={setCategory} value={category || ""} className="flex justify-center gap-4 pt-2">
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
              </div>
            </CardContent>
            <CardFooter>
              <Button size="lg" onClick={handleSave} disabled={!category} className="w-full rounded-full">
                <Save className="mr-2 h-4 w-4" /> Salvar
              </Button>
            </CardFooter>
          </Card>
        )}

        {Object.keys(savedCounts).length > 0 && (
          <Card className="bg-secondary rounded-xl">
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
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Generate Report</CardTitle>
              <CardDescription>Find an agency to generate a final report.</CardDescription>
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
              {isFetchingAgency && <p className="text-center text-sm text-muted-foreground">Loading...</p>}
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
          <Card ref={reportRef} className="bg-white shadow-lg rounded-xl">
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
                <p><span className="font-semibold">Agência:</span> {agencyName} ({agencyNumber})</p>
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
                  {(savedCounts.a || savedCounts.b) && (
                    <div className="flex justify-between items-center bg-muted p-2 rounded-md">
                      <span className="font-medium">A+B</span>
                      <span className="font-bold text-lg">{((savedCounts.a || 0n) + (savedCounts.b || 0n)).toString()}</span>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-center p-2 rounded-md bg-primary text-primary-foreground">
                <span className="font-bold text-lg">Total Geral</span>
                <span className="font-extrabold text-2xl">{grandTotal.toString()}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleShare} className="w-full bg-green-500 hover:bg-green-600 text-white rounded-full">
                <Share2 className="mr-2 h-4 w-4" /> Share on WhatsApp
              </Button>
            </CardFooter>
          </Card>
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
