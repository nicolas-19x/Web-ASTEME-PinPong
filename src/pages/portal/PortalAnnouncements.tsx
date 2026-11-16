import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Chip, EmptyState, ErrorState, Loading, PageHeader } from '@/components/app/common';
import { useAuth } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import { KIND_LABEL } from '@/pages/admin/Announcements';

export default function PortalAnnouncements() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'announcements'],
    queryFn: async () => {
      const [a, r] = await Promise.all([
        supabase.from('announcements').select('id, title, body, kind, published_at').order('published_at', { ascending: false }),
        supabase.from('announcement_reads').select('announcement_id'),
      ]);
      const read = new Set(unwrap(r).map((x) => x.announcement_id));
      return unwrap(a).map((x) => ({ ...x, read: read.has(x.id) }));
    },
  });
  // Al abrir la página se marcan como leídos.
  useEffect(() => {
    const unread = data?.filter((a) => !a.read) ?? [];
    if (!profile || !unread.length) return;
    void supabase
      .from('announcement_reads')
      .upsert(unread.map((a) => ({ announcement_id: a.id, profile_id: profile.id })), { onConflict: 'announcement_id,profile_id', ignoreDuplicates: true })
      .then(() => void qc.invalidateQueries({ queryKey: ['portal', 'announcements', 'latest'] }));
  }, [data, profile, qc]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => refetch()} />;
  return (
    <div>
      <PageHeader title="Comunicados" description="Avisos oficiales de la academia." />
      {!data?.length ? (
        <EmptyState title="Sin comunicados por ahora" />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((a) => (
            <li key={a.id}>
              <article className="rounded-xl border bg-card p-4">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Chip tone="info">{KIND_LABEL[a.kind]}</Chip>
                  {!a.read && <Chip tone="ball">Nuevo</Chip>}
                  <span className="text-sm text-muted-foreground">{fmtDateTime(a.published_at)}</span>
                </div>
                <h2 className="text-[1.35rem]">{a.title}</h2>
                <p className="mt-1 max-w-[70ch] whitespace-pre-wrap">{a.body}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
