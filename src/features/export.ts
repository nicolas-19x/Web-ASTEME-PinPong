export type Cell = string | number | null | undefined;

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  const esc = (v: Cell) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}

/** Exporta a CSV (UTF-8 con BOM para que Excel respete tildes) o a Excel (.xlsx). */
export async function exportRows(name: string, headers: string[], rows: Cell[][], format: 'csv' | 'xlsx') {
  if (format === 'csv') {
    download(new Blob(['﻿' + toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }), `${name}.csv`);
    return;
  }
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(name.slice(0, 31));
  ws.addRow(headers).font = { bold: true };
  rows.forEach((r) => ws.addRow(r.map((c) => (c == null ? '' : c))));
  ws.columns.forEach((col, i) => {
    const max = Math.max(headers[i]?.length ?? 8, ...rows.map((r) => String(r[i] ?? '').length));
    col.width = Math.min(48, Math.max(10, max + 2));
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${name}.xlsx`);
}
