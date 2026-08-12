import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SetupScreen, type SetupResult } from "@/components/game/setup-screen";
import { AuctionScreen } from "@/components/game/auction-screen";
import { SquadDashboard } from "@/components/game/squad-dashboard";
import { PlayerAvatar } from "@/components/game/player-card";
import { Button } from "@/components/ui/button";
import { filterPool, type Player } from "@/lib/players";
import type { TeamSize } from "@/lib/formations";
import {
  applyResult,
  createTeams,
  humanBidAmount,
  humanPass,
  humanTakeHidden,
  startRound,
  takeLoan,
  squadRating,
  difficultyConfig,
  type AuctionState,
  type Difficulty,
  type Team,
} from "@/lib/game";
import {
  buyPlayer,
  buyPrice,
  createSeason,
  playMatchday,
  sellPlayer,
  sellPrice,
  sortStandings,
  type MatchResult,
  type SeasonState,
  type StandingRow,
} from "@/lib/season";
import { addHistory, clearCareer, loadCareer, saveCareer, type RunRecord } from "@/lib/save";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Crown,
  Landmark,
  PlayCircle,
  RotateCcw,
  Shield,
  ShoppingCart,
  Trophy,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/single-player")({
  head: () => ({
    meta: [
      { title: "Single Player Draft — Football Auction Draft" },
      {
        name: "description",
        content:
          "Draft your XI against AI managers: bid on revealed stars, gamble on hidden players and win the league season.",
      },
      { property: "og:title", content: "Single Player Draft — Football Auction Draft" },
      {
        property: "og:description",
        content: "Outbid AI managers, build a squad within budget and chase the title.",
      },
    ],
  }),
  component: SinglePlayer,
});

type Phase = "setup" | "draft" | "over" | "season" | "matchday" | "champion";

interface CareerState {
  version: 1;
  phase: Exclude<Phase, "setup" | "champion">;
  teamSize: TeamSize;
  formationId: string;
  difficulty: Difficulty;
  teams: Team[];
  pool: Player[];
  auction: AuctionState | null;
  round: number;
  season: SeasonState | null;
  lastTurn: { teams: Team[]; season: SeasonState; results: MatchResult[]; humanResult: MatchResult | null } | null;
  startedAt: string;
}

const SAVE_VERSION = 1 as const;

