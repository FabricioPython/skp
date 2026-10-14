import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import os from "os";

// Cache em memória para suportar ambientes com sistema de arquivos somente leitura (como Cloud Run)
let memoryReports: any[] | null = null;

function getDataPaths(): string[] {
  return [
    path.join(process.cwd(), "data", "reports.json"),
    path.join(os.tmpdir(), "skp-reports.json"),
  ];
}

async function getReportsFromFile(): Promise<{ reports: any[]; usedPath: string | null }> {
  const paths = getDataPaths();
  
  for (const filePath of paths) {
    try {
      await fs.access(filePath);
      const content = await fs.readFile(filePath, "utf-8");
      if (content.trim()) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          memoryReports = parsed;
          return { reports: parsed, usedPath: filePath };
        }
      }
    } catch {
      // Tenta o próximo caminho disponível
    }
  }

  // Se já houver relatórios em memória, retorna
  if (memoryReports !== null) {
    return { reports: memoryReports, usedPath: null };
  }

  return { reports: [], usedPath: null };
}

async function saveReportsToFile(reports: any[]): Promise<boolean> {
  memoryReports = reports;
  const paths = getDataPaths();

  for (const filePath of paths) {
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(reports, null, 2), "utf-8");
      return true;
    } catch (err) {
      console.warn(`Não foi possível salvar em ${filePath}:`, err);
      // Continua para tentar o próximo caminho (ex: diretório temporário)
    }
  }

  return false;
}

export async function GET() {
  try {
    const { reports } = await getReportsFromFile();
    return NextResponse.json(reports, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error: any) {
    console.error("Erro na rota GET /api/reports:", error);
    return NextResponse.json(
      { error: `Erro ao carregar relatórios: ${error?.message || "Falha desconhecida"}` },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      agencyNumber,
      agencyName,
      reportDate,
      savedCounts,
      sequencePairs,
      grandTotal,
    } = body;

    if (!agencyName || grandTotal === undefined) {
      return NextResponse.json(
        { error: "Dados incompletos para salvar o relatório. Informe a agência e os totais." },
        { status: 400 }
      );
    }

    const newReport = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      agencyNumber: agencyNumber || "",
      agencyName,
      reportDate: reportDate || new Date().toLocaleDateString("pt-BR"),
      savedCounts: savedCounts || {},
      sequencePairs: sequencePairs || {},
      grandTotal: grandTotal.toString(),
      createdAt: new Date().toISOString(),
    };

    const { reports } = await getReportsFromFile();
    reports.unshift(newReport);

    await saveReportsToFile(reports);

    return NextResponse.json(newReport, { status: 201 });
  } catch (error: any) {
    console.error("Erro na rota POST /api/reports:", error);
    return NextResponse.json(
      { error: `Erro no servidor: ${error?.message || "Falha desconhecida ao gravar arquivo"}` },
      { status: 500 }
    );
  }
}
