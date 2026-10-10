"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Camera, RefreshCcw, Calculator, Archive, Search, FileText, PlusCircle, Eraser, Save, Mail, History, ArrowRight } from "lucide-react";
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
      // Temporary styling for capture to match PDF best practices (white background, black text)
      const originalStyle = reportRef.current.style.cssText;
      reportRef.current.style.backgroundColor = 'white';
      reportRef.current.style.color = 'black';
      
      const canvas = await html2canvas(reportRef.current, { useCORS: true, scale: 2 });
      
      // Restore original style
      reportRef.current.style.cssText = originalStyle;
      
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
        toast({ title: "Download Iniciado", description: "O PDF foi gerado e baixado." });
      }
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({ title: "Erro", description: "Falha ao gerar o relatório em PDF.", variant: "destructive" });
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
      toast({ title: "Erro", description: "Não foi possível salvar no Firebase.", variant: "destructive" });
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
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-5xl space-y-6">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 border-b border-white/10">
          <h1 className="text-4xl font-black tracking-tighter text-primary italic uppercase">
            countSKP
          </h1>
          <div className="flex gap-2">
             <Button variant="outline" asChild className="border-primary/50 text-foreground hover:bg-primary hover:text-primary-foreground transition-all">
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
            <Card className="bg-card/50 backdrop-blur border-white/5">
              <CardHeader>
                <CardTitle className="text-xl font-bold uppercase tracking-wider text-muted">Entrada Manual</CardTitle>
                <CardDescription className="text-white/60">Escaneie ou digite as sequências.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted">Código Inicial</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={initialCode || ""}
                      onChange={(e) => {
                        setInitialCode(e.target.value.replace(/[\D\t]/g, ''));
                        setCount(0n);
                      }}
                      className="bg-background/50 border-white/20 text-lg font-mono focus:border-primary"
                      placeholder="000000000"
                    />
                    <Button variant="secondary" size="icon" onClick={() => setScanningFor("initial")} className="bg-muted hover:bg-primary text-background">
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted">Código Final</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={finalCode || ""}
                      onChange={(e) => {
                        setFinalCode(e.target.value.replace(/[\D\t]/g, ''));
                        setCount(0n);
                      }}
                      className="bg-background/50 border-white/20 text-lg font-mono focus:border-primary"
                      placeholder="000000000"
                    />
                    <Button variant="secondary" size="icon" onClick={() => setScanningFor("final")} disabled={!initialCode} className="bg-muted hover:bg-primary text-background">
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-2">
                 <Button
                  className="w-full text-lg font-black uppercase italic"
                  onClick={handleCount}
                  disabled={!initialCode || !finalCode}
                >
                  <Calculator className="mr-2 h-5 w-5" /> Calcular
                </Button>
                {(initialCode || finalCode) && (
                  <Button variant="ghost" onClick={resetAll} className="w-full text-white/40 hover:text-white">
                    <RefreshCcw className="mr-2 h-4 w-4" /> Resetar
                  </Button>
                )}
              </CardFooter>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-white/5 overflow-hidden">
              <CardHeader className="bg-primary/5 pb-2">
                <CardTitle className="text-xl font-bold uppercase tracking-wider text-primary">Resultado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="text-center py-8 bg-black/40 rounded-xl border border-white/5">
                  <p className="text-xs font-black text-primary uppercase tracking-[0.2em] mb-2">Total de Itens</p>
                  <p className="text-7xl font-black italic tracking-tighter text-white">{count.toString()}</p>
                </div>
                <div>
                  <Label className="mb-4 block text-center text-xs font-bold uppercase text-muted">Selecione a Categoria</Label>
                  <RadioGroup onValueChange={setCategory} value={category || ""} className="flex justify-center gap-6">
                    {ALL_CATEGORIES.map(cat => (
                      <div key={cat} className="flex flex-col items-center gap-2">
                        <RadioGroupItem value={cat} id={`cat-${cat}`} className="w-6 h-6 border-2" />
                        <Label htmlFor={`cat-${cat}`} className="text-xl font-black uppercase italic">{cat}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Button className="w-full h-14 text-xl font-black uppercase italic" onClick={handleSave} disabled={!category || count <= 0n}>
                  <Save className="mr-2 h-6 w-6" /> Adicionar à Pilha
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <div className="space-y-6">
             {Object.keys(savedCounts).length > 0 && (
              <Card className="bg-card text-foreground border-white/10 shadow-2xl">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="flex items-center gap-2 text-xl font-black italic uppercase">
                    <Archive className="h-6 w-6 text-primary" />
                    Resumo Consolidado
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-6">
                   {ALL_CATEGORIES.map((cat) => (
                    <div key={cat} className="flex justify-between items-center p-4 bg-white/5 hover:bg-white/10 transition-colors rounded-xl border border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Categoria</span>
                        <span className="text-2xl font-black italic uppercase">{cat}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-3xl font-mono font-bold">{(savedCounts[cat] || 0n).toString()}</span>
                        <Button variant="secondary" size="icon" className="h-10 w-10 bg-white/10 hover:bg-primary hover:text-background" onClick={() => handleIncrementClick(cat)}>
                          <PlusCircle className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-6 mt-4 bg-primary text-background rounded-xl shadow-[0_0_20px_rgba(214,255,0,0.3)]">
                    <span className="text-lg font-black uppercase italic tracking-tighter">Total Geral</span>
                    <span className="text-4xl font-black italic">{grandTotal.toString()}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {Object.keys(savedCounts).length > 0 && (
              <Card className="bg-card/50 border-white/5">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase text-muted">Vincular Agência</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="ID Agência"
                      value={agencyNumber}
                      onChange={(e) => setAgencyNumber(e.target.value)}
                      disabled={isFetchingAgency}
                      className="bg-background border-white/10 text-lg font-bold"
                    />
                    <Button onClick={handleFetchAgency} disabled={isFetchingAgency || !agencyNumber} className="bg-muted hover:bg-primary text-background px-6">
                      <Search className="h-5 w-5" />
                    </Button>
                  </div>
                  {isFetchingAgency && <p className="text-xs text-primary mt-2 animate-pulse">Buscando no sistema...</p>}
                  {agencyError && <p className="text-xs text-destructive mt-2">{agencyError}</p>}
                </CardContent>
              </Card>
            )}

            {agencyName && reportDate && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5">
                <div ref={reportRef} className="bg-white text-black p-8 rounded-xl border-4 border-black space-y-6 shadow-xl">
                    <div className="flex justify-between items-start border-b-4 border-black pb-4">
                      <div>
                        <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none mb-1">RELATÓRIO</h2>
                        <p className="text-xl font-bold uppercase">{agencyName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black uppercase">DATA</p>
                        <p className="text-xl font-mono font-bold leading-none">{reportDate}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        {ALL_CATEGORIES.map((cat) => (
                          <div key={cat} className="flex justify-between items-center py-2 border-b-2 border-black/10">
                            <span className="text-2xl font-black uppercase italic">CAT {cat}</span>
                            <span className="text-3xl font-mono font-bold">{(savedCounts[cat] || 0n).toString()}</span>
                          </div>
                        ))}
                    </div>

                    <div className="flex justify-between items-center p-4 bg-black text-white rounded-lg">
                      <span className="text-2xl font-black italic uppercase">TOTAL GERAL</span>
                      <span className="text-4xl font-black italic">{grandTotal.toString()}</span>
                    </div>

                    <div className="pt-4 border-t-2 border-black space-y-1">
                      <p className="text-[10px] font-bold text-center uppercase text-black/50">countSKP - Sistema Digital de Contagem de Estoque</p>
                      <p className="text-[10px] font-bold text-center uppercase text-black/50">Agência ID: {agencyNumber}</p>
                    </div>
                </div>
                
                <div className="flex gap-4">
                    <Button onClick={handleSendEmail} className="flex-1 h-14 bg-white hover:bg-white/90 text-black text-lg font-black uppercase italic border-4 border-black shadow-[4px_4px_0px_white]">
                        <Mail className="mr-2 h-6 w-6" /> Enviar
                    </Button>
                    <Button onClick={handleShareAndFinalize} className="flex-1 h-14 text-lg font-black uppercase italic shadow-[4px_4px_0px_#D6FF00]">
                        <Save className="mr-2 h-6 w-6" /> Salvar
                    </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!scanningFor} onOpenChange={(open) => !open && setScanningFor(null)}>
        <DialogContent className="sm:max-w-[425px] bg-background border-primary">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase italic">Scanner {scanningFor === 'initial' ? 'Inicial' : 'Final'}</DialogTitle>
          </DialogHeader>
          <div className="relative overflow-hidden rounded-xl bg-black border-2 border-primary/20 aspect-square">
            <BarcodeScanner onScan={handleScan} paused={!scanningFor} />
          </div>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isIncrementAlertOpen} onOpenChange={setIsIncrementAlertOpen}>
        <AlertDialogContent className="bg-card border-primary">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase italic">Adicionar Unidade</AlertDialogTitle>
            <AlertDialogDescription className="text-white">
              Deseja adicionar +1 à categoria <span className="text-primary font-black uppercase">{categoryToIncrement}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10">Não</AlertDialogCancel>
            <AlertDialogAction onClick={confirmIncrement}>Sim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isClearAlertOpen} onOpenChange={setIsClearAlertOpen}>
        <AlertDialogContent className="bg-card border-destructive">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase italic text-destructive">Limpar Dados</AlertDialogTitle>
            <AlertDialogDescription className="text-white">
              Isso apagará todas as contagens atuais do sistema e da memória local. Tem certeza?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { clearSession(); setIsClearAlertOpen(false); }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir Tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

