
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, FileText, Calendar, Building2, Calculator, ListTree, ArrowRight, Copy, FileDown, Cloud, AlertCircle, RefreshCcw } from "lucide-react";
import Link from "next/link";
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
import { jsPDF } from "jspdf";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  createdAt?: string;
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("a");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/reports", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Não foi possível carregar os relatórios do arquivo JSON.");
      }
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Erro ao carregar relatórios:", err);
      setError("Não foi possível carregar o histórico a partir do arquivo JSON.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const generateReportPDF = (report: Report) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(0, 86, 179);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE AGÊNCIA", 15, 20);
    
    doc.setFontSize(10);
    doc.text("countSKP", 15, 28);
    
    doc.setFontSize(12);
    doc.text(`Agência: ${report.agencyName} (${report.agencyNumber})`, 15, 36);
    doc.text(`Data: ${report.reportDate}`, 150, 36);
    
    // Resumo
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text("Resumo", 15, 55);
    doc.setDrawColor(0, 86, 179);
    doc.setLineWidth(0.5);
    doc.line(15, 58, 200, 58);
    
    let y = 70;
    ['a', 'b', 'c'].forEach(cat => {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Tipo ${cat.toUpperCase()}:`, 15, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${report.savedCounts[cat] || "0"} unidades`, 70, y);
      y += 10;
    });
    
    y += 5;
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, 180, 15, 'F');
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL DE ITENS:", 20, y + 10);
    doc.setTextColor(0, 86, 179);
    doc.text(`${report.grandTotal}`, 150, y + 10);
    
    // Sequências
    y += 30;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text("Sequências Lidas", 15, y);
    doc.line(15, y + 3, 200, y + 3);
    y += 15;
    
    // Cabeçalho da Tabela
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("TIPO", 15, y);
    doc.text("INÍCIO", 40, y);
    doc.text("FIM", 100, y);
    doc.text("SUBTOTAL", 165, y);
    doc.line(15, y + 2, 200, y + 2);
    y += 10;
    
    doc.setFont("helvetica", "normal");
    Object.entries(report.sequencePairs || {}).forEach(([cat, pairs]) => {
      pairs.forEach((pair) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
          doc.setFont("helvetica", "bold");
          doc.text("TIPO", 15, y);
          doc.text("INÍCIO", 40, y);
          doc.text("FIM", 100, y);
          doc.text("SUBTOTAL", 165, y);
          doc.line(15, y + 2, 200, y + 2);
          y += 10;
          doc.setFont("helvetica", "normal");
        }
        try {
          const diff = BigInt(pair.final) - BigInt(pair.initial) + 1n;
          doc.text(cat.toUpperCase(), 15, y);
          doc.text(pair.initial, 40, y);
          doc.text(pair.final, 100, y);
          doc.text(diff.toString(), 165, y);
          y += 8;
        } catch(e) {
          y += 8;
        }
      });
    });
    
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`, 15, 285);
    
    doc.save(`Relatorio_Agencia_${report.agencyNumber}.pdf`);
    
    toast({
      title: "PDF Gerado",
      description: "O download do relatório foi iniciado.",
    });
  };

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
        <div className="text-center space-y-4">
            <Cloud className="h-12 w-12 text-primary mx-auto animate-bounce" />
            <p className="text-2xl font-black italic uppercase text-primary animate-pulse">Carregando Histórico...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
        <main className="flex min-h-screen flex-col items-center p-8 bg-background">
             <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro no Histórico</AlertTitle>
                <AlertDescription>
                    {error}
                </AlertDescription>
            </Alert>
            <div className="flex gap-4 mt-4">
              <Button onClick={fetchReports}>Tentar Novamente</Button>
              <Button variant="outline" asChild>
                <Link href="/">Voltar ao Início</Link>
              </Button>
            </div>
        </main>
    );
  }

  const currentSequences = selectedReport?.sequencePairs?.[selectedCategory] || [];

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 bg-background">
      <div className="w-full max-w-4xl space-y-6">
        <header className="flex flex-col sm:flex-row items-center justify-between py-6 border-b border-white/10 gap-4">
          <Button variant="ghost" asChild className="text-white/60 hover:text-primary">
            <Link href="/" className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
          <div className="text-center">
            <h1 className="text-3xl font-black italic uppercase text-primary tracking-tighter">Histórico de Relatórios</h1>
            <p className="flex items-center justify-center gap-2 text-[10px] text-white/40 uppercase font-bold tracking-widest mt-1">
              <Cloud className="h-3 w-3" /> Base de Dados em Arquivo JSON
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchReports} className="border-white/10 text-white/70 hover:text-primary">
            <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Atualizar
          </Button>
        </header>

        {!reports || reports.length === 0 ? (
          <div className="text-center py-20 bg-card/50 rounded-xl border border-white/5">
            <FileText className="h-16 w-16 mx-auto text-white/20 mb-4" />
            <p className="text-white/40 font-bold uppercase">Nenhum relatório encontrado no arquivo de histórico.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {reports.map((report) => (
              <Card key={report.id} className="bg-card/50 border-white/5 hover:border-primary/50 transition-all group">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl font-black italic uppercase tracking-tighter group-hover:text-primary transition-colors">
                        {report.agencyName}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 text-white/60 font-bold">
                        <Calendar className="h-3 w-3" />
                        {report.reportDate} | Ag. {report.agencyNumber}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black italic text-primary">
                        {report.grandTotal}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Total Geral</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    {['a', 'b', 'c'].map((cat) => (
                      <div key={cat} className="bg-black/40 p-3 rounded-xl border border-white/5 text-center">
                        <span className="text-[10px] font-black block uppercase tracking-widest text-primary mb-1">{cat}</span>
                        <span className="text-xl font-mono font-bold">{report.savedCounts[cat] || "0"}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="border-t border-white/5 pt-4 flex flex-col gap-2">
                  <Button 
                    className="w-full bg-primary text-background hover:bg-primary/90 font-black uppercase italic" 
                    onClick={() => generateReportPDF(report)}
                  >
                    <FileDown className="mr-2 h-4 w-4" /> Gerar Relatório Completo (PDF)
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full border-primary/20 hover:bg-white/5 text-white/60 font-black uppercase italic" 
                    onClick={() => handleOpenSequences(report)}
                  >
                    <ListTree className="mr-2 h-4 w-4" /> Ver Sequências no App
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="sm:max-w-[450px] bg-card border-primary">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase">Sequências do Relatório</DialogTitle>
            <DialogDescription className="text-white/60">
              Intervalos lidos para a agência {selectedReport?.agencyName}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-primary tracking-widest">Filtrar por Categoria</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="bg-background border-white/10 font-bold uppercase italic">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-primary">
                  <SelectItem value="a" className="font-bold uppercase italic">Tipo A</SelectItem>
                  <SelectItem value="b" className="font-bold uppercase italic">Tipo B</SelectItem>
                  <SelectItem value="c" className="font-bold uppercase italic">Tipo C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-[350px] w-full rounded-xl border border-white/10 p-4 bg-black/20">
              {currentSequences.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-white/20">
                  <Calculator className="h-12 w-12 mb-2" />
                  <p className="font-bold uppercase">Nenhum dado lido</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentSequences.map((pair, idx) => {
                    let diff = "0";
                    try {
                        diff = (BigInt(pair.final) - BigInt(pair.initial) + 1n).toString();
                    } catch(e) {}
                    
                    return (
                      <div key={idx} className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4 hover:border-primary/30 transition-all">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">Item {idx + 1}</span>
                          <span className="bg-primary text-background px-3 py-1 rounded-full text-[10px] font-black uppercase italic">{diff} ITENS</span>
                        </div>
                        <div className="flex items-center justify-between font-mono text-lg font-bold text-white/90">
                          <div className="flex flex-col items-center">
                             <span className="text-[8px] uppercase text-white/40 mb-1">Início</span>
                             <span>{pair.initial}</span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-primary" />
                          <div className="flex flex-col items-center">
                             <span className="text-[8px] uppercase text-white/40 mb-1">Fim</span>
                             <span>{pair.final}</span>
                          </div>
                        </div>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="w-full h-10 text-xs font-black uppercase italic bg-white/10 hover:bg-primary hover:text-background"
                          onClick={() => handleCopySequenceList(pair.initial, pair.final)}
                        >
                          <Copy className="h-3 w-3 mr-2" /> Copiar Lista Completa
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
          
          <Button variant="ghost" onClick={() => setSelectedReport(null)} className="w-full text-white/40 hover:text-white">
            Fechar
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
