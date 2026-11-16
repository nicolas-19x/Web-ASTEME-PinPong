import { Document, Page, pdf, Text, View } from '@react-pdf/renderer';
import { fmtDate, fullName, HAND_LABEL, playerAge, STATUS_LABEL } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import { C, downloadBlob, Footer, Header, loadLogo, s, slug, TableRows } from './shared';

export interface PlayerReportOptions {
  general: boolean;
  competitive: boolean;
  evaluations: boolean;
  goals: boolean;
  evolution: boolean;
  attendance: boolean;
  achievements: boolean;
  /** Si es true, solo se incluye lo marcado como compartido (para entregar a la familia). */
  sharedOnly: boolean;
}

const GOAL_LABEL: Record<string, string> = {
  short_term: 'Objetivos a corto plazo',
  medium_term: 'Objetivos a mediano plazo',
  strength: 'Fortalezas',
  improvement: 'Aspectos por mejorar',
  competitive_goal: 'Metas competitivas',
};

async function loadPlayerReport(playerId: string) {
  const [p, tp, cp, ev, plan, att, ach, ctrl] = await Promise.all([
    supabase.from('players').select('*, categories(name), levels(name)').eq('id', playerId).single(),
    supabase.from('tournament_participants').select('final_position, matches_won, matches_lost, medal, tournaments(name, held_on, location, status)').eq('player_id', playerId),
    supabase.from('competition_participants').select('final_position, matches_won, matches_lost, medal, recognition, registered, competitions(name, start_date, location, scope)').eq('player_id', playerId),
    supabase.from('evaluations').select('*, evaluation_items(*)').eq('player_id', playerId).order('evaluated_on', { ascending: false }).limit(6),
    supabase.from('development_plans').select('*, development_goals(*)').eq('player_id', playerId).eq('is_current', true).maybeSingle(),
    supabase.from('attendance').select('status, on_date').eq('player_id', playerId).order('on_date', { ascending: false }).limit(200),
    supabase.from('player_achievements').select('*').eq('player_id', playerId).order('awarded_on', { ascending: false }),
    supabase.from('control_results').select('*, control_tests(name, unit)').eq('player_id', playerId).order('measured_on'),
  ]);
  return {
    player: unwrap(p),
    tournaments: unwrap(tp),
    competitions: unwrap(cp),
    evaluations: unwrap(ev),
    plan: plan.data,
    attendance: unwrap(att),
    achievements: unwrap(ach),
    controls: unwrap(ctrl),
  };
}

type Data = Awaited<ReturnType<typeof loadPlayerReport>>;

