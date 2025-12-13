
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Camera, RefreshCcw, Calculator, Save, Archive, Search, FileText, Share2, PlusCircle, History } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import BarcodeScanner from "@/components/barcode-scanner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { agencies } from "@/lib/agencies";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useFirebase } from "@/firebase/provider";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

type ScanTarget = "initial" | "final";
const ALL_CATEGORIES = ['a', 'b', 'c'];

type SequencePair = { initial: string; final: string };

export default function Home() {
  const [initialCode, setInitialCode] = useState<string | null>(null);
  const [finalCode, setFinalCode] = useState<string | null>(null);
  const [scanningFor, setScanningFor] = useState<ScanTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<bigint>(0n);
  const [category, setCategory] = useState<string | null>(null);
  const [savedCounts, setSavedCounts] = useState<Record<string, bigint>>({});
  const [sequencePairs, setSequencePairs] = useState<Record<string, SequencePair[]>>({});
  
  const [agencyNumber, setAgencyNumber] = useState<string>("");
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [agencyError, setAgencyError] = useState<string | null>(null);
  const [isFetchingAgency, setIsFetchingAgency] = useState(false);
  const [reportDate, setReportDate] = useState<string | null>(null);
  
  const [isIncrementAlertOpen, setIsIncrementAlertOpen] = useState(false);
  const [categoryToIncrement, setCategoryToIncrement] = useState<string | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { firestore } = useFirebase();

  useEffect(() => {
    if (agencyName) {
      setReportDate(new Date().toLocaleDateString('pt-BR'));
    }
  }, [agencyName]);
  
  const handleScan = (result: string) => {
    setError(null);
    const sanitizedResult = result.replace(/[\D\t]/g, '');

    if (scanningFor === "initial") {
      setInitialCode(sanitizedResult);
      // Reset final code and count if initial is re-scanned
      setFinalCode(null);
      setCount(0n);
    } else if (scanningFor === "final") {
      setFinalCode(sanitizedResult);
      setCount(0n);
    }
    setScanningFor(null);
  };
  
  const handleCount = () => {
    if (initialCode && finalCode) {
      try {
        const initialNum = BigInt(initialCode);
        const finalNum = BigInt(finalCode);

        if (finalNum <= initialNum) {
          setError("A sequência final deve ser maior que a sequência inicial.");
          setCount(0n);
          return;
        }
        
        setError(null);
        setCount(finalNum - initialNum + 1n);
      } catch (e) {
        setError("Os códigos de barras devem conter números para calcular a contagem.");
        setCount(0n);
      }
    }
  };

  const resetAll = useCallback(() => {
    setInitialCode(null);
    setFinalCode(null);
    setError(null);
    setCount(0n);
    setCategory(null);
  }, []);

  const handleSave = () => {
    if (category && count > 0n && initialCode && finalCode) {
      setSavedCounts(prevCounts => ({
        ...prevCounts,
        [category]: (prevCounts[category] || 0n) + count,
      }));
       setSequencePairs(prevPairs => ({
        ...prevPairs,
        [category]: [...(prevPairs[category] || []), { initial: initialCode, final: finalCode }]
      }));
      // Reset for next count
      resetAll();
    }
  };
  
  const handleFetchAgency = async () => {
    if (!agencyNumber) {
      setAgencyError("Por favor, insira o número da agência.");
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
      setAgencyError("Agência não encontrada. Por favor, verifique o número.");
    }
    
    setIsFetchingAgency(false);
  };

  const handleGenerateAndSaveReport = async () => {
    if (!agencyName || !reportDate || grandTotal === 0n || !firestore) {
      toast({
        title: "Nada para Salvar",
        description: "Não há dados de contagem para salvar.",
        variant: "destructive",
      });
      return;
    }
  
    // Convert BigInts to strings for Firestore
    const countsAsString = Object.entries(savedCounts).reduce((acc, [key, value]) => {
      acc[key] = value.toString();
      return acc;
    }, {} as Record<string, string>);
  
    try {
      const reportsRef = collection(firestore, "reports");
      await addDoc(reportsRef, {
        agencyNumber,
        agencyName,
        reportDate: reportDate,
        savedCounts: countsAsString,
        sequencePairs: sequencePairs,
        grandTotal: grandTotal.toString(),
        createdAt: serverTimestamp(),
      });
  
      toast({
        title: "Relatório Salvo e Sessão Finalizada!",
        description: "O relatório foi salvo no banco de dados e a sessão foi limpa.",
      });
  
    } catch (error) {
      console.error("Error saving report: ", error);
      toast({
        title: "Erro ao Salvar Relatório",
        description: "Não foi possível salvar o relatório no banco de dados.",
        variant: "destructive",
      });
    }
  
    // Clear current report data after saving
    setSavedCounts({});
    setSequencePairs({});
    setAgencyNumber("");
    setAgencyName(null);
    setReportDate(null);
  };
  
  const handleShare = async () => {
    if (!reportRef.current) {
      toast({
        title: "Erro",
        description: "Não foi possível capturar o relatório.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Temporarily set background to white for capture
      reportRef.current.style.backgroundColor = 'white';
      reportRef.current.style.color = 'black';

      const canvas = await html2canvas(reportRef.current, {
        useCORS: true,
        scale: 1, 
      });
      
      // Revert styles
      reportRef.current.style.backgroundColor = '';
      reportRef.current.style.color = '';

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      const pdfBlob = pdf.output('blob');
      
      const file = new File([pdfBlob], "relatorio-estoque.pdf", { type: "application/pdf" });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
           await navigator.share({
            files: [file],
            title: 'Relatório de Contagem de Estoque',
            text: `Aqui está o relatório de contagem de caixas para ${agencyName} em ${reportDate}.`,
          });
        } catch (shareError) {
           console.log("Compartilhamento cancelado ou falhou", shareError);
           // Do not show a toast on purpose if user cancels share
        }
      } else {
        pdf.save('relatorio-estoque.pdf');
        toast({
          title: "PDF Salvo",
          description: "Relatório em PDF baixado. Você pode compartilhá-lo manualmente.",
        });
      }
    } catch (error) {
      console.error("Falha no compartilhamento:", error);
      toast({
        title: "Falha no Compartilhamento",
        description: "Não foi possível compartilhar o relatório. Por favor, tente novamente.",
        variant: "destructive",
      });
    }
  };
  
  const handleIncrementClick = (cat: string) => {
    setCategoryToIncrement(cat);
    setIsIncrementAlertOpen(true);
  };
  
  const confirmIncrement = () => {
    if (categoryToIncrement) {
      setSavedCounts(prevCounts => ({
        ...prevCounts,
        [categoryToIncrement]: (prevCounts[categoryToIncrement] || 0n) + 1n,
      }));
    }
    setCategoryToIncrement(null);
    setIsIncrementAlertOpen(false);
  };

  const grandTotal = Object.values(savedCounts).reduce((acc, current) => acc + current, 0n);

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 bg-background">
      <div className="w-full max-w-5xl space-y-4">
        <header className="text-center py-4 relative">
          <h1 className="text-5xl font-bold tracking-tight text-primary">
            countSKP
          </h1>
          <div className="absolute top-0 right-0">
             <Link href="/reports" passHref>
                <Button variant="outline" size="icon">
                  <History className="h-5 w-5" />
                  <span className="sr-only">Ver Relatórios Salvos</span>
                </Button>
              </Link>
          </div>
        </header>

        {error && (
            <Alert variant="destructive">
            <AlertTitle>Erro na Contagem</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-6 md:items-start">
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Leitura de Código de Barras</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Código de Barras Inicial
                  </Label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center justify-center h-16 bg-card rounded-lg px-3 border">
                      <p className="text-lg font-mono tracking-wider text-card-foreground break-all text-center">
                        {initialCode || "..."}
                      </p>
                    </div>
                    <Button variant="outline" size="icon" className="h-16 w-16 flex-shrink-0 bg-card" onClick={() => setScanningFor("initial")}>
                      <Camera className="h-6 w-6" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Código de Barras Final
                  </Label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center justify-center h-16 bg-card rounded-lg px-3 border">
                      <p className="text-lg font-mono tracking-wider text-card-foreground break-all text-center">
                        {finalCode || "..."}
                      </p>
                    </div>
                    <Button variant="outline" size="icon" className="h-16 w-16 flex-shrink-0 bg-card" onClick={() => setScanningFor("final")} disabled={!initialCode}>
                      <Camera className="h-6 w-6" />
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3 pt-4">
                 <Button
                  size="lg"
                  onClick={handleCount}
                  disabled={!initialCode || !finalCode}
                  className="w-full"
                >
                  <Calculator className="mr-2 h-4 w-4" /> Contar
                </Button>
                {(initialCode || finalCode) && (
                  <Button variant="ghost" onClick={resetAll} className="w-full text-muted-foreground">
                    <RefreshCcw className="mr-2 h-4 w-4" /> Reiniciar Leitura
                  </Button>
                )}
              </CardFooter>
            </Card>

            <Card className="shadow-lg animate-in fade-in-50">
              <CardHeader>
                <CardTitle>Resultado da Contagem</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-primary/10 border-2 border-primary/20 rounded-xl p-2">
                  <p className="text-center text-6xl font-bold tracking-tighter text-primary">{count.toString()}</p>
                </div>
                <div>
                  <Label className="mb-2 block text-center text-sm">Selecione a Categoria para Salvar</Label>
                  <RadioGroup onValueChange={setCategory} value={category || ""} className="flex justify-center gap-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="a" id="r1" className="h-6 w-6" />
                      <Label htmlFor="r1" className="text-base p-2">A</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="b" id="r2" className="h-6 w-6" />
                      <Label htmlFor="r2" className="text-base p-2">B</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="c" id="r3" className="h-6 w-6" />
                      <Label htmlFor="r3" className="text-base p-2">C</Label>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
              <CardFooter>
                <Button size="lg" onClick={handleSave} disabled={!category || count <= 0n} className="w-full">
                  <Save className="mr-2 h-4 w-4" /> Salvar Contagem
                </Button>
              </CardFooter>
            </Card>

          </div>
          
          <div className="space-y-6 mt-6 md:mt-0">
             {Object.keys(savedCounts).length > 0 && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Archive className="h-5 w-5" />
                    Resumo da Sessão
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                   {ALL_CATEGORIES.map((cat) => (
                    <div key={cat} className="flex justify-between items-center bg-card border p-3 rounded-lg">
                      <span className="font-medium text-lg text-card-foreground">{cat.toUpperCase()}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-2xl tracking-tight text-card-foreground">{(savedCounts[cat] || 0n).toString()}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-green-600" onClick={() => handleIncrementClick(cat)}>
                          <PlusCircle className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Separator className="my-4" />
                  <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10">
                    <span className="font-bold text-lg">Total Geral</span>
                    <span className="font-extrabold text-2xl text-primary tracking-tight">{grandTotal.toString()}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {Object.keys(savedCounts).length > 0 && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Gerar Relatório</CardTitle>
                  <CardDescription>Insira o número da agência para finalizar.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <Input
                      type="number"
                      placeholder="Nº da agência"
                      value={agencyNumber}
                      onChange={(e) => setAgencyNumber(e.target.value)}
                      disabled={isFetchingAgency}
                      className="h-12 text-lg"
                    />
                    <Button onClick={handleFetchAgency} disabled={isFetchingAgency || !agencyNumber} className="h-12" size="icon">
                      <Search className="h-5 w-5" />
                    </Button>
                  </div>
                  {isFetchingAgency && <p className="text-center text-sm text-muted-foreground pt-3">Buscando...</p>}
                  {agencyError && (
                    <div className="pt-3">
                      <Alert variant="destructive">
                        <AlertTitle>Erro</AlertTitle>
                        <AlertDescription>{agencyError}</AlertDescription>
                      </Alert>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {agencyName && reportDate && (
                <div className="space-y-4">
                    <Card ref={reportRef} className="shadow-xl border-primary/20 bg-card text-card-foreground">
                    <CardHeader className="bg-card p-4 pb-2">
                        <CardTitle className="flex items-center gap-2 text-xl text-primary">
                        <FileText className="h-6 w-6" />
                        Relatório de Contagem
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 p-4">
                        <div className="space-y-1 text-sm">
                        <p><span className="font-semibold">Agência:</span> {agencyName} ({agencyNumber})</p>
                        <p><span className="font-semibold">Data:</span> {reportDate}</p>
                        </div>
                        <Separator />
                        <div>
                        <h4 className="font-semibold my-2 text-base">Totais por Categoria:</h4>
                        <div className="space-y-2">
                            {ALL_CATEGORIES.map((cat) => (
                            <div key={cat} className="flex justify-between items-center bg-card border p-2.5 rounded-md">
                                <span className="font-medium text-card-foreground">{cat.toUpperCase()}</span>
                                <span className="font-bold text-lg text-card-foreground">{(savedCounts[cat] || 0n).toString()}</span>
                            </div>
                            ))}
                            <div className="flex justify-between items-center bg-card border p-2.5 rounded-md">
                            <span className="font-medium text-card-foreground">Tipo AB</span>
                            <span className="font-bold text-lg text-card-foreground">{((savedCounts.a || 0n) + (savedCounts.b || 0n)).toString()}</span>
                            </div>
                        </div>
                        </div>
                        {Object.keys(sequencePairs).length > 0 && (
                        <>
                            <Separator />
                            <div>
                            <h4 className="font-semibold my-2 text-base">Sequências Lidas:</h4>
                            <div className="space-y-2 text-xs font-mono">
                                {ALL_CATEGORIES.map(cat => (
                                sequencePairs[cat] && sequencePairs[cat].length > 0 && (
                                    <div key={cat}>
                                    <p className="font-semibold mb-1 text-sm">{cat.toUpperCase()}:</p>
                                    <div className="space-y-1 pl-2 border-l-2">
                                        {sequencePairs[cat].map((pair, index) => (
                                        <div key={index} className="flex justify-between">
                                            <span>{pair.initial}</span>
                                            <span>&rarr;</span>
                                            <span>{pair.final}</span>
                                        </div>
                                        ))}
                                    </div>
                                    </div>
                                )
                                ))}
                            </div>
                            </div>
                        </>
                        )}
                        <Separator />
                        <div className="flex justify-between items-center p-3 mt-2 rounded-lg bg-primary text-primary-foreground">
                        <span className="font-bold text-lg">Total Geral</span>
                        <span className="font-extrabold text-2xl tracking-tight">{grandTotal.toString()}</span>
                        </div>
                    </CardContent>
                    </Card>
                    <div className="flex gap-3">
                      <Button onClick={handleShare} className="w-full" size="lg" variant="secondary">
                        <Share2 className="mr-2 h-5 w-5" /> Compartilhar
                      </Button>
                      <Button onClick={handleGenerateAndSaveReport} className="w-full" size="lg" variant="default">
                        <Save className="mr-2 h-5 w-5" /> Salvar e Finalizar
                      </Button>
                    </div>
                </div>
            )}

          </div>
        </div>
      </div>

      <Dialog open={!!scanningFor} onOpenChange={(open) => !open && setScanningFor(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Digitalizar Código de Barras {scanningFor === 'initial' ? 'Inicial' : 'Final'}</DialogTitle>
          </DialogHeader>
          <div className="relative -mx-6 -mb-6 bg-black rounded-b-lg overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="w-[90%] h-[2px] bg-red-500"></div>
            </div>
            <BarcodeScanner onScan={handleScan} paused={!scanningFor} />
          </div>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isIncrementAlertOpen} onOpenChange={setIsIncrementAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Incremento</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja adicionar 1 à contagem de <strong>{categoryToIncrement?.toUpperCase()}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmIncrement}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
