// Downloads the pay period's file for the payroll provider (GET /api/pay/export.csv, which the server records: who exported what).
import { downloadCsv } from "./download";
import { payApi } from "./payApi";
import type { PayFormat } from "./pay";

export const exportPayPeriod = (date: string, format: PayFormat): Promise<string> => downloadCsv(payApi.exportPath(date, format), `pay-${format}-${date}.csv`);
