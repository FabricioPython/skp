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
import { useFirebase } from "@/firebase";
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { useCollection } from "@/firebase";

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

  const reportsCollection = firestore ? collection(firestore, 'reports') : null;
  const { data: savedReports, loading: reportsLoading } = useCollection<SavedReport>(reportsCollection);

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);


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

  const handleGenerateAndSaveReport = async () => {
    if (!firestore || !agencyName || !reportDate || !grandTotal) return;

    const reportData = {
      agencyNumber,
      agencyName,
      reportDate,
      savedCounts: Object.fromEntries(
        Object.entries(savedCounts).map(([key, value]) => [key, value.toString()])
      ),
      sequencePairs,
      grandTotal: grandTotal.toString(),
      createdAt: serverTimestamp(),
    };

    try {
      if (reportsCollection) {
        await addDoc(reportsCollection, reportData);
        toast({
          title: "Relatório Salvo!",
          description: "Seu relatório de contagem foi salvo com sucesso.",
        });
        // Clear current report data after saving
        setSavedCounts({});
        setSequencePairs({});
        setAgencyNumber("");
        setAgencyName(null);
        setReportDate(null);
      }
    } catch (e) {
      console.error("Erro ao salvar relatório: ", e);
      toast({
        title: "Erro ao Salvar",
        description: "Não foi possível salvar o relatório. Tente novamente.",
        variant: "destructive",
      });
    }
  };
  
  const handleDeleteReport = async () => {
    if (!firestore || !reportToDelete) return;
    try {
      if (reportsCollection) {
        await deleteDoc(doc(firestore, "reports", reportToDelete));
        toast({
          title: "Relatório Excluído",
          description: "O relatório foi excluído com sucesso.",
        });
      }
    } catch (error) {
      console.error("Erro ao excluir relatório: ", error);
      toast({
        title: "Erro ao Excluir",
        description: "Não foi possível excluir o relatório.",
        variant: "destructive",
      });
    } finally {
      setIsDeleteAlertOpen(false);
      setReportToDelete(null);
    }
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

    try {
      const canvas = await html2canvas(reportRef.current, {
        useCORS: true,
        backgroundColor: null,
      });
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
              text: `Aqui está o relatório de contagem de caixas para ${agencyName} em ${reportDate}.`,
            });
            await handleGenerateAndSaveReport();
          } catch (shareError) {
             console.log("Compartilhamento cancelado ou falhou", shareError)
             // Even if sharing fails, we save the report
             await handleGenerateAndSaveReport();
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
          await handleGenerateAndSaveReport();
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
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 bg-gray-50">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-4xl font-bold font-headline text-primary">
            counterSKP
          </h1>
          <p className="text-muted-foreground mt-2">
            Digitalize códigos de barras para contar a quantidade de caixas.
          </p>
        </header>

        <Card className="shadow-lg bg-white rounded-xl">
          <CardHeader>
            <CardTitle>Leitura de Código de Barras</CardTitle>
            <CardDescription>
              Digitalize o código de barras do primeiro e do último item para calcular o total.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Código de Barras Inicial
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
                Código de Barras Final
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
                <RefreshCcw className="mr-2 h-4 w-4" /> Reiniciar
              </Button>
            )}
          </CardFooter>
        </Card>
        
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {count !== null && (
          <Card className="shadow-lg bg-white rounded-xl">
            <CardHeader>
              <CardTitle>Resultado da Contagem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-accent text-accent-foreground rounded-xl p-4">
                <p className="text-center text-xl">Total de Itens</p>
                <p className="text-center text-7xl font-bold">{count.toString()}</p>
              </div>
              <div>
                <Label>Selecione a Categoria para Salvar</Label>
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
                Totais por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
               {ALL_CATEGORIES.map((cat) => (
                <div key={cat} className="flex justify-between items-center bg-muted p-2 rounded-md">
                  <span className="font-medium">Tipo {cat.toUpperCase()}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{(savedCounts[cat] || 0n).toString()}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleIncrementClick(cat)}>
                      <PlusCircle className="h-5 w-5 text-green-500" />
                    </Button>
                  </div>
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
              <CardTitle>Gerar Relatório</CardTitle>
              <CardDescription>Encontre uma agência para gerar um relatório final.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Digite o número da agência"
                  value={agencyNumber}
                  onChange={(e) => setAgencyNumber(e.target.value)}
                  disabled={isFetchingAgency}
                />
                <Button onClick={handleFetchAgency} disabled={isFetchingAgency || !agencyNumber}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              {isFetchingAgency && <p className="text-center text-sm text-muted-foreground">Carregando...</p>}
              {agencyError && (
                <Alert variant="destructive">
                  <AlertTitle>Erro</AlertTitle>
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
                Resumo de contagem de caixas.
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
                  {ALL_CATEGORIES.map((cat) => (
                    <div key={cat} className="flex justify-between items-center bg-muted p-2 rounded-md">
                      <span className="font-medium">Tipo {cat.toUpperCase()}</span>
                      <span className="font-bold text-lg">{(savedCounts[cat] || 0n).toString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center bg-muted p-2 rounded-md">
                    <span className="font-medium">Tipo AB</span>
                    <span className="font-bold text-lg">{((savedCounts.a || 0n) + (savedCounts.b || 0n)).toString()}</span>
                  </div>
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
                <Share2 className="mr-2 h-4 w-4" /> Compartilhar e Salvar
              </Button>
            </CardFooter>
          </Card>
        )}

        {sortedReports && sortedReports.length > 0 && (
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Relatórios Salvos</CardTitle>
              <CardDescription>Veja os relatórios de contagem anteriores.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {reportsLoading ? (
                <p>Carregando relatórios...</p>
              ) : (
                sortedReports.map((report) => (
                  <Card key={report.id} className="bg-white shadow-md">
                    <CardHeader>
                      <CardTitle className="flex justify-between items-center text-lg">
                        <span>{report.agencyName}</span>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteConfirmation(report.id)}>
                          <Trash2 className="h-5 w-5 text-destructive" />
                        </Button>
                      </CardTitle>
                      <CardDescription>
                        {report.agencyNumber} - {report.createdAt ? new Date(report.createdAt.toDate()).toLocaleDateString('pt-BR') : 'Data inválida'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {ALL_CATEGORIES.map(cat => (
                        <div key={cat} className="flex justify-between items-center text-sm">
                          <span>Tipo {cat.toUpperCase()}:</span>
                          <span className="font-medium">{(report.savedCounts[cat] || '0')}</span>
                        </div>
                      ))}
                       <div className="flex justify-between items-center text-sm">
                          <span>Tipo AB:</span>
                          <span className="font-medium">
                            {(BigInt(report.savedCounts.a || '0') + BigInt(report.savedCounts.b || '0')).toString()}
                          </span>
                        </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between items-center font-bold">
                          <span>Total Geral:</span>
                          <span>{report.grandTotal}</span>
                      </div>
                       {report.sequencePairs && Object.keys(report.sequencePairs).length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold">Sequências Lidas:</h4>
                          <ul className="text-xs text-muted-foreground list-disc list-inside">
                            {Object.entries(report.sequencePairs).map(([category, pairs]) =>
                              pairs.map((pair, index) => (
                                <li key={`${category}-${index}`}>
                                  <span className="font-mono">
                                    {category.toUpperCase()}: {pair.initial} - {pair.final}
                                  </span>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
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
                <div className="w-[90%] h-px bg-red-500/80 animate-pulse"></div>
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
