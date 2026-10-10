
"use client";

import { useFirebase } from "@/firebase/provider";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, orderBy, Timestamp } from "firebase/firestore";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, FileText, Calendar, Building2, Calculator, ListTree, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SequencePair {
  initial: string;
  final: string;
}

interface Report {
  id: string;
  agencyNumber: string;
  agencyName: string;
  reportDate: string;
  grandTotal: string;
  savedCounts: Record<string, string>;
  sequencePairs: Record<string, SequencePair[]>;
  createdAt: Timestamp;
}

export default function ReportsPage() {
  const { firestore } = useFirebase();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("a");

  const reportsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "reports"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const { data: reports, loading, error } = useCollection<Report>(reportsQuery as any);

  const handleOpenSequences = (report: Report) => {
    setSelectedReport(report);
    // Tenta selecionar a primeira categoria que tenha dados
    const categories = ['a', 'b', 'c'];
    const firstWithData = categories.find(cat => report.sequencePairs?.[cat]?.length > 0) || 'a';
    setSelectedCategory(firstWithData);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-lg animate-pulse">Carregando histórico...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-4 text-center">
        <div>
          <h2 className="text-2xl font-bold text-destructive mb-2">Erro ao carregar histórico</h2>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <Button asChild>
            <Link href="/">Voltar para o Início</Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentSequences = selectedReport?.sequencePairs?.[selectedCategory] || [];

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 bg-background text-foreground">
      <div className="w-full max-w-4xl space-y-6">
        <header className="flex items-center justify-between py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Histórico de Contagens</h1>
          <div className="w-10"></div>
        </header>

        {!reports || reports.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-20" />
              <p className="text-lg text-muted-foreground">Nenhum relatório salvo ainda.</p>
              <Button asChild className="mt-4" variant="outline">
                <Link href="/">Começar uma contagem</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {reports.map((report) => (
              <Card key={report.id} className="shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {report.agencyName}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        {report.reportDate} (Agência {report.agencyNumber})
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary flex items-center gap-1 justify-end">
                        <Calculator className="h-5 w-5" />
                        {report.grandTotal}
                      </div>
                      <span className="text-xs text-muted-foreground">Total Geral</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Separator className="my-2" />
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {['a', 'b', 'c'].map((cat) => (
                      <div key={cat} className="bg-muted/50 p-2 rounded-md text-center">
                        <span className="text-xs font-semibold block text-muted-foreground uppercase">{cat}</span>
                        <span className="text-lg font-bold">{report.savedCounts[cat] || "0"}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/30 pt-4">
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => handleOpenSequences(report)}
                  >
                    <ListTree className="mr-2 h-4 w-4" /> Gerar Sequência
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Sequências do Relatório</DialogTitle>
            <DialogDescription>
              Selecione a categoria para ver os intervalos completos de códigos lidos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <span className="text-sm font-medium">Categoria</span>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a">Categoria A</SelectItem>
                  <SelectItem value="b">Categoria B</SelectItem>
                  <SelectItem value="c">Categoria C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <ScrollArea className="h-[300px] w-full rounded-md border p-4">
              {currentSequences.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma sequência registrada nesta categoria.</p>
              ) : (
                <div className="space-y-3">
                  {currentSequences.map((pair, idx) => {
                    const diff = BigInt(pair.final) - BigInt(pair.initial) + 1n;
                    return (
                      <div key={idx} className="bg-muted/40 p-3 rounded-lg border flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase">
                          <span>Intervalo {idx + 1}</span>
                          <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full">{diff.toString()} itens</span>
                        </div>
                        <div className="flex items-center justify-between font-mono text-sm">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase mb-1">Início</span>
                            <span>{pair.initial}</span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col text-right">
                            <span className="text-[10px] text-muted-foreground uppercase mb-1">Fim</span>
                            <span>{pair.final}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={() => setSelectedReport(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
