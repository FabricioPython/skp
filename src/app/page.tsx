
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Camera, RefreshCcw, Calculator, Save, Archive, Search, FileText, Share2, PlusCircle, Trash2 } from "lucide-react";
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
import { useFirebase } from "@/firebase/provider";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";

type ScanTarget = "initial" | "final";
const ALL_CATEGORIES = ['a', 'b', 'c'];

type SequencePair = { initial: string; final: string };

type SavedReport = {
  id: string;
  agencyNumber: string;
  agencyName: string;
  reportDate: string;
  savedCounts: Record<string, string>;
  sequencePairs: Record<string, SequencePair[]>;
  grandTotal: string;
  createdAt: {
    toDate: () => Date;
  } | null;
};


export default function Home() {
  const [initialCode, setInitialCode] = useState<string | null>(null);
  const [finalCode, setFinalCode] = useState<string | null>(null);
  const [scanningFor, setScanningFor] = useState<ScanTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<bigint | null>(null);
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

  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);


  useEffect(() => {
    if (agencyName) {
      setReportDate(new Date().toLocaleDateString('pt-BR'));
    }
  }, [agencyName]);
  
  useEffect(() => {
    if (!firestore) return;

    const reportsRef = collection(firestore, "reports");
    const q = query(reportsRef, orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const reports = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as SavedReport[];
        setSavedReports(reports);
    });

    return () => unsubscribe();
  }, [firestore]);


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
          setError("A sequência final deve ser maior que a sequência inicial.");
          setCount(null);
          return;
        }
        
        setError(null);
        setCount(finalNum - initialNum + 1n);
      } catch (e) {
        setError("Os códigos de barras devem conter números para calcular a contagem.");
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
    if (category && count !== null && initialCode && finalCode) {
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

  const handleGenerateAndSaveReport = async (currentReportDate: string) => {
    if (!agencyName || !currentReportDate || !grandTotal || !firestore) return;
  
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
        reportDate: currentReportDate,
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
  
    // Clear current report data
    setSavedCounts({});
    setSequencePairs({});
    setAgencyNumber("");
    setAgencyName(null);
    setReportDate(null);
  };
  
  const handleDeleteReport = async () => {
    if (!reportToDelete || !firestore) return;

    try {
      const reportDocRef = doc(firestore, 'reports', reportToDelete);
      await deleteDoc(reportDocRef);
      toast({
        title: 'Relatório Excluído',
        description: 'O relatório selecionado foi excluído com sucesso.',
      });
    } catch (error) {
      console.error('Error deleting report: ', error);
      toast({
        title: 'Erro ao Excluir',
        description: 'Não foi possível excluir o relatório.',
        variant: 'destructive',
      });
    }
    
    setIsDeleteAlertOpen(false);
    setReportToDelete(null);
  };

  const openDeleteConfirmation = (reportId: string) => {
    setReportToDelete(reportId);
    setIsDeleteAlertOpen(true);
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
    const shareDate = new Date().toLocaleDateString('pt-BR');
    if (!shareDate) {
        toast({
            title: "Erro",
            description: "Não foi possível obter a data atual.",
            variant: "destructive",
        });
        return;
    }

    try {
      // Temporarily set background to white for capture
      reportRef.current.style.backgroundColor = 'white';

      const canvas = await html2canvas(reportRef.current, {
        useCORS: true,
        scale: 2, // Increase resolution
      });
      
      // Revert background color
      reportRef.current.style.backgroundColor = '';

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast({
            title: "Erro",
            description: "Falha ao criar imagem do relatório.",
            variant: "destructive",
          });
          return;
        }

        const file = new File([blob], "relatorio-estoque.png", { type: "image/png" });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
             await navigator.share({
              files: [file],
              title: 'Relatório de Contagem de Estoque',
              text: `Aqui está o relatório de contagem de caixas para ${agencyName} em ${shareDate}.`,
            });
            await handleGenerateAndSaveReport(shareDate);
          } catch (shareError) {
             console.log("Compartilhamento cancelado ou falhou", shareError)
             // Even if sharing fails, we save the report and clear the session
             await handleGenerateAndSaveReport(shareDate);
          }
        } else {
          // Fallback for desktop or browsers that don't support sharing files
          const link = document.createElement('a');
          link.href = URL.createObjectURL(file);
          link.download = 'relatorio-estoque.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast({
            title: "Imagem Salva",
            description: "Imagem do relatório baixada. Você pode compartilhá-la manualmente.",
          });
          await handleGenerateAndSaveReport(shareDate);
        }
      }, 'image/png');
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

  const sortedReports = savedReports?.sort((a, b) => {
    const dateA = a.createdAt?.toDate()?.getTime() || 0;
    const dateB = b.createdAt?.toDate()?.getTime() || 0;
    return dateB - dateA;
  });

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 bg-secondary">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center py-4">
          <h1 className="text-4xl font-bold tracking-tight text-primary">
            counterSKP
          </h1>
          <p className="text-muted-foreground mt-2">
            Digitalize códigos de barras para contar a quantidade de caixas.
          </p>
        </header>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Leitura de Código de Barras</CardTitle>
            <CardDescription>
              Digitalize o código de barras do primeiro e do último item.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Código de Barras Inicial
              </Label>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center justify-center h-16 bg-muted rounded-lg px-3 border border-dashed">
                  <p className="text-lg font-mono tracking-wider text-foreground break-all text-center">
                    {initialCode || "..."}
                  </p>
                </div>
                <Button variant="outline" size="icon" className="h-16 w-16 flex-shrink-0" onClick={() => setScanningFor("initial")}>
                  <Camera className="h-6 w-6" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Código de Barras Final
              </Label>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center justify-center h-16 bg-muted rounded-lg px-3 border border-dashed">
                  <p className="text-lg font-mono tracking-wider text-foreground break-all text-center">
                    {finalCode || "..."}
                  </p>
                </div>
                <Button variant="outline" size="icon" className="h-16 w-16 flex-shrink-0" onClick={() => setScanningFor("final")} disabled={!initialCode}>
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
        
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Erro na Contagem</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {count !== null && (
          <Card className="shadow-lg animate-in fade-in-50">
            <CardHeader>
              <CardTitle>Resultado da Contagem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-primary/10 border-2 border-primary/20 border-dashed text-primary rounded-xl p-4">
                <p className="text-center text-lg">Total de Itens</p>
                <p className="text-center text-7xl font-bold tracking-tighter">{count.toString()}</p>
              </div>
              <div>
                <Label className="mb-3 block text-center">Selecione a Categoria para Salvar</Label>
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
              <Button size="lg" onClick={handleSave} disabled={!category} className="w-full">
                <Save className="mr-2 h-4 w-4" /> Salvar Contagem
              </Button>
            </CardFooter>
          </Card>
        )}

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
                <div key={cat} className="flex justify-between items-center bg-muted p-3 rounded-lg">
                  <span className="font-medium text-lg">Tipo {cat.toUpperCase()}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-2xl tracking-tight">{(savedCounts[cat] || 0n).toString()}</span>
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
            <Card ref={reportRef} className="shadow-xl border-primary/20">
              <CardHeader className="bg-primary/5">
                <CardTitle className="flex items-center gap-2 text-xl text-primary">
                  <FileText className="h-6 w-6" />
                  Relatório de Contagem
                </CardTitle>
                <CardDescription>
                  Resumo de contagem de caixas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="space-y-1 text-sm">
                  <p><span className="font-semibold">Agência:</span> {agencyName} ({agencyNumber})</p>
                  <p><span className="font-semibold">Data:</span> {reportDate}</p>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-2 text-base">Totais por Categoria:</h4>
                  <div className="space-y-2">
                    {ALL_CATEGORIES.map((cat) => (
                      <div key={cat} className="flex justify-between items-center bg-muted p-3 rounded-md">
                        <span className="font-medium">Tipo {cat.toUpperCase()}</span>
                        <span className="font-bold text-lg">{(savedCounts[cat] || 0n).toString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center bg-muted p-3 rounded-md">
                      <span className="font-medium">Tipo AB</span>
                      <span className="font-bold text-lg">{((savedCounts.a || 0n) + (savedCounts.b || 0n)).toString()}</span>
                    </div>
                  </div>
                </div>
                 {Object.keys(sequencePairs).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2 text-base">Sequências Lidas:</h4>
                      <div className="space-y-3 text-xs font-mono">
                        {ALL_CATEGORIES.map(cat => (
                          sequencePairs[cat] && sequencePairs[cat].length > 0 && (
                            <div key={cat}>
                              <p className="font-semibold mb-1 text-sm">Tipo {cat.toUpperCase()}:</p>
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
                <div className="flex justify-between items-center p-4 rounded-lg bg-primary text-primary-foreground">
                  <span className="font-bold text-lg">Total Geral</span>
                  <span className="font-extrabold text-2xl tracking-tight">{grandTotal.toString()}</span>
                </div>
              </CardContent>
            </Card>
            <Button onClick={handleShare} className="w-full h-12 text-base" size="lg" variant="default">
              <Share2 className="mr-2 h-5 w-5" /> Compartilhar e Finalizar
            </Button>
          </div>
        )}
        
        {sortedReports && sortedReports.length > 0 && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Relatórios Salvos</CardTitle>
              <CardDescription>
                Relatórios salvos de sessões anteriores.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sortedReports.map((report) => (
                <div key={report.id} className="border p-4 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{report.agencyName}</p>
                    <p className="text-sm text-muted-foreground">
                      {report.reportDate} - Total: {report.grandTotal}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openDeleteConfirmation(report.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

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
              Você tem certeza que deseja adicionar 1 à contagem de <strong>Tipo {categoryToIncrement?.toUpperCase()}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmIncrement}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja excluir este relatório? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReport} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

    