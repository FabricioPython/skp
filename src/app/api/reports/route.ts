import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "reports.json");

async function getReportsFromFile(): Promise<any[]> {
  try {
    await fs.access(DATA_FILE);
    const content = await fs.readFile(DATA_FILE, "utf-8");
    if (!content.trim()) return [];
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2), "utf-8");
      return [];
    }
    console.error("Erro ao ler reports.json:", error);
    return [];
  }
}

export async function GET() {
  try {
    const reports = await getReportsFromFile();
    return NextResponse.json(reports, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Erro na rota GET /api/reports:", error);
    return NextResponse.json(
      { error: "Erro ao carregar os relatórios." },
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
        { error: "Dados incompletos para salvar o relatório." },
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

    const reports = await getReportsFromFile();
    // Adiciona o novo relatório no topo da lista (ordem decrescente)
    reports.unshift(newReport);

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(reports, null, 2), "utf-8");

    return NextResponse.json(newReport, { status: 201 });
  } catch (error) {
    console.error("Erro na rota POST /api/reports:", error);
    return NextResponse.json(
      { error: "Falha ao salvar o relatório no arquivo JSON." },
      { status: 500 }
    );
  }
}
