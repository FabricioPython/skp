"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Camera, RefreshCcw, Calculator, Archive, Search, FileText, PlusCircle, Eraser, Save, Mail, History } from "lucide-react";
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
import { jsPDF } from "jspdf";
import { useFirebase } from "@/firebase/provider";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import Link from "next/link";

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
  const [isClearAlertOpen, setIsClearAlertOpen] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { firestore } = useFirebase();

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem("stock-counter-session");
      if (savedSession) {
        const { savedCounts: savedCountsStr, sequencePairs: loadedSeqPairs, agencyNumber: loadedAgencyNum, agencyName: loadedAgencyName, reportDate: loadedReportDate } = JSON.parse(savedSession);
        
        const loadedSavedCounts: Record<string, bigint> = {};
        if (savedCountsStr) {
          for (const key in savedCountsStr) {
            loadedSavedCounts[key] = BigInt(savedCountsStr[key]);
          }
        }
        setSavedCounts(loadedSavedCounts);
        if (loadedSeqPairs) setSequencePairs(loadedSeqPairs);
        if (loadedAgencyNum) setAgencyNumber(loadedAgencyNum);
        if (loadedAgencyName) setAgencyName(loadedAgencyName);
        if (loadedReportDate) setReportDate(loadedReportDate);
      }
    } catch (error) {
      console.error("Falha ao carregar a sessão do localStorage", error);
      localStorage.removeItem("stock-counter-session");
    }
  }, []);

  useEffect(() => {
    try {
      if (Object.keys(savedCounts).length === 0 && !agencyNumber && !agencyName) {
        if (localStorage.getItem("stock-counter-session")) {
            localStorage.removeItem("stock-counter-session");
        }
        return;
      }
      
      const savedCountsStr: Record<string, string> = {};
      for (const key in savedCounts) {
        savedCountsStr[key] = savedCounts[key].toString();
      }

      const sessionToSave = {
        savedCounts: savedCountsStr,
        sequencePairs,
        agencyNumber,
        agencyName,
        reportDate,
      };
      
      localStorage.setItem("stock-counter-session", JSON.stringify(sessionToSave));
    } catch (error) {
      console.error("Falha ao salvar a sessão no localStorage", error);
    }
  }, [savedCounts, sequencePairs, agencyNumber, agencyName, reportDate]);

  useEffect(() => {
    if (agencyName && !reportDate) {
      setReportDate(new Date().toLocaleDateString('pt-BR'));
    }
  }, [agencyName, reportDate]);
  
  const handleScan = (result: string) => {
    setError(null);
    const sanitizedResult = result.replace(/[\D\t]/g, '');
    if (scanningFor === "initial") {
      setInitialCode(sanitizedResult);
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
  
  const clearSession = () => {
      setSavedCounts({});
      setSequencePairs({});
      setAgencyNumber("");
      setAgencyName(null);
      setReportDate(null);
      resetAll();
       try {
        localStorage.removeItem("stock-counter-session");
      } catch (error) {
        console.error("Falha ao limpar a sessão do localStorage", error);
      }
  }

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
      resetAll();
      toast({ title: "Contagem Salva", description: "Os valores foram adicionados ao resumo." });
    }
  };
  
  const handleFetchAgency = async () => {
    if (!agencyNumber) {
      setAgencyError("Por favor, insira o número da agência.");
      return;
    }
    setIsFetchingAgency(true);
    setAgencyError(null);
    await new Promise(resolve => setTimeout(resolve, 300));
    const agency = agencies.find(a => a.id === parseInt(agencyNumber, 10));
    if (agency) {
      setAgencyName(agency.name);
    } else {
      setAgencyError("Agência não encontrada. Por favor, verifique o número.");
    }
    setIsFetchingAgency(false);
  };
  
  const handleSendEmail = async () => {
    if (!reportRef.current || !agencyName || !reportDate || grandTotal === 0n) {
      toast({ title: "Erro", description: "Dados insuficientes para gerar o e-mail.", variant: "destructive" });
      return;
    }
    try {
      reportRef.current.style.backgroundColor = 'white';
      reportRef.current.style.color = 'black';
      const canvas = await html2canvas(reportRef.current, { useCORS: true, scale: 2 });
      reportRef.current.style.backgroundColor = '';
      reportRef.current.style.color = '';
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      const pdfBlob = pdf.output('blob');
      
      const fileName = `Relatorio_${agencyName.replace(/\W/g, '_')}_${reportDate.replace(/\//g, '-')}.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });
      const subject = `Relatório de Agencia ${agencyName}`;

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({ files: [pdfFile], title: subject });
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(pdfBlob);
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
    }
  };

  const handleShareAndFinalize = async () => {
    if (!agencyName || !firestore || grandTotal === 0n) return;
    try {
        const countsAsString = Object.entries(savedCounts).reduce((acc, [key, value]) => {
          acc[key] = value.toString();
          return acc;
        }, {} as Record<string, string>);
      
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
        toast({ title: "Relatório Salvo!", description: "Histórico atualizado com sucesso." });
        clearSession();
    } catch (error) {
      console.error("Error saving report: ", error);
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
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 bg-background text-foreground">
      <div className="w-full max-w-5xl space-y-6">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 border-b">
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            countSKP
          </h1>
          <div className="flex gap-2">
             <Button variant="outline" asChild>
                <Link href="/reports">
                  <History className="mr-2 h-4 w-4" /> Histórico
                </Link>
             </Button>
             <Button variant="destructive" onClick={() => setIsClearAlertOpen(true)}>
                <Eraser className="mr-2 h-4 w-4" /> Limpar
              </Button>
          </div>
        </header>

        {error && (
            <Alert variant="destructive">
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Entrada Manual</CardTitle>
                <CardDescription>Escaneie ou digite as sequências.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Código Inicial</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={initialCode || ""}
                      onChange={(e) => {
                        setInitialCode(e.target.value.replace(/[\D\t]/g, ''));
                        setCount(0n);
                      }}
                      placeholder="Código inicial"
                    />
                    <Button variant="secondary" size="icon" onClick={() => setScanningFor("initial")}>
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Código Final</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={finalCode || ""}
                      onChange={(e) => {
                        setFinalCode(e.target.value.replace(/[\D\t]/g, ''));
                        setCount(0n);
                      }}
                      placeholder="Código final"
                    />
                    <Button variant="secondary" size="icon" onClick={() => setScanningFor("final")} disabled={!initialCode}>
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-2">
                 <Button
                  className="w-full"
                  onClick={handleCount}
                  disabled={!initialCode || !finalCode}
                >
                  <Calculator className="mr-2 h-4 w-4" /> Calcular
                </Button>
                {(initialCode || finalCode) && (
                  <Button variant="ghost" onClick={resetAll} className="w-full">
                    <RefreshCcw className="mr-2 h-4 w-4" /> Resetar
                  </Button>
                )}
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resultado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center py-6 bg-secondary/20 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground uppercase">Itens</p>
                  <p className="text-6xl font-bold">{count.toString()}</p>
                </div>
                <div>
                  <Label className="mb-2 block text-center">Categoria</Label>
                  <RadioGroup onValueChange={setCategory} value={category || ""} className="flex justify-center gap-4">
                    {ALL_CATEGORIES.map(cat => (
                      <div key={cat} className="flex items-center space-x-2">
                        <RadioGroupItem value={cat} id={`cat-${cat}`} />
                        <Label htmlFor={`cat-${cat}`} className="text-lg uppercase">{cat}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" onClick={handleSave} disabled={!category || count <= 0n}>
                  <Save className="mr-2 h-4 w-4" /> Adicionar
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <div className="space-y-6">
             {Object.keys(savedCounts).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Archive className="h-5 w-5" />
                    Resumo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                   {ALL_CATEGORIES.map((cat) => (
                    <div key={cat} className="flex justify-between items-center p-2 bg-secondary/10 rounded">
                      <span className="font-bold uppercase">Cat {cat}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold">{(savedCounts[cat] || 0n).toString()}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleIncrementClick(cat)}>
                          <PlusCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 mt-4 bg-primary text-primary-foreground rounded-lg">
                    <span className="font-bold uppercase">Total</span>
                    <span className="text-2xl font-bold">{grandTotal.toString()}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {Object.keys(savedCounts).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Agência</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Número da agência"
                      value={agencyNumber}
                      onChange={(e) => setAgencyNumber(e.target.value)}
                      disabled={isFetchingAgency}
                    />
                    <Button onClick={handleFetchAgency} disabled={isFetchingAgency || !agencyNumber} size="icon">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  {isFetchingAgency && <p className="text-xs text-primary mt-2">Buscando...</p>}
                  {agencyError && <p className="text-xs text-destructive mt-2">{agencyError}</p>}
                </CardContent>
              </Card>
            )}

            {agencyName && reportDate && (
              <div className="space-y-4">
                <Card ref={reportRef} className="bg-white text-black border-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl font-bold uppercase">
                      <FileText className="h-6 w-6" />
                      Relatório
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span><strong>Agência:</strong> {agencyName}</span>
                      <span><strong>Data:</strong> {reportDate}</span>
                    </div>
                    <Separator className="bg-black/10" />
                    <div className="space-y-2">
                        {ALL_CATEGORIES.map((cat) => (
                          <div key={cat} className="flex justify-between">
                            <span className="uppercase">Cat {cat}:</span>
                            <span className="font-bold">{(savedCounts[cat] || 0n).toString()}</span>
                          </div>
                        ))}
                    </div>
                    <div className="flex justify-between p-2 bg-black text-white rounded">
                      <span className="font-bold uppercase">Total Geral</span>
                      <span className="font-bold">{grandTotal.toString()}</span>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex gap-2">
                    <Button onClick={handleSendEmail} className="flex-1" variant="outline">
                        <Mail className="mr-2 h-4 w-4" /> Enviar
                    </Button>
                    <Button onClick={handleShareAndFinalize} className="flex-1">
                        <Save className="mr-2 h-4 w-4" /> Salvar
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
            <DialogTitle>Scanner {scanningFor === 'initial' ? 'Inicial' : 'Final'}</DialogTitle>
          </DialogHeader>
          <div className="relative overflow-hidden rounded-lg bg-black aspect-square">
            <BarcodeScanner onScan={handleScan} paused={!scanningFor} />
          </div>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isIncrementAlertOpen} onOpenChange={setIsIncrementAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adicionar Unidade</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja adicionar +1 à categoria {categoryToIncrement?.toUpperCase()}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={confirmIncrement}>Sim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isClearAlertOpen} onOpenChange={setIsClearAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar Dados</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apagará todas as contagens atuais. Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { clearSession(); setIsClearAlertOpen(false); }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Limpar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
