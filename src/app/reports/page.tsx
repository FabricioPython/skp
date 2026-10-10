
"use client";

import { useFirebase } from "@/firebase/provider";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, orderBy, Timestamp } from "firebase/firestore";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, FileText, Calendar, Building2, Calculator } from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

interface Report {
  id: string;
  agencyNumber: string;
  agencyName: string;
  reportDate: string;
  grandTotal: string;
  savedCounts: Record<string, string>;
  createdAt: Timestamp;
}

export default function ReportsPage() {
  const { firestore } = useFirebase();

  const reportsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "reports"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const { data: reports, loading, error } = useCollection<Report>(reportsQuery as any);

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
              <Card key={report.id} className="shadow-md hover:shadow-lg transition-shadow">
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
                    {Object.entries(report.savedCounts).map(([cat, val]) => (
                      <div key={cat} className="bg-muted/50 p-2 rounded-md text-center">
                        <span className="text-xs font-semibold block text-muted-foreground uppercase">{cat}</span>
                        <span className="text-lg font-bold">{val}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
