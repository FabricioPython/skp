import mongoose, { Schema, Model } from "mongoose";

export interface ISequencePair {
  initial: string;
  final: string;
}

export interface IReport {
  _id?: string;
  agencyNumber: string;
  agencyName: string;
  reportDate: string;
  savedCounts: Record<string, string>;
  sequencePairs: Record<string, ISequencePair[]>;
  grandTotal: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    agencyNumber: {
      type: String,
      default: "",
    },
    agencyName: {
      type: String,
      required: [true, "Nome da agência é obrigatório"],
      trim: true,
    },
    reportDate: {
      type: String,
      required: [true, "Data do relatório é obrigatória"],
    },
    savedCounts: {
      type: Schema.Types.Mixed,
      default: {},
    },
    sequencePairs: {
      type: Schema.Types.Mixed,
      default: {},
    },
    grandTotal: {
      type: String,
      required: [true, "Total geral é obrigatório"],
    },
  },
  {
    timestamps: true,
  }
);

// Evita a recriação do modelo durante o hot reload no Next.js
export const Report: Model<IReport> =
  mongoose.models.Report || mongoose.model<IReport>("Report", ReportSchema);

export default Report;
