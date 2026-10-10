"use client";

import { useFirebase } from "@/firebase/provider";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, orderBy, Timestamp } from "firebase/firestore";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, FileText, Calendar, Building2, Calculator, ListTree, ArrowRight, Copy } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("a");

  const reportsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "reports"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const { data: reports, loading, error } = useCollection<Report>(reportsQuery as any);

  const handleOpenSequences = (report: Report) => {
    setSelectedReport(report);
    const categories = ['a', 'b', 'c'];
    const firstWithData = categories.find(cat => report.sequencePairs?.[cat]?.length > 0) || 'a';
    setSelectedCategory(firstWithData);
  };

  const handleCopySequenceList = (initial: string, final: string) => {
    try {
      const start = BigInt(initial);
      const end = BigInt(final);
      const diff = end - start + 1n;

      if (diff > 5000n) {
        toast({
          title: "Limite Excedido",
          description: "O intervalo é muito grande para cópia total.",
          variant: "destructive",
        });
        return;
      }

      const list: string[] = [];
      for (let i = start; i <= end; i++) {
        list.push(i.toString());
      }
      
      const textToCopy = list.join('\n');
      navigator.clipboard.writeText(textToCopy);
      
      toast({
        title: "Copiado!",
        description: `${diff.toString()} códigos copiados com sucesso.`,
      });
    } catch (e) {
      toast({
        title: "Erro",
        description: "Não foi possível gerar a lista.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-2xl font-black animate-pulse text-primary uppercase tracking-widest">Carregando Histórico...</p>
      </div>
    );
  }

  const currentSequences = selectedReport?.sequencePairs?.[selectedCategory] || [];

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 bg-background text-foreground">
      <div className="w-full max-w-4xl space-y-8">
        <header className="flex items-center justify-between py-6 border-b border-white/10">
          <Button variant="ghost" size="lg" asChild className="font-bold hover:bg-white/5">
            <Link href="/" className="flex items-center gap-2">
              <ChevronLeft className="h-6 w-6" /> Voltar
            </Link>
          </Button>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-primary uppercase">Histórico</h1>
          <div className="w-20 sm:w-24"></div>
        </header>

        {!reports || reports.length === 0 ? (
          <Card className="text-center py-20 bg-card border-0 shadow-2xl ring-1 ring-white/10">
            <CardContent>
              <FileText className="h-20 w-20 mx-auto text-muted-foreground/20 mb-6" />
              <p className="text-xl font-bold text-muted-foreground">Nenhum relatório encontrado.</p>
              <Button asChild className="mt-8 font-bold" variant="outline" size="lg">
                <Link href="/">Iniciar Contagem</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {reports.map((report) => (
              <Card key={report.id} className="shadow-2xl border-0 ring-1 ring-white/10 overflow-hidden hover:ring-primary/50 transition-all duration-300">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-primary" />
                        {report.agencyName}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 text-base font-bold text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {report.reportDate} <span className="text-primary/50">•</span> Ag. {report.agencyNumber}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black text-primary tracking-tighter flex items-center gap-1 justify-end">
                        {report.grandTotal}
                      </div>
                      <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Total Itens</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Separator className="mb-6 opacity-10" />
                  <div className="grid grid-cols-3 gap-4">
                    {['a', 'b', 'c'].map((cat) => (
                      <div key={cat} className="bg-secondary/30 p-4 rounded-xl text-center border-2 border-white/5">
                        <span className="text-xs font-black block text-primary uppercase tracking-[0.2em] mb-1">{cat}</span>
                        <span className="text-2xl font-black">{report.savedCounts[cat] || "0"}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="bg-white/5 pt-4">
                  <Button 
                    variant="outline" 
                    className="w-full h-12 text-base font-bold uppercase tracking-wider border-2" 
                    onClick={() => handleOpenSequences(report)}
                  >
                    <ListTree className="mr-2 h-5 w-5" /> Detalhar Sequências
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
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Explorar Sequências</DialogTitle>
            <DialogDescription className="text-base font-medium">
              Escolha uma categoria para visualizar e copiar os intervalos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Categoria Alvo</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-12 text-lg font-bold border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a" className="font-bold">Categoria A</SelectItem>
                  <SelectItem value="b" className="font-bold">Categoria B</SelectItem>
                  <SelectItem value="c" className="font-bold">Categoria C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <ScrollArea className="h-[400px] w-full rounded-xl border-2 p-4 bg-muted/20">
              {currentSequences.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
                  <Calculator className="h-12 w-12 mb-4" />
                  <p className="font-bold">Sem registros para esta categoria.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentSequences.map((pair, idx) => {
                    const diff = BigInt(pair.final) - BigInt(pair.initial) + 1n;
                    return (
                      <div key={idx} className="bg-background p-4 rounded-xl border-2 flex flex-col gap-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-widest text-primary">Sequência {idx + 1}</span>
                          <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-black uppercase">{diff.toString()} ITENS</span>
                        </div>
                        <div className="flex items-center justify-between font-mono text-base font-bold bg-muted/50 p-3 rounded-lg">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase text-muted-foreground">De</span>
                            <span className="tracking-tighter">{pair.initial}</span>
                          </div>
                          <ArrowRight className="h-5 w-5 text-primary" />
                          <div className="flex flex-col gap-1 text-right">
                            <span className="text-[10px] uppercase text-muted-foreground">Até</span>
                            <span className="tracking-tighter">{pair.final}</span>
                          </div>
                        </div>
                        <Button 
                          variant="secondary" 
                          size="lg" 
                          className="w-full text-sm font-black uppercase tracking-wider h-12"
                          onClick={() => handleCopySequenceList(pair.initial, pair.final)}
                        >
                          <Copy className="h-4 w-4 mr-2" /> Copiar Lista Integral
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
          
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setSelectedReport(null)} className="font-bold h-12 px-8 border-2">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
