import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Report } from "@/models/Report";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json(
        {
          error:
            "Configuração pendente: Variável MONGODB_URI não encontrada. Configure seu MongoDB no arquivo .env.local ou nas variáveis do servidor.",
        },
        { status: 503 }
      );
    }

    await connectToDatabase();

    const reports = await Report.find().sort({ createdAt: -1 }).lean();

    const formattedReports = reports.map((doc: any) => ({
      id: doc._id.toString(),
      agencyNumber: doc.agencyNumber || "",
      agencyName: doc.agencyName,
      reportDate: doc.reportDate,
      savedCounts: doc.savedCounts || {},
      sequencePairs: doc.sequencePairs || {},
      grandTotal: doc.grandTotal,
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    }));

    return NextResponse.json(formattedReports, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error: any) {
    console.error("Erro ao buscar relatórios no MongoDB:", error);
    return NextResponse.json(
      {
        error: `Erro ao conectar ou buscar relatórios no MongoDB: ${error?.message || "Falha desconhecida"}`,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json(
        {
          error:
            "Configuração pendente: Variável MONGODB_URI não encontrada. Configure a URL de conexão do MongoDB no .env.local.",
        },
        { status: 503 }
      );
    }

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
        { error: "Dados incompletos. Informe o nome da agência e o total geral." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const newReport = await Report.create({
      agencyNumber: agencyNumber || "",
      agencyName,
      reportDate: reportDate || new Date().toLocaleDateString("pt-BR"),
      savedCounts: savedCounts || {},
      sequencePairs: sequencePairs || {},
      grandTotal: grandTotal.toString(),
    });

    const formatted = {
      id: newReport._id.toString(),
      agencyNumber: newReport.agencyNumber,
      agencyName: newReport.agencyName,
      reportDate: newReport.reportDate,
      savedCounts: newReport.savedCounts,
      sequencePairs: newReport.sequencePairs,
      grandTotal: newReport.grandTotal,
      createdAt: newReport.createdAt ? new Date(newReport.createdAt).toISOString() : new Date().toISOString(),
    };

    return NextResponse.json(formatted, { status: 201 });
  } catch (error: any) {
    console.error("Erro ao salvar relatório no MongoDB:", error);
    return NextResponse.json(
      {
        error: `Erro ao salvar no MongoDB: ${error?.message || "Falha desconhecida"}`,
      },
      { status: 500 }
    );
  }
}
