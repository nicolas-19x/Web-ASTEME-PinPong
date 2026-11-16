import { Document, Page, pdf, Text, View } from '@react-pdf/renderer';
import { rulesOf, type TournamentData } from '@/features/tournaments/data';
import { podium, type ResolvedBracketMatch, type StandingRow } from '@/lib/tournament';
import { C, dateLong, downloadBlob, Footer, Header, loadLogo, s, slug, TableRows } from './shared';

interface Ctx {
  academy: string;
  logoUrl: string | null;
  standings: StandingRow[][];
  resolved: ResolvedBracketMatch[];
}

function PreDoc({ d, ctx, logo }: { d: TournamentData; ctx: Ctx; logo: string | null }) {
  const t = d.tournament;
  const r = rulesOf(t, 'group');
  const sub = `${dateLong(t.held_on)}${t.location ? `, ${t.location}` : ''}. Sets a ${r.pointsPerSet}, diferencia de ${r.minLead}, mejor de ${r.bestOf}.`;
  const groupMatches = d.matches.filter((m) => m.stage === 'group');
  const slots = [...new Set(groupMatches.map((m) => m.slot ?? 0))].sort((a, b) => a - b);
  const seeds = d.participants.slice().sort((a, b) => (a.seed_position ?? 999) - (b.seed_position ?? 999));
  const groupName = (gid: string | null) => d.groups.find((g) => g.id === gid)?.name.replace('Grupo ', '') ?? '';
  return (
    <Document title={`${t.name}: planilla previa`} author={ctx.academy}>
      <Page size="A4" style={s.page}>
        <Header academy={ctx.academy} logo={logo} title={t.name} subtitle={sub} />
        <Text style={s.h2}>Participantes y ranking</Text>
        <TableRows
          cols={[
            { label: 'Siembra', width: 50, align: 'center' },
            { label: 'Jugador', width: 220 },
            { label: 'Categoría', width: 90 },
            { label: 'Ranking', width: 70, align: 'right' },
            { label: 'Grupo', width: 60, align: 'center' },
          ]}
          rows={seeds}
          render={(p) => [
            String(p.seed_position ?? ''),
            d.names.get(p.player_id) ?? '',
            p.players?.categories?.name ?? '',
            p.ranking_at_entry == null ? 'Sin ranking' : String(p.ranking_at_entry),
            d.groups.find((g) => g.players.includes(p.player_id))?.name.replace('Grupo ', '') ?? '',
          ]}
        />
        <Text style={s.h2}>Grupos</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {d.groups.map((g) => (
            <View key={g.id} style={{ width: '48%', borderWidth: 0.8, borderColor: C.line, padding: 6 }} wrap={false}>
              <Text style={s.h3}>
                {g.name} (suma de ranking: {g.players.reduce((a, id) => a + (d.ranking.get(id) ?? 0), 0)})
              </Text>
              {g.players.map((id, i) => (
                <Text key={id}>
                  {i + 1}. {d.names.get(id)}
                  {i === 0 ? ' (cabeza de serie)' : ''} {d.ranking.get(id) == null ? '' : `, ${d.ranking.get(id)}`}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <Footer label={`${t.name}, planilla previa`} />
      </Page>

      <Page size="A4" style={s.page}>
        <Header academy={ctx.academy} logo={logo} title={`${t.name}: enfrentamientos`} subtitle="Anota los puntos de cada set en las casillas (jugador A - jugador B)." />
        {slots.map((slot) => (
          <View key={slot} wrap={false} style={{ marginBottom: 8 }}>
            <Text style={s.h3}>Turno {slot}</Text>
            <TableRows
              cols={[
                { label: 'Mesa', width: 34, align: 'center' },
                { label: 'Gr.', width: 26, align: 'center' },
                { label: 'Jor.', width: 26, align: 'center' },
                { label: 'Jugador A', width: 110 },
                { label: 'Jugador B', width: 110 },
                { label: 'Sets', width: 140 },
                { label: 'Ganador', width: 76 },
              ]}
              rows={groupMatches.filter((m) => (m.slot ?? 0) === slot)}
              render={(m) => [
                String(m.table_no ?? ''),
                groupName(m.group_id),
                String(m.round),
                d.names.get(m.player_a!) ?? '',
                d.names.get(m.player_b!) ?? '',
                <View key="b" style={{ flexDirection: 'row' }}>
                  {Array.from({ length: r.bestOf }, (_, i) => (
                    <View key={i} style={[s.box, { width: Math.min(34, 130 / r.bestOf - 3) }]} />
                  ))}
                </View>,
                '',
              ]}
            />
          </View>
        ))}
        <Footer label={`${t.name}, enfrentamientos`} />
      </Page>

      <Page size="A4" style={s.page}>
        <Header academy={ctx.academy} logo={logo} title={`${t.name}: tablas de posiciones`} subtitle="Para completar a mano durante el torneo." />
        {d.groups.map((g) => (
          <View key={g.id} wrap={false} style={{ marginBottom: 12 }}>
            <Text style={s.h3}>{g.name}</Text>
            <TableRows
              cols={[
                { label: 'Jugador', width: 150 },
                { label: 'PJ', width: 40, align: 'center' },
                { label: 'G', width: 40, align: 'center' },
                { label: 'P', width: 40, align: 'center' },
                { label: 'Sets', width: 60, align: 'center' },
                { label: 'Dif.', width: 45, align: 'center' },
                { label: 'Pts.', width: 45, align: 'center' },
                { label: 'Clas.', width: 45, align: 'center' },
                { label: 'Pos.', width: 45, align: 'center' },
              ]}
              rows={g.players}
              render={(id) => [d.names.get(id) ?? '', '', '', '', '', '', '', '', '']}
            />
          </View>
        ))}
        <Text style={s.small}>
          Desempate: {(t.tiebreakers as string[]).map((c) => ({ wins: 'partidos ganados', head_to_head: 'resultado directo', set_diff: 'diferencia de sets', point_diff: 'diferencia de puntos', manual: 'criterio del entrenador' })[c as 'wins']).join(', ')}.
        </Text>
        <Footer label={`${t.name}, tablas`} />
      </Page>
    </Document>
  );
}

function FinalDoc({ d, ctx, logo }: { d: TournamentData; ctx: Ctx; logo: string | null }) {
  const t = d.tournament;
  const p = ctx.resolved.length ? podium(ctx.resolved) : null;
  const finished = d.matches.filter((m) => m.status === 'finished' && m.player_a && m.player_b);
  const sets = finished.reduce((a, m) => a + m.match_sets.length, 0);
  const wins = new Map<string, number>();
  finished.forEach((m) => m.winner_id && wins.set(m.winner_id, (wins.get(m.winner_id) ?? 0) + 1));
  const top = [...wins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const longest = finished.filter((m) => !m.walkover).sort((a, b) => b.points_a + b.points_b - (a.points_a + a.points_b))[0];
  const finalPos = d.participants.filter((x) => x.final_position != null).sort((a, b) => a.final_position! - b.final_position!);
  const champion = p?.champion ?? finalPos.find((x) => x.final_position === 1)?.player_id ?? (ctx.standings.length === 1 && t.status === 'finished' ? ctx.standings[0][0]?.playerId : null);
  const runner = p?.runnerUp ?? finalPos.find((x) => x.final_position === 2)?.player_id ?? null;
  const thirds = p?.third.length ? p.third : finalPos.filter((x) => x.final_position === 3).map((x) => x.player_id);
  const score = (m: (typeof finished)[number]) => (m.walkover ? 'W.O.' : `${m.sets_a}-${m.sets_b} (${m.match_sets.map((x) => `${x.points_a}-${x.points_b}`).join(', ')})`);
  return (
    <Document title={`${t.name}: resultados`} author={ctx.academy}>
      <Page size="A4" style={s.page}>
        <Header
          academy={ctx.academy}
          logo={logo}
          title={`${t.name}: resultados`}
          subtitle={`${dateLong(t.held_on)}${t.location ? `, ${t.location}` : ''}. ${t.status === 'finished' ? 'Torneo finalizado.' : 'Resultados parciales: el torneo sigue en juego.'}`}
        />
        <View style={s.band}>
          <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold' }}>Campeón: {champion ? d.names.get(champion) : 'por definir'}</Text>
          <Text>Subcampeón: {runner ? d.names.get(runner) : 'por definir'}</Text>
          <Text>Tercer lugar: {thirds.length ? thirds.map((x) => d.names.get(x)).join(' y ') : 'por definir'}</Text>
        </View>
        <Text style={s.h2}>Estadísticas</Text>
        <Text>
          {d.participants.length} participantes, {finished.length} partidos jugados, {sets} sets.
          {finished.filter((m) => m.walkover).length ? ` ${finished.filter((m) => m.walkover).length} W.O.` : ''}
        </Text>
        {top.length > 0 && <Text>Más victorias: {top.map(([id, n]) => `${d.names.get(id)} (${n})`).join(', ')}.</Text>}
        {longest && (
          <Text>
            Partido más largo: {d.names.get(longest.player_a!)} vs {d.names.get(longest.player_b!)}, {longest.points_a + longest.points_b} puntos.
          </Text>
        )}
        {finalPos.length > 0 && (
          <>
            <Text style={s.h2}>Clasificación final</Text>
            <TableRows
              cols={[
                { label: 'Pos.', width: 40, align: 'center' },
                { label: 'Jugador', width: 200 },
                { label: 'G', width: 40, align: 'center' },
                { label: 'P', width: 40, align: 'center' },
                { label: 'Sets', width: 60, align: 'center' },
                { label: 'Medalla', width: 80 },
              ]}
              rows={finalPos}
              render={(x) => [String(x.final_position), d.names.get(x.player_id) ?? '', String(x.matches_won), String(x.matches_lost), `${x.sets_won}-${x.sets_lost}`, x.medal === 'gold' ? 'Oro' : x.medal === 'silver' ? 'Plata' : x.medal === 'bronze' ? 'Bronce' : '']}
            />
          </>
        )}
        {ctx.resolved.length > 0 && (
          <>
            <Text style={s.h2}>Eliminatoria</Text>
            {[...new Set(ctx.resolved.map((m) => m.label))].map((label) => (
              <View key={label} wrap={false} style={{ marginBottom: 6 }}>
                <Text style={s.h3}>{label}</Text>
                {ctx.resolved
                  .filter((m) => m.label === label)
                  .map((m) => {
                    const row = d.matches.find((x) => x.key === m.key);
                    return (
                      <Text key={m.key}>
                        {m.byeAdvance
                          ? `${d.names.get(m.winner!)} avanza por BYE`
                          : `${m.playerA ? d.names.get(m.playerA) : 'Por definir'} vs ${m.playerB ? d.names.get(m.playerB) : 'Por definir'}: ${row && row.status === 'finished' ? score(row) : 'pendiente'}${m.winner ? `. Gana ${d.names.get(m.winner)}` : ''}`}
                      </Text>
                    );
                  })}
              </View>
            ))}
          </>
        )}
        <Footer label={`${t.name}, resultados`} />
      </Page>
      <Page size="A4" style={s.page}>
        <Header academy={ctx.academy} logo={logo} title={`${t.name}: fase de grupos`} />
        {d.groups.map((g, gi) => (
          <View key={g.id} style={{ marginBottom: 12 }}>
            <Text style={s.h2}>{g.name}</Text>
            <TableRows
              cols={[
                { label: 'Pos.', width: 32, align: 'center' },
                { label: 'Jugador', width: 150 },
                { label: 'PJ', width: 32, align: 'center' },
                { label: 'G', width: 32, align: 'center' },
                { label: 'P', width: 32, align: 'center' },
                { label: 'Sets', width: 50, align: 'center' },
                { label: 'Dif.', width: 38, align: 'center' },
                { label: 'Pts.', width: 42, align: 'center' },
                { label: 'Clas.', width: 40, align: 'center' },
              ]}
              rows={ctx.standings[gi] ?? []}
              render={(r) => [String(r.position), d.names.get(r.playerId) ?? '', String(r.played), String(r.won), String(r.lost), `${r.setsFor}-${r.setsAgainst}`, String(r.setDiff), String(r.pointDiff), String(r.classificationPoints)]}
            />
            {g.manual_order_note && <Text style={s.small}>Decisión manual del entrenador: {g.manual_order_note}</Text>}
            <View style={{ marginTop: 4 }}>
              {d.matches
                .filter((m) => m.group_id === g.id)
                .map((m) => (
                  <Text key={m.id} style={{ fontSize: 8.5 }}>
                    Jornada {m.round}: {d.names.get(m.player_a!)} vs {d.names.get(m.player_b!)}: {m.status === 'finished' ? score(m) : 'pendiente'}
                  </Text>
                ))}
            </View>
          </View>
        ))}
        <Footer label={`${t.name}, grupos`} />
      </Page>
    </Document>
  );
}

export async function downloadTournamentPdf(kind: 'pre' | 'final', d: TournamentData, ctx: Ctx) {
  const logo = await loadLogo(ctx.logoUrl);
  const doc = kind === 'pre' ? <PreDoc d={d} ctx={ctx} logo={logo} /> : <FinalDoc d={d} ctx={ctx} logo={logo} />;
  const blob = await pdf(doc).toBlob();
  downloadBlob(blob, `${slug(d.tournament.name)}-${kind === 'pre' ? 'planilla-previa' : 'resultados'}.pdf`);
  return blob;
}

/** Para pruebas: genera el PDF sin descargarlo. */
export async function renderTournamentPdf(kind: 'pre' | 'final', d: TournamentData, ctx: Ctx) {
  const doc = kind === 'pre' ? <PreDoc d={d} ctx={ctx} logo={null} /> : <FinalDoc d={d} ctx={ctx} logo={null} />;
  return pdf(doc).toBlob();
}