function SinglePlayer() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [teamSize, setTeamSize] = useState<TeamSize>(5);
  const [formationId, setFormationId] = useState<string>("");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [teams, setTeams] = useState<Team[]>([]);
  const [pool, setPool] = useState<Player[]>([]);
  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [round, setRound] = useState(1);
  const [season, setSeason] = useState<SeasonState | null>(null);
  const [lastTurn, setLastTurn] = useState<CareerState["lastTurn"]>(null);
  const [resume, setResume] = useState<CareerState | null>(null);

  const totalRounds = teamSize;
  const human = teams.find((t) => t.isHuman);
  const isChampion = season?.championId === "human";

  // Load any saved career to offer a resume.
  useEffect(() => {
    const saved = loadCareer<CareerState>();
    if (saved && saved.version === SAVE_VERSION) setResume(saved);
  }, []);

  // Debounced auto-save of the whole career.
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (phase === "setup" || phase === "champion") return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const career: CareerState = {
        version: SAVE_VERSION,
        phase,
        teamSize,
        formationId,
        difficulty,
        teams,
        pool,
        auction,
        round,
        season,
        lastTurn,
        startedAt: "now",
      };
      saveCareer(career);
    }, 400);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [phase, teamSize, formationId, difficulty, teams, pool, auction, round, season, lastTurn]);

  const applyCareer = useCallback((c: CareerState) => {
    setTeamSize(c.teamSize);
    setFormationId(c.formationId);
    setDifficulty(c.difficulty);
    setTeams(c.teams);
    setPool(c.pool);
    setAuction(c.auction);
    setRound(c.round);
    setSeason(c.season);
    setLastTurn(c.lastTurn);
    setPhase(c.phase);
    setResume(null);
  }, []);

  const beginRound = useCallback((r: number, currentPool: Player[], currentTeams: Team[]) => {
    const state = startRound(r, currentPool, currentTeams, teamSize, formationId);
    setPool(currentPool.filter((p) => p.id !== state.revealed.id && p.id !== state.hidden.id));
    setAuction(state);
    setRound(r);
  }, [teamSize, formationId]);

  const handleStart = useCallback(
    (setup: SetupResult) => {
      const newTeams = createTeams({
        teamSize: setup.teamSize,
        startingBudget: setup.startingBudget,
        numOpponents: Math.max(1, setup.numOpponents),
        difficulty: setup.difficulty,
        formationId: setup.formationId,
      });
      const newPool = filterPool(setup.filter);
      setTeamSize(setup.teamSize);
      setFormationId(setup.formationId);
      setDifficulty(setup.difficulty);
      setTeams(newTeams);
      setPool(newPool);
      setSeason(null);
      setLastTurn(null);
      setPhase("draft");
      beginRound(1, newPool, newTeams);
    },
    [beginRound],
  );

  const handleNextRound = useCallback(() => {
    if (!auction) return;
    const updatedTeams = applyResult(teams, auction);
    setTeams(updatedTeams);

    const humanTeam = updatedTeams.find((t) => t.isHuman)!;
    if (humanTeam.squad.length >= teamSize || pool.length < 2 || round >= totalRounds) {
      sfx.win();
      setPhase("over");
      return;
    }
    beginRound(round + 1, pool, updatedTeams);
  }, [auction, teams, teamSize, pool, round, totalRounds, beginRound]);

  const startSeason = useCallback(() => {
    if (!teams.length) return;
    const s = createSeason(teams);
    setSeason(s);
    sfx.whistle();
    setPhase("season");
  }, [teams]);

  const playMatchdayTurn = useCallback(() => {
    if (!season || season.finished) return;
    const turn = playMatchday(teams, season);
    setTeams(turn.teams);
    setSeason(turn.season);
    setLastTurn(turn);
    sfx.whistle();
    setPhase("matchday");
  }, [season, teams]);

  const closeMatchday = useCallback(() => {
    if (season?.finished) {
      setPhase("champion");
    } else {
      setPhase("season");
    }
  }, [season]);

  // Record the finished run into the trophy room.
  useEffect(() => {
    if (phase !== "champion" || !human || !season) return;
    const sorted = sortStandings(season.standings);
    const rank = sorted.findIndex((r) => r.teamId === "human") + 1;
    const record: RunRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString(),
      teamSize,
      formationId,
      difficulty,
      rank,
      totalTeams: sorted.length,
      champion: isChampion,
      avgOvr: squadRating(human),
      squadNames: human.squad.map((p) => p.name),
    };
    addHistory(record);
    clearCareer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleReset = useCallback(() => {
    clearCareer();
    setPhase("setup");
    setTeams([]);
    setPool([]);
    setAuction(null);
    setSeason(null);
    setLastTurn(null);
    setResume(null);
  }, []);

  const isLastRound = round >= totalRounds || pool.length < 2;

  return (
    <main className="min-h-screen">
      {phase === "setup" && (
        <div className="mx-auto w-full max-w-3xl px-4 py-10">
          <BackLink />
          <h1 className="mb-6 font-display text-3xl font-bold">Career Draft</h1>

          {resume && (
            <div className="mb-6 rounded-2xl border border-primary/40 bg-primary/10 p-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-primary">
                <CalendarDays className="h-4 w-4" /> Saved career found
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {resume.phase === "draft"
                  ? `Mid-draft · Round ${resume.round} of ${resume.teamSize}`
                  : resume.phase === "season"
                    ? `League season · Matchday ${resume.season?.matchday ?? 1} of ${resume.season?.totalMatchdays ?? "?"}`
                    : "Draft complete"}
                {" "}· {difficultyConfig(resume.difficulty).label} · {resume.teamSize}-a-side
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => applyCareer(resume)}>
                  <PlayCircle className="h-4 w-4" /> Resume
                </Button>
                <Button variant="ghost" onClick={() => setResume(null)}>
                  Ignore
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    clearCareer();
                    setResume(null);
                  }}
                >
                  Discard save
                </Button>
              </div>
            </div>
          )}

          <SetupScreen onStart={handleStart} />
        </div>
      )}

      {phase === "draft" && auction && (
        <div className="mx-auto w-full max-w-6xl px-4 py-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h1 className="font-display text-2xl font-bold">Draft — Round {round}</h1>
            <span className="text-xs text-muted-foreground">
              {difficultyConfig(difficulty).label} · {teamSize}-a-side
            </span>
          </div>
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <AuctionScreen
              state={auction}
              teams={teams}
              totalRounds={totalRounds}
              isLastRound={isLastRound}
              onBid={(amount) => setAuction((s) => (s ? humanBidAmount(s, teams, amount) : s))}
              onTakeHidden={() => setAuction((s) => (s ? humanTakeHidden(s, teams) : s))}
              onPass={() => setAuction((s) => (s ? humanPass(s, teams) : s))}
              onNextRound={handleNextRound}
              onTakeLoan={(amount) => setTeams((ts) => takeLoan(ts, "human", amount))}
            />
            {human && (
              <div className="xl:sticky xl:top-6 xl:self-start">
                <SquadDashboard
                  name={human.name}
                  budget={human.budget}
                  squad={human.squad}
                  teamSize={teamSize}
                  formationId={formationId}
                  startingBudget={human.startingBudget}
                  debt={human.debt}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {phase === "over" && human && (
        <DraftComplete
          teams={teams}
          teamSize={teamSize}
          formationId={formationId}
          difficulty={difficulty}
          onStartSeason={startSeason}
          onReset={handleReset}
        />
      )}

      {phase === "season" && human && season && (
        <SeasonHub
          teams={teams}
          teamSize={teamSize}
          formationId={formationId}
          difficulty={difficulty}
          pool={pool}
          season={season}
          onPlay={playMatchdayTurn}
          onSetPool={setPool}
          onSetTeams={setTeams}
          onReset={handleReset}
        />
      )}

      {phase === "matchday" && human && season && lastTurn && (
        <MatchdayReport
          teams={teams}
          teamSize={teamSize}
          formationId={formationId}
          season={season}
          turn={lastTurn}
          onContinue={closeMatchday}
          onReset={handleReset}
        />
      )}

      {phase === "champion" && human && season && (
        <ChampionScreen
          humanName={human.name}
          season={season}
          teams={teams}
          teamSize={teamSize}
          formationId={formationId}
          isChampion={isChampion}
          onReset={handleReset}
        />
      )}
    </main>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Main menu
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Draft complete
// ---------------------------------------------------------------------------

function DraftComplete({
  teams,
  teamSize,
  formationId,
  difficulty,
  onStartSeason,
  onReset,
}: {
  teams: Team[];
  teamSize: TeamSize;
  formationId: string;
  difficulty: Difficulty;
  onStartSeason: () => void;
  onReset: () => void;
}) {
  const human = teams.find((t) => t.isHuman)!;
  const squadTotal = (t: Team) => t.squad.reduce((s, p) => s + p.ovr, 0);
  const ranked = useMemo(
    () => [...teams].sort((a, b) => squadTotal(b) - squadTotal(a)),
    [teams],
  );
  const humanRank = ranked.findIndex((t) => t.isHuman) + 1;
  const avgOvr = squadRating(human);
  const diff = difficultyConfig(difficulty);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="animate-pop mb-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
          <Trophy className="h-3.5 w-3.5" /> Draft Complete
        </span>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Your Squad Is Set</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Squad rating <span className="font-mono text-foreground">{avgOvr}</span> · Finished{" "}
          <span className="font-mono text-foreground">#{humanRank}</span> of {teams.length} on total
          rating · {diff.label}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <SquadDashboard
          name={human.name}
          budget={human.budget}
          squad={human.squad}
          teamSize={teamSize}
          formationId={formationId}
          startingBudget={human.startingBudget}
          debt={human.debt}
        />

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Final Standings
            </h2>
            <ul className="space-y-2">
              {[...teams]
                .sort(
                  (a, b) =>
                    b.squad.reduce((s, p) => s + p.ovr, 0) -
                    a.squad.reduce((s, p) => s + p.ovr, 0),
                )
                .map((t, i) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground">{i + 1}</span>
                      <span className={t.isHuman ? "font-semibold text-primary" : ""}>{t.name}</span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {t.squad.reduce((s, p) => s + p.ovr, 0)} pts
                    </span>
                  </li>
                ))}
            </ul>
          </div>
          {human.debt > 0 && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold text-destructive">
                <Landmark className="h-4 w-4" /> Current Debt ${human.debt}M
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your loans are repaid with interest out of matchday prize money during the season.
              </p>
            </div>
          )}
          <Button className="h-12 w-full text-base" onClick={onStartSeason}>
            <PlayCircle className="h-4 w-4" />
            Start League Season
          </Button>
          <Button variant="secondary" className="h-12 w-full text-base" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            New Draft
          </Button>
          <BackLink />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Season hub: standings + transfers + next matchday
// ---------------------------------------------------------------------------

function SeasonHub({
  teams,
  teamSize,
  formationId,
  difficulty,
  pool,
  season,
  onPlay,
  onSetTeams,
  onSetPool,
  onReset,
}: {
  teams: Team[];
  teamSize: TeamSize;
  formationId: string;
  difficulty: Difficulty;
  pool: Player[];
  season: SeasonState;
  onPlay: () => void;
  onSetTeams: (t: Team[]) => void;
  onSetPool: (p: Player[]) => void;
  onReset: () => void;
}) {
  const human = teams.find((t) => t.isHuman)!;
  const pairings = season.schedule[season.matchday - 1] ?? [];
  const myFixture = pairings.find(([a, b]) => a === "human" || b === "human");
  const opponentId = myFixture ? (myFixture[0] === "human" ? myFixture[1] : myFixture[0]) : null;
  const opponent = teams.find((t) => t.id === opponentId);
  const diff = difficultyConfig(difficulty);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">
            League Season — Matchday {season.matchday} of {season.totalMatchdays}
          </h1>
          <p className="text-xs text-muted-foreground">
            {human.name} · ${human.budget}M budget
            {human.debt > 0 ? ` · ${human.debt}M debt` : ""} · {diff.label}
          </p>
        </div>
        <Button
          onClick={onPlay}
          disabled={season.finished}
          className="h-12 text-base"
        >
          <PlayCircle className="h-4 w-4" /> Play Matchday {season.matchday}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Standings
            </h2>
            <StandingsTable rows={season.standings} />
          </div>

          {myFixture && opponent ? (
            <div className="rounded-2xl border border-primary/30 bg-card p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Next Fixture
              </h2>
              <div className="flex items-center justify-center gap-4 py-2">
                <FixtureTeam name={human.name} isHuman />
                <span className="font-display text-2xl font-bold text-muted-foreground">vs</span>
                <FixtureTeam name={opponent.name} />
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Their squad: {opponent.squad.length} players, OVR {squadRating(opponent)}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Rest Week
              </h2>
              <p className="text-sm text-muted-foreground">
                No fixture this matchday — your squad gets a breather while the rest of the league
                plays on. You can still use the transfer market.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="xl:sticky xl:top-6">
            <SquadDashboard
              name={human.name}
              budget={human.budget}
              squad={human.squad}
              teamSize={teamSize}
              formationId={formationId}
              startingBudget={human.startingBudget}
              debt={human.debt}
            />
            <div className="mt-4">
              <TransferMarket
                teams={teams}
                pool={pool}
                teamSize={teamSize}
                onTeams={onSetTeams}
                onPool={onSetPool}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Button variant="ghost" onClick={onReset}>
          <RotateCcw className="h-4 w-4" /> Abandon career
        </Button>
      </div>
    </div>
  );
}

function FixtureTeam({ name, isHuman }: { name: string; isHuman?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full border font-display text-lg font-bold",
          isHuman ? "border-primary bg-primary/15 text-primary" : "border-border bg-secondary",
        )}
      >
        {isHuman ? <UserRound className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
      </div>
      <span className="max-w-[7rem] truncate text-center text-xs font-medium">{name}</span>
    </div>
  );
}

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  const sorted = sortStandings(rows);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
            <th className="py-1.5 pr-2 font-medium">#</th>
            <th className="py-1.5 pr-2 font-medium">Club</th>
            <th className="py-1.5 px-2 text-center font-medium">P</th>
            <th className="py-1.5 px-2 text-center font-medium">W</th>
            <th className="py-1.5 px-2 text-center font-medium">D</th>
            <th className="py-1.5 px-2 text-center font-medium">L</th>
            <th className="py-1.5 px-2 text-center font-medium">GD</th>
            <th className="py-1.5 pl-2 text-right font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={r.teamId}
              className={cn(
                "border-t border-border/50",
                r.isHuman ? "font-semibold text-primary" : "text-foreground",
              )}
            >
              <td className="py-2 pr-2 font-mono text-xs text-muted-foreground">{i + 1}</td>
              <td className="py-2 pr-2">{r.name}</td>
              <td className="py-2 px-2 text-center font-mono text-xs">{r.played}</td>
              <td className="py-2 px-2 text-center font-mono text-xs">{r.won}</td>
              <td className="py-2 px-2 text-center font-mono text-xs">{r.drawn}</td>
              <td className="py-2 px-2 text-center font-mono text-xs">{r.lost}</td>
              <td className="py-2 px-2 text-center font-mono text-xs">
                {r.gd > 0 ? `+${r.gd}` : r.gd}
              </td>
              <td className="py-2 pl-2 text-right font-mono font-bold">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transfer market
// ---------------------------------------------------------------------------

function TransferMarket({
  teams,
  pool,
  teamSize,
  onTeams,
  onPool,
}: {
  teams: Team[];
  pool: Player[];
  teamSize: TeamSize;
  onTeams: (t: Team[]) => void;
  onPool: (p: Player[]) => void;
}) {
  const human = teams.find((t) => t.isHuman)!;
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const squadFull = human.squad.length >= teamSize;

  const buy = (p: Player) => {
    const price = buyPrice(p);
    if (human.budget < price || squadFull) {
      sfx.error();
      return;
    }
    const res = buyPlayer(teams, pool, p.id, teamSize);
    onTeams(res.teams);
    onPool(res.pool);
    sfx.transfer();
  };

  const sell = (p: Player) => {
    const res = sellPlayer(teams, pool, p.id);
    onTeams(res.teams);
    onPool(res.pool);
    sfx.coin();
  };

  const listed = [...pool]
    .filter((p) => buyPrice(p) <= human.budget || squadFull)
    .sort((a, b) => buyPrice(b) - buyPrice(a));

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <ShoppingCart className="h-3.5 w-3.5" /> Transfer Market
      </h2>
      <div className="mb-3 flex gap-1 rounded-lg bg-secondary p-1">
        {(["buy", "sell"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
              tab === t ? "bg-card text-foreground shadow" : "text-muted-foreground",
            )}
          >
            {t === "buy" ? `Buy (${listed.length})` : `Sell (${human.squad.length})`}
          </button>
        ))}
      </div>

      {tab === "buy" ? (
        squadFull ? (
          <p className="text-xs text-muted-foreground">
            Squad is full ({teamSize}/{teamSize}). Sell a player first.
          </p>
        ) : listed.length === 0 ? (
          <p className="text-xs text-muted-foreground">No affordable free agents left.</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {listed.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-lg bg-background/40 px-2 py-1.5"
              >
                <PlayerAvatar player={p} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.position} · OVR {p.ovr} · ${buyPrice(p)}M
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={human.budget < buyPrice(p)}
                  onClick={() => buy(p)}
                >
                  Buy
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : human.squad.length === 0 ? (
        <p className="text-xs text-muted-foreground">No players to sell.</p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {human.squad.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-lg bg-background/40 px-2 py-1.5">
              <PlayerAvatar player={p} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {p.position} · OVR {p.ovr} · +${sellPrice(p)}M
                </p>
              </div>
              <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => sell(p)}>
                Sell
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matchday report
// ---------------------------------------------------------------------------

function MatchdayReport({
  teams,
  teamSize,
  formationId,
  season,
  turn,
  onContinue,
  onReset,
}: {
  teams: Team[];
  teamSize: TeamSize;
  formationId: string;
  season: SeasonState;
  turn: CareerState["lastTurn"] & {};
  onContinue: () => void;
  onReset: () => void;
}) {
  const human = teams.find((t) => t.isHuman)!;
  const mine = turn?.humanResult ?? null;
  const mineWon = mine ? (mine.homeId === "human" ? mine.homeGoals > mine.awayGoals : mine.awayGoals > mine.homeGoals) : false;
  const mineDrew = mine ? mine.homeGoals === mine.awayGoals : false;
  const myGoals = mine ? (mine.homeId === "human" ? mine.homeGoals : mine.awayGoals) : 0;
  const oppGoals = mine ? (mine.homeId === "human" ? mine.awayGoals : mine.homeGoals) : 0;
  const opponentName = mine ? (mine.homeId === "human" ? mine.awayName : mine.homeName) : "";
  const myFinance = mine
    ? mine.homeId === "human"
      ? mine.homeFinance
      : mine.awayFinance
    : undefined;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="animate-pop mb-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
          <CalendarDays className="h-3.5 w-3.5" /> Matchday {season.matchday} of {season.totalMatchdays}
        </span>
        <h1 className="mt-3 font-display text-4xl font-bold">
          {mine ? `${myGoals} – ${oppGoals}` : "Rest Week"}
        </h1>
        {mine ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {mineWon ? "Victory!" : mineDrew ? "A share of the spoils" : "Defeat"} vs{" "}
            <span className="font-medium text-foreground">{opponentName}</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No fixture for your club this matchday — the rest of the league played on.
          </p>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              All Results
            </h2>
            <ul className="space-y-2">
              {(turn?.results ?? []).map((r) => (
                <li
                  key={`${r.homeId}-${r.awayId}`}
                  className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{r.homeName}</span>
                  <span className="mx-2 shrink-0 font-mono font-bold">
                    {r.homeGoals} – {r.awayGoals}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-right">{r.awayName}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Updated Standings
            </h2>
            <StandingsTable rows={season.standings} />
          </div>

          {mine && myFinance && (
            <div className="rounded-2xl border border-border bg-card p-4 text-sm">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Club Finances
              </h2>
              <FinRow label="Prize money" value={`+$${myFinance.reward}M`} />
              {myFinance.repaid > 0 && (
                <FinRow label="Loan repaid (incl. interest)" value={`-$${myFinance.repaid}M`} />
              )}
              {myFinance.outstanding > 0 && (
                <FinRow
                  label="Debt carried forward"
                  value={`$${myFinance.outstanding}M`}
                  accent
                />
              )}
              <FinRow label="Budget now" value={`$${human.budget}M`} />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <SquadDashboard
            name={human.name}
            budget={human.budget}
            squad={human.squad}
            teamSize={teamSize}
            formationId={formationId}
            startingBudget={human.startingBudget}
            debt={human.debt}
          />
          <Button className="h-12 w-full text-base" onClick={onContinue}>
            {season.finished ? (
              <>
                <Trophy className="h-4 w-4" /> See Final Table
              </>
            ) : (
              <>
                Continue <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
          <Button variant="ghost" className="h-10 w-full" onClick={onReset}>
            <RotateCcw className="h-4 w-4" /> Abandon career
          </Button>
        </div>
      </div>
    </div>
  );
}

function FinRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-semibold", accent ? "text-destructive" : "text-money")}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Champion screen
// ---------------------------------------------------------------------------

function ChampionScreen({
  humanName,
  season,
  teams,
  teamSize,
  formationId,
  isChampion,
  onReset,
}: {
  humanName: string;
  season: SeasonState;
  teams: Team[];
  teamSize: TeamSize;
  formationId: string;
  isChampion: boolean;
  onReset: () => void;
}) {
  const sorted = sortStandings(season.standings);
  const humanRank = sorted.findIndex((r) => r.isHuman) + 1;
  const human = teams.find((t) => t.isHuman)!;

  return (
    <div className="relative mx-auto w-full max-w-5xl overflow-hidden px-4 py-10">
      {isChampion && <Confetti />}
      <header className="animate-pop relative mb-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-money/40 bg-money/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-money">
          {isChampion ? (
            <>
              <Crown className="h-3.5 w-3.5" /> League Champions
            </>
          ) : (
            <>
              <Trophy className="h-3.5 w-3.5" /> Season Complete
            </>
          )}
        </span>
        <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">
          {isChampion ? `The trophy is yours, ${humanName}!` : `${humanName} finish #${humanRank}`}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {season.totalMatchdays} matchdays · {sorted.length} clubs · final rating{" "}
          <span className="font-mono text-foreground">{squadRating(human)}</span>
        </p>
      </header>

      <div className="relative grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Final Standings
          </h2>
          <StandingsTable rows={sorted} />
        </div>
        <div className="space-y-4">
          <SquadDashboard
            name={human.name}
            budget={human.budget}
            squad={human.squad}
            teamSize={teamSize}
            formationId={formationId}
            startingBudget={human.startingBudget}
            debt={human.debt}
          />
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Final Budget
            </h2>
            <p className="font-mono text-2xl font-bold text-money">${human.budget}M</p>
          </div>
          <Button className="h-12 w-full text-base" onClick={onReset}>
            <RotateCcw className="h-4 w-4" /> New Career
          </Button>
          <BackLink />
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: `${(i * 97) % 100}%`,
        delay: `${(i % 10) * 0.18}s`,
        duration: `${2.6 + (i % 5) * 0.4}s`,
        color: ["#e8b33a", "#59c47e", "#4da3ff", "#e86a5e", "#b07ce8"][i % 5]!,
        size: 6 + (i % 4) * 3,
      })),
    [],
  );
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            backgroundColor: p.color,
            width: p.size,
            height: p.size * 1.6,
          }}
        />
      ))}
    </div>
  );
}
