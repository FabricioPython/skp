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
import { Label } from "@/components/ui/label";
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
        <p className="text-xl font-bold animate-pulse text-primary uppercase tracking-widest">Carregando Histórico...</p>
      </div>
    );
  }

  const currentSequences = selectedReport?.sequencePairs?.[selectedCategory] || [];

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 bg-background text-foreground">
      <div className="w-full max-w-4xl space-y-6">
        <header className="flex items-center justify-between py-6 border-b border-white/10">
          <Button variant="ghost" size="lg" asChild className="font-semibold">
            <Link href="/" className="flex items-center gap-2">
              <ChevronLeft className="h-5 w-5" /> Voltar
            </Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary uppercase">Histórico</h1>
          <div className="w-20"></div>
        </header>

        {!reports || reports.length === 0 ? (
          <Card className="text-center py-20 bg-card border-0 shadow-lg ring-1 ring-white/10">
            <CardContent>
              <FileText className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
              <p className="text-lg font-semibold text-muted-foreground">Nenhum relatório encontrado.</p>
              <Button asChild className="mt-6 font-bold" variant="outline">
                <Link href="/">Iniciar Contagem</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {reports.map((report) => (
              <Card key={report.id} className="shadow-lg border-0 ring-1 ring-white/10 overflow-hidden hover:ring-primary/40 transition-all">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {report.agencyName}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 font-semibold">
                        <Calendar className="h-4 w-4" />
                        {report.reportDate} <span className="text-primary/30">•</span> Ag. {report.agencyNumber}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary tracking-tight">
                        {report.grandTotal}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Total</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Separator className="mb-4 opacity-10" />
                  <div className="grid grid-cols-3 gap-3">
                    {['a', 'b', 'c'].map((cat) => (
                      <div key={cat} className="bg-secondary/20 p-3 rounded-lg text-center border border-white/5">
                        <span className="text-[10px] font-bold block text-primary uppercase tracking-widest mb-1">{cat}</span>
                        <span className="text-xl font-bold">{report.savedCounts[cat] || "0"}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="bg-white/5 pt-4">
                  <Button 
                    variant="outline" 
                    className="w-full h-10 font-bold uppercase tracking-wider text-xs" 
                    onClick={() => handleOpenSequences(report)}
                  >
                    <ListTree className="mr-2 h-4 w-4" /> Detalhar Sequências
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        {/* O Dialog de sequências mantém o alto contraste pois é parte do detalhamento técnico */}
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Explorar Sequências</DialogTitle>
            <DialogDescription className="font-semibold">
              Intervalos registrados no relatório.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Categoria</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-12 text-lg font-bold">
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

            <ScrollArea className="h-[400px] w-full rounded-xl border p-4 bg-muted/10">
              {currentSequences.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/30">
                  <Calculator className="h-12 w-12 mb-2" />
                  <p className="font-bold">Vazio</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentSequences.map((pair, idx) => {
                    const diff = BigInt(pair.final) - BigInt(pair.initial) + 1n;
                    return (
                      <div key={idx} className="bg-background p-4 rounded-xl border-2 flex flex-col gap-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">Item {idx + 1}</span>
                          <span className="bg-primary text-primary-foreground px-3 py-0.5 rounded-full text-[10px] font-black uppercase">{diff.toString()} ITENS</span>
                        </div>
                        <div className="flex items-center justify-between font-mono text-base font-bold bg-muted/30 p-3 rounded-lg">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase text-muted-foreground">Início</span>
                            <span className="tracking-tighter">{pair.initial}</span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-primary" />
                          <div className="flex flex-col gap-1 text-right">
                            <span className="text-[10px] uppercase text-muted-foreground">Fim</span>
                            <span className="tracking-tighter">{pair.final}</span>
                          </div>
                        </div>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="w-full font-black uppercase tracking-widest h-10 text-[10px]"
                          onClick={() => handleCopySequenceList(pair.initial, pair.final)}
                        >
                          <Copy className="h-3.5 w-3.5 mr-2" /> Copiar Lista
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
          
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setSelectedReport(null)} className="font-bold h-10 px-8">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