function PlayerDoc({ d, o, academy, logo }: { d: Data; o: PlayerReportOptions; academy: string; logo: string | null }) {
  const p = d.player;
  const age = playerAge(p);
  const evals = d.evaluations.filter((e) => !o.sharedOnly || e.shared);
  const goals = (d.plan?.development_goals ?? []).filter((g) => !o.sharedOnly || g.shared);
  const ach = d.achievements.filter((a) => !o.sharedOnly || a.shared);
  const controls = d.controls.filter((c) => !o.sharedOnly || c.shared);
  const comp = [
    ...d.tournaments.filter((t) => t.tournaments).map((t) => ({ date: t.tournaments!.held_on, name: t.tournaments!.name, type: 'Torneo interno', pos: t.final_position, w: t.matches_won, l: t.matches_lost, medal: t.medal })),
    ...d.competitions.filter((c) => c.competitions && (c.registered || c.final_position)).map((c) => ({ date: c.competitions!.start_date, name: c.competitions!.name, type: 'Competencia externa', pos: c.final_position, w: c.matches_won, l: c.matches_lost, medal: c.medal })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const present = d.attendance.filter((a) => a.status === 'present').length;
  const medalTxt = (m: string | null) => (m === 'gold' ? 'Oro' : m === 'silver' ? 'Plata' : m === 'bronze' ? 'Bronce' : '');
  const avgBy = (e: (typeof evals)[number]) => {
    const xs = e.evaluation_items.filter((i) => i.score != null).map((i) => Number(i.score));
    return xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '—';
  };
  return (
    <Document title={`Informe deportivo de ${fullName(p)}`} author={academy}>
      <Page size="A4" style={s.page}>
        <Header academy={academy} logo={logo} title={`Informe deportivo: ${fullName(p)}`} subtitle={`Emitido el ${fmtDate(new Date().toISOString().slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}`} />
        {o.general && (
          <View style={s.band}>
            <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold' }}>{fullName(p)}</Text>
            <Text>
              {p.categories?.name ?? 'Sin categoría'}, {p.levels?.name ?? 'nivel sin definir'}. {age.label}
              {p.dominant_hand ? `, ${HAND_LABEL[p.dominant_hand].toLowerCase()}` : ''}. Estado: {STATUS_LABEL[p.status].toLowerCase()}.
              {p.join_date ? ` En la academia desde ${fmtDate(p.join_date)}.` : ''}
              {p.ranking_points != null ? ` Ranking interno: ${p.ranking_points} puntos.` : ''}
            </Text>
          </View>
        )}
        {o.competitive && (
          <>
            <Text style={s.h2}>Historial competitivo</Text>
            {comp.length === 0 ? (
              <Text style={s.small}>Sin participaciones registradas.</Text>
            ) : (
              <TableRows
                cols={[
                  { label: 'Fecha', width: 70 },
                  { label: 'Evento', width: 190 },
                  { label: 'Tipo', width: 95 },
                  { label: 'Pos.', width: 40, align: 'center' },
                  { label: 'G-P', width: 45, align: 'center' },
                  { label: 'Medalla', width: 60 },
                ]}
                rows={comp}
                render={(r) => [fmtDate(r.date), r.name, r.type, r.pos ? `${r.pos}.º` : '—', r.w != null ? `${r.w}-${r.l ?? 0}` : '—', medalTxt(r.medal)]}
              />
            )}
          </>
        )}
        {o.achievements && ach.length > 0 && (
          <>
            <Text style={s.h2}>Logros y reconocimientos</Text>
            {ach.map((a) => (
              <Text key={a.id}>
                {fmtDate(a.awarded_on)}: {a.title}
              </Text>
            ))}
          </>
        )}
        {o.goals && (
          <>
            <Text style={s.h2}>Objetivos actuales</Text>
            {goals.length === 0 ? (
              <Text style={s.small}>Sin objetivos {o.sharedOnly ? 'compartidos' : 'definidos'}.</Text>
            ) : (
              Object.entries(GOAL_LABEL).map(([k, l]) => {
                const gs = goals.filter((g) => g.kind === k);
                if (!gs.length) return null;
                return (
                  <View key={k} style={{ marginBottom: 4 }} wrap={false}>
                    <Text style={s.h3}>{l}</Text>
                    {gs.map((g) => (
                      <Text key={g.id}>• {g.description}</Text>
                    ))}
                  </View>
                );
              })
            )}
            {d.plan?.review_date && <Text style={s.small}>Próxima revisión: {fmtDate(d.plan.review_date)}</Text>}
          </>
        )}
        {o.evaluations && (
          <>
            <Text style={s.h2}>Evaluaciones recientes</Text>
            {evals.length === 0 ? (
              <Text style={s.small}>Sin evaluaciones {o.sharedOnly ? 'compartidas' : ''}.</Text>
            ) : (
              evals.slice(0, 3).map((e) => (
                <View key={e.id} style={{ marginBottom: 8, borderLeftWidth: 2, borderLeftColor: C.table, paddingLeft: 6 }} wrap={false}>
                  <Text style={s.h3}>{fmtDate(e.evaluated_on, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                  {e.evaluation_items.map((i) => (
                    <Text key={i.id}>
                      {i.skill_name}: {i.score != null ? `${i.score}/10` : ''}
                      {i.comment ? `${i.score != null ? '. ' : ''}${i.comment}` : ''}
                    </Text>
                  ))}
                  {e.conclusion && <Text style={{ marginTop: 2 }}>Conclusión: {e.conclusion}</Text>}
                </View>
              ))
            )}
          </>
        )}
        {o.evolution && (evals.length > 1 || controls.length > 0) && (
          <>
            <Text style={s.h2}>Evolución</Text>
            {evals.length > 1 && (
              <Text>
                Promedio de evaluaciones: {[...evals].reverse().map((e) => `${fmtDate(e.evaluated_on, { month: 'short', year: '2-digit' })} ${avgBy(e)}`).join(', ')}.
              </Text>
            )}
            {[...new Set(controls.map((c) => c.test_id))].map((tid) => {
              const cs = controls.filter((c) => c.test_id === tid);
              return (
                <Text key={tid}>
                  {cs[0].control_tests?.name}: {cs.map((c) => `${fmtDate(c.measured_on, { month: 'short', year: '2-digit' })} ${c.value ?? c.value_text}${c.control_tests?.unit ? ` ${c.control_tests.unit}` : ''}`).join(', ')}.
                </Text>
              );
            })}
          </>
        )}
        {o.attendance && (
          <>
            <Text style={s.h2}>Asistencia</Text>
            <Text>
              {d.attendance.length
                ? `${present} presencias de ${d.attendance.length} registros (${Math.round((present / d.attendance.length) * 100)} %).`
                : 'Sin registros de asistencia.'}
            </Text>
          </>
        )}
        <Footer label={`Informe de ${fullName(p)}`} />
      </Page>
    </Document>
  );
}

export async function downloadPlayerReport(playerId: string, o: PlayerReportOptions, academy: string, logoUrl: string | null) {
  const [d, logo] = await Promise.all([loadPlayerReport(playerId), loadLogo(logoUrl)]);
  const blob = await pdf(<PlayerDoc d={d} o={o} academy={academy} logo={logo} />).toBlob();
  downloadBlob(blob, `informe-${slug(fullName(d.player))}.pdf`);
}
