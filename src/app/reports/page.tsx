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
          description: "Intervalo muito grande para copiar.",
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
        title: "Copiado",
        description: `${diff.toString()} códigos copiados.`,
      });
    } catch (e) {
      toast({
        title: "Erro",
        description: "Falha ao gerar lista.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-lg font-bold animate-pulse">Carregando...</p>
      </div>
    );
  }

  const currentSequences = selectedReport?.sequencePairs?.[selectedCategory] || [];

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 bg-background">
      <div className="w-full max-w-4xl space-y-6">
        <header className="flex items-center justify-between py-6 border-b">
          <Button variant="ghost" asChild>
            <Link href="/" className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-primary uppercase">Histórico</h1>
          <div className="w-20"></div>
        </header>

        {!reports || reports.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-lg border">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum relatório salvo.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {reports.map((report) => (
              <Card key={report.id} className="hover:border-primary transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg font-bold uppercase">
                        {report.agencyName}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {report.reportDate} | Ag. {report.agencyNumber}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-primary">
                        {report.grandTotal}
                      </div>
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Total</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {['a', 'b', 'c'].map((cat) => (
                      <div key={cat} className="bg-secondary/20 p-2 rounded text-center">
                        <span className="text-[10px] font-bold block uppercase text-muted-foreground">{cat}</span>
                        <span className="font-bold">{report.savedCounts[cat] || "0"}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="border-t pt-4">
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => handleOpenSequences(report)}
                  >
                    <ListTree className="mr-2 h-4 w-4" /> Sequências
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Sequências do Relatório</DialogTitle>
            <DialogDescription>
              Intervalos lidos para a agência {selectedReport?.agencyName}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Selecione a Categoria</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a">Categoria A</SelectItem>
                  <SelectItem value="b">Categoria B</SelectItem>
                  <SelectItem value="c">Categoria C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-[300px] w-full rounded border p-2">
              {currentSequences.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Calculator className="h-8 w-8 mb-2" />
                  <p>Nenhuma sequência</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {currentSequences.map((pair, idx) => {
                    const diff = BigInt(pair.final) - BigInt(pair.initial) + 1n;
                    return (
                      <div key={idx} className="bg-muted/30 p-3 rounded border space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="uppercase text-primary">Item {idx + 1}</span>
                          <span className="bg-primary text-primary-foreground px-2 rounded">{diff.toString()} ITENS</span>
                        </div>
                        <div className="flex items-center justify-between font-mono text-sm">
                          <span>{pair.initial}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span>{pair.final}</span>
                        </div>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="w-full h-8 text-xs"
                          onClick={() => handleCopySequenceList(pair.initial, pair.final)}
                        >
                          <Copy className="h-3 w-3 mr-2" /> Copiar Lista
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
          
          <Button variant="ghost" onClick={() => setSelectedReport(null)} className="w-full">
            Fechar
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
