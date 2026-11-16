import { Image, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { fmtDate, fmtDateTime } from '@/lib/format';

export const C = { ink: '#0C1B33', table: '#1B4F8C', ball: '#FF6B1A', muted: '#5B6B82', line: '#CBD3DF', soft: '#EEF2F8' };

export const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 44, paddingHorizontal: 36, fontSize: 9.5, fontFamily: 'Helvetica', color: C.ink, lineHeight: 1.35 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 2, borderBottomColor: C.table, paddingBottom: 8, marginBottom: 14 },
  logo: { width: 34, height: 34, objectFit: 'contain' },
  academy: { fontSize: 9, color: C.muted },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  h2: { fontSize: 12.5, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 6, color: C.table },
  h3: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  small: { fontSize: 8, color: C.muted },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.line, minHeight: 17, alignItems: 'center' },
  headRow: { flexDirection: 'row', backgroundColor: C.soft, minHeight: 17, alignItems: 'center' },
  cell: { paddingHorizontal: 4, paddingVertical: 2 },
  bold: { fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: C.muted },
  box: { borderWidth: 0.8, borderColor: C.ink, width: 34, height: 15, marginRight: 3 },
  band: { backgroundColor: C.table, color: '#fff', padding: 8, borderRadius: 3, marginBottom: 10 },
});

export function Header({ academy, logo, title, subtitle }: { academy: string; logo: string | null; title: string; subtitle?: string }) {
  return (
    <View style={s.header} fixed>
      {logo ? <Image src={logo} style={s.logo} /> : <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.ball }} />}
      <View style={{ flex: 1 }}>
        <Text style={s.academy}>{academy}</Text>
        <Text style={s.title}>{title}</Text>
        {subtitle && <Text style={s.small}>{subtitle}</Text>}
      </View>
    </View>
  );
}

export function Footer({ label }: { label: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {label}. Generado el {fmtDateTime(new Date().toISOString())}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

export function TableRows<T>({
  cols,
  rows,
  render,
}: {
  cols: { label: string; width: number | string; align?: 'left' | 'right' | 'center' }[];
  rows: T[];
  render: (r: T, i: number) => ReactNode[];
}) {
  return (
    <View>
      <View style={s.headRow} wrap={false}>
        {cols.map((c) => (
          <Text key={c.label} style={[s.cell, s.bold, { width: c.width, textAlign: c.align ?? 'left' }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.row} wrap={false}>
          {render(r, i).map((v, j) => (
            <View key={j} style={[s.cell, { width: cols[j].width, alignItems: cols[j].align === 'right' ? 'flex-end' : cols[j].align === 'center' ? 'center' : 'flex-start' }]}>
              {typeof v === 'string' || typeof v === 'number' ? <Text>{v}</Text> : v}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Convierte el logo (PNG/JPEG) a data URL; react-pdf no admite SVG ni WebP. */
export async function loadLogo(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!['image/png', 'image/jpeg'].includes(blob.type)) return null;
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const dateLong = (iso: string) => fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
