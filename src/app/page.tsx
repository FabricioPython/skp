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
import { cn } from "@/lib/utils";

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
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <div className="w-full max-w-5xl space-y-6">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 border-b border-white/10">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-primary">
            countSKP
          </h1>
          <div className="flex gap-3">
             <Button variant="outline" size="lg" asChild className="font-bold border-2">
                <Link href="/reports">
                  <History className="mr-2 h-5 w-5" /> Histórico
                </Link>
             </Button>
             <Button variant="destructive" size="lg" onClick={() => setIsClearAlertOpen(true)} className="font-bold">
                <Eraser className="mr-2 h-5 w-5" /> Limpar
              </Button>
          </div>
        </header>

        {error && (
            <Alert variant="destructive" className="border-2">
              <AlertTitle className="font-bold">Erro na Contagem</AlertTitle>
              <AlertDescription className="text-base font-medium">{error}</AlertDescription>
            </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-8">
            <Card className="shadow-2xl border-0 ring-1 ring-white/10 bg-card">
              <CardHeader>
                <CardTitle className="text-2xl font-bold tracking-tight">Scanner Manual</CardTitle>
                <CardDescription className="text-muted-foreground/80 font-medium">Insira ou escaneie as sequências de códigos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Código Inicial
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="text"
                      value={initialCode || ""}
                      onChange={(e) => {
                        setInitialCode(e.target.value.replace(/[\D\t]/g, ''));
                        setCount(0n);
                      }}
                      placeholder="0000000000"
                      className="flex-1 h-16 text-2xl font-mono font-bold tracking-widest text-center bg-white text-card-foreground border-2 border-primary/50 focus:border-primary"
                    />
                    <Button variant="secondary" size="icon" className="h-16 w-16 flex-shrink-0" onClick={() => setScanningFor("initial")}>
                      <Camera className="h-7 w-7" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Código Final
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="text"
                      value={finalCode || ""}
                      onChange={(e) => {
                        setFinalCode(e.target.value.replace(/[\D\t]/g, ''));
                        setCount(0n);
                      }}
                      placeholder="0000000000"
                      className="flex-1 h-16 text-2xl font-mono font-bold tracking-widest text-center bg-white text-card-foreground border-2 border-primary/50 focus:border-primary"
                    />
                    <Button variant="secondary" size="icon" className="h-16 w-16 flex-shrink-0" onClick={() => setScanningFor("final")} disabled={!initialCode}>
                      <Camera className="h-7 w-7" />
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-4 pt-4">
                 <Button
                  size="lg"
                  onClick={handleCount}
                  disabled={!initialCode || !finalCode}
                  className="w-full h-14 text-lg font-bold shadow-lg"
                >
                  <Calculator className="mr-2 h-5 w-5" /> Calcular Contagem
                </Button>
                {(initialCode || finalCode) && (
                  <Button variant="ghost" onClick={resetAll} className="w-full text-muted-foreground hover:text-foreground font-bold">
                    <RefreshCcw className="mr-2 h-4 w-4" /> Resetar Campos
                  </Button>
                )}
              </CardFooter>
            </Card>

            <Card className="shadow-2xl border-0 ring-1 ring-white/10 animate-in slide-in-from-bottom-5">
              <CardHeader>
                <CardTitle className="text-2xl font-bold tracking-tight">Resultado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-primary/20 border-2 border-primary/30 rounded-2xl py-8 flex flex-col items-center justify-center">
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-primary mb-2">Itens Contados</span>
                  <p className="text-8xl font-black tracking-tighter text-primary">{count.toString()}</p>
                </div>
                <div>
                  <Label className="mb-4 block text-center text-sm font-bold uppercase text-muted-foreground">Escolha a Categoria para Salvar</Label>
                  <RadioGroup onValueChange={setCategory} value={category || ""} className="flex justify-center gap-6">
                    {ALL_CATEGORIES.map(cat => (
                      <div key={cat} className="flex flex-col items-center gap-2">
                        <RadioGroupItem value={cat} id={`cat-${cat}`} className="h-8 w-8 border-2" />
                        <Label htmlFor={`cat-${cat}`} className="text-2xl font-black uppercase text-foreground">{cat}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
              <CardFooter>
                <Button size="lg" onClick={handleSave} disabled={!category || count <= 0n} className="w-full h-14 text-lg font-bold">
                  <Save className="mr-2 h-5 w-5" /> Adicionar ao Resumo
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <div className="space-y-8">
             {Object.keys(savedCounts).length > 0 && (
              <Card className="shadow-2xl border-0 ring-1 ring-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                    <Archive className="h-6 w-6 text-primary" />
                    Resumo Atual
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   {ALL_CATEGORIES.map((cat) => (
                    <div key={cat} className="flex justify-between items-center bg-secondary/50 border-2 border-white/5 p-4 rounded-xl">
                      <span className="font-black text-2xl uppercase text-primary">{cat}</span>
                      <div className="flex items-center gap-4">
                        <span className="font-black text-3xl tracking-tighter">{(savedCounts[cat] || 0n).toString()}</span>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => handleIncrementClick(cat)}>
                          <PlusCircle className="h-6 w-6" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-5 mt-6 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                    <span className="font-black text-xl uppercase tracking-wider">Total Geral</span>
                    <span className="font-black text-4xl tracking-tighter">{grandTotal.toString()}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {Object.keys(savedCounts).length > 0 && (
              <Card className="shadow-2xl border-0 ring-1 ring-white/10">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold tracking-tight">Finalização</CardTitle>
                  <CardDescription className="font-medium text-muted-foreground">Informe o número da agência para gerar o relatório final.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-4">
                    <Input
                      type="number"
                      placeholder="0000"
                      value={agencyNumber}
                      onChange={(e) => setAgencyNumber(e.target.value)}
                      disabled={isFetchingAgency}
                      className="h-16 text-2xl font-bold bg-white text-card-foreground border-2 border-primary/50"
                    />
                    <Button onClick={handleFetchAgency} disabled={isFetchingAgency || !agencyNumber} className="h-16 px-6" size="icon">
                      <Search className="h-6 w-6" />
                    </Button>
                  </div>
                  {isFetchingAgency && <p className="text-center font-bold text-primary animate-pulse pt-4">Validando agência...</p>}
                  {agencyError && (
                    <div className="pt-4">
                      <Alert variant="destructive" className="border-2 font-bold">
                        <AlertTitle>Erro</AlertTitle>
                        <AlertDescription>{agencyError}</AlertDescription>
                      </Alert>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {agencyName && reportDate && (
              <div className="space-y-6 animate-in zoom-in-95">
                <Card ref={reportRef} className="shadow-2xl bg-white text-black border-4 border-black/5">
                  <CardHeader className="p-6">
                    <CardTitle className="flex items-center gap-3 text-3xl font-black uppercase tracking-tighter">
                      <FileText className="h-8 w-8" />
                      Relatório SKP
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6 p-6">
                    <div className="grid grid-cols-2 gap-4 text-lg">
                      <div>
                        <span className="block text-xs font-black uppercase text-muted-foreground/60 mb-1">Agência</span>
                        <p className="font-black">{agencyName} ({agencyNumber})</p>
                      </div>
                      <div className="text-right">
                        <span className="block text-xs font-black uppercase text-muted-foreground/60 mb-1">Data da Coleta</span>
                        <p className="font-black">{reportDate}</p>
                      </div>
                    </div>
                    <Separator className="bg-black/10" />
                    <div className="space-y-3">
                        <h4 className="font-black text-sm uppercase tracking-widest text-black/50">Consolidado</h4>
                        {ALL_CATEGORIES.map((cat) => (
                          <div key={cat} className="flex justify-between items-center bg-black/5 p-4 rounded-lg">
                            <span className="font-black text-xl uppercase">Categoria {cat}</span>
                            <span className="font-black text-2xl">{(savedCounts[cat] || 0n).toString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center bg-black/5 p-4 rounded-lg border-2 border-dashed border-black/10">
                          <span className="font-black text-xl uppercase">Grupo A + B</span>
                          <span className="font-black text-2xl">{((savedCounts.a || 0n) + (savedCounts.b || 0n)).toString()}</span>
                        </div>
                    </div>
                    {Object.keys(sequencePairs).length > 0 && (
                      <div className="space-y-3 pt-4">
                        <h4 className="font-black text-sm uppercase tracking-widest text-black/50">Registros de Sequência</h4>
                        <div className="space-y-2 text-sm font-mono font-bold bg-black/5 p-4 rounded-lg">
                            {ALL_CATEGORIES.map(cat => (
                              sequencePairs[cat] && sequencePairs[cat].length > 0 && (
                                <div key={cat} className="mb-4 last:mb-0">
                                  <p className="text-xs font-black uppercase text-black/40 mb-2">{cat}</p>
                                  {sequencePairs[cat].map((pair, index) => (
                                    <div key={index} className="flex justify-between items-center mb-1">
                                      <span>{pair.initial}</span>
                                      <span className="text-black/30">→</span>
                                      <span>{pair.final}</span>
                                    </div>
                                  ))}
                                </div>
                              )
                            ))}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-center p-5 rounded-xl bg-black text-white shadow-xl">
                      <span className="font-black text-xl uppercase">Total Final</span>
                      <span className="font-black text-4xl tracking-tighter">{grandTotal.toString()}</span>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex flex-col sm:flex-row gap-4">
                    <Button onClick={handleSendEmail} className="flex-1 h-16 text-lg font-black uppercase" variant="outline">
                        <Mail className="mr-2 h-6 w-6" /> Enviar
                    </Button>
                    <Button onClick={handleShareAndFinalize} className="flex-1 h-16 text-lg font-black uppercase">
                        <Save className="mr-2 h-6 w-6" /> Salvar
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
            <DialogTitle className="text-2xl font-bold">Scanner {scanningFor === 'initial' ? 'Inicial' : 'Final'}</DialogTitle>
          </DialogHeader>
          <div className="relative -mx-6 -mb-6 bg-black rounded-b-lg overflow-hidden border-t">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="w-[85%] h-[4px] bg-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.5)] rounded-full"></div>
            </div>
            <BarcodeScanner onScan={handleScan} paused={!scanningFor} />
          </div>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isIncrementAlertOpen} onOpenChange={setIsIncrementAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold">Adicionar Unidade</AlertDialogTitle>
            <AlertDialogDescription className="text-lg font-medium">
              Confirma o incremento de <strong>1 unidade</strong> na categoria <strong>{categoryToIncrement?.toUpperCase()}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmIncrement} className="font-bold">Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isClearAlertOpen} onOpenChange={setIsClearAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-destructive">Limpar Sessão</AlertDialogTitle>
            <AlertDialogDescription className="text-lg font-medium">
              Todos os dados não salvos serão permanentemente apagados. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="font-bold">Manter Dados</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { clearSession(); setIsClearAlertOpen(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
            >
              Sim, Limpar Tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
