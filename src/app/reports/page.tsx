
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase/provider";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function ReportsPage() {
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!firestore) return;

    const reportsRef = collection(firestore, "reports");
    const q = query(reportsRef, orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const reports = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as SavedReport[];
        setSavedReports(reports);
        setLoading(false);
    }, (error) => {
      console.error("Error fetching reports:", error);
      toast({
        title: "Erro ao buscar relatórios",
        description: "Não foi possível carregar os relatórios salvos.",
        variant: "destructive",
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, toast]);

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

  const sortedReports = savedReports?.sort((a, b) => {
    const dateA = a.createdAt?.toDate()?.getTime() || 0;
    const dateB = b.createdAt?.toDate()?.getTime() || 0;
    return dateB - dateA;
  });

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 bg-secondary">
      <div className="w-full max-w-md space-y-6">
        <header className="relative flex items-center justify-center py-4">
          <Link href="/" passHref>
            <Button variant="outline" size="icon" className="absolute left-0">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Voltar</span>
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Relatórios Salvos
          </h1>
        </header>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Histórico de Contagens</CardTitle>
            <CardDescription>
              Relatórios salvos de sessões anteriores.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : sortedReports && sortedReports.length > 0 ? (
              sortedReports.map((report) => (
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
              ))
            ) : (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum relatório salvo encontrado.
                </p>
            )}
          </CardContent>
        </Card>
      </div>

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
