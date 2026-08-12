import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { SetupScreen, type SetupResult } from "@/components/game/setup-screen";
import { MpAuctionScreen } from "@/components/game/mp-auction-screen";
import { SquadDashboard } from "@/components/game/squad-dashboard";
import { Button } from "@/components/ui/button";
import {
  createMpGame,
  other,
  reduceMp,
  type MpAction,
  type MpState,
  type PeerId,
} from "@/lib/mp-game";
import { ArrowLeft, PlayCircle, RotateCcw, Trophy, Users } from "lucide-react";
import { MatchSimScreen } from "@/components/game/match-sim-screen";

export const Route = createFileRoute("/local-multiplayer")({
  head: () => ({
    meta: [
      { title: "Local Two-Player Draft — Football Auction Draft" },
      {
        name: "description",
        content:
          "Pass-and-play on one device: two managers take turns bidding in the same auction draft, no internet needed.",
      },
      { property: "og:title", content: "Local Two-Player Draft — Football Auction Draft" },
      {
        property: "og:description",
        content: "Share one device and take turns bidding head-to-head. No connection required.",
      },
    ],
  }),
  component: LocalMultiplayer,
});

const DEFAULTS: Record<PeerId, string> = { host: "Player 1", guest: "Player 2" };

function LocalMultiplayer() {
  const [state, setState] = useState<MpState | null>(null);
  const [names, setNames] = useState<Record<PeerId, string>>(DEFAULTS);
  const [lastSetup, setLastSetup] = useState<SetupResult | null>(null);

  const start = useCallback(
    (setup: SetupResult) => {
      setLastSetup(setup);
      setState(
        createMpGame({
          teamSize: setup.teamSize,
          formationId: setup.formationId,
          startingBudget: setup.startingBudget,
          filter: setup.filter,
          hostName: names.host.trim() || DEFAULTS.host,
          guestName: names.guest.trim() || DEFAULTS.guest,
        }),
      );
    },
    [names],
  );

  const dispatch = useCallback((action: MpAction) => {
    setState((prev) => (prev ? reduceMp(prev, action) : prev));
  }, []);

  const rematch = () => lastSetup && start(lastSetup);

  const active = state?.turnId ?? "host";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Main menu
      </Link>

      {!state && (
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-3xl font-bold">Local Two-Player</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pass-and-play on one device. Take turns bidding — the screen always shows the manager
            whose move it is. No internet, no AI.
          </p>

          <div className="mt-6 grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
            {(["host", "guest"] as PeerId[]).map((id, i) => (
              <div key={id}>
                <label
                  htmlFor={`name-${id}`}
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Player {i + 1} club name
                </label>
                <input
                  id={`name-${id}`}
                  value={names[id]}
                  maxLength={18}
                  onChange={(e) => setNames((n) => ({ ...n, [id]: e.target.value }))}
                  className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card/40 p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">Draft settings</h2>
            <SetupScreen onStart={start} showOpponents={false} ctaLabel="Start Draft" />
          </div>
        </div>
      )}

      {state && state.phase !== "over" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h1 className="font-display text-2xl font-bold">Local Head-to-Head</h1>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Users className="h-3.5 w-3.5" /> {state.teams[active].name}&apos;s device
            </span>
          </div>
          <MpAuctionScreen
            state={state}
            meId={active}
            controlledIds={["host", "guest"]}
            onAction={dispatch}
          />
        </>
      )}

      {state && state.phase === "over" && (
        <LocalGameOver
          state={state}
          onSimulate={() => dispatch({ type: "simulate" })}
          onRematch={rematch}
          onExit={() => setState(null)}
        />
      )}

      {state && state.phase === "match" && state.match && (
        <MatchSimScreen
          sim={state.match}
          names={{ host: state.teams.host.name, guest: state.teams.guest.name }}
          points={state.points}
          canAdvance
          onNextRound={() => dispatch({ type: "newDraft" })}
        />
      )}
    </main>
  );
}

function LocalGameOver({
  state,
  onSimulate,
  onRematch,
  onExit,
}: {
  state: MpState;
  onSimulate: () => void;
  onRematch: () => void;
  onExit: () => void;
}) {
  const a = state.teams.host;
  const b = state.teams[other("host")];
  const aScore = a.squad.reduce((s, p) => s + p.ovr, 0);
  const bScore = b.squad.reduce((s, p) => s + p.ovr, 0);
  const verdict =
    aScore === bScore ? "Dead heat" : `${aScore > bScore ? a.name : b.name} wins!`;

  return (
    <div className="animate-pop">
      <header className="mb-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
          <Trophy className="h-3.5 w-3.5" /> Draft Complete
        </span>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{verdict}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {a.name} <span className="font-mono text-foreground">{aScore}</span> · {b.name}{" "}
          <span className="font-mono text-foreground">{bScore}</span>
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <SquadDashboard
          name={a.name}
          budget={a.budget}
          squad={a.squad}
          teamSize={state.teamSize}
          formationId={state.formationId}
        />
        <SquadDashboard
          name={b.name}
          budget={b.budget}
          squad={b.squad}
          teamSize={state.teamSize}
          formationId={state.formationId}
        />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button className="h-12 w-full text-base sm:col-span-2" onClick={onSimulate}>
          <PlayCircle className="h-4 w-4" /> Start Match Simulation
        </Button>
        <Button variant="secondary" className="h-12 w-full text-base" onClick={onRematch}>
          <RotateCcw className="h-4 w-4" /> Rematch
        </Button>
        <Button variant="ghost" className="h-12 w-full text-base" onClick={onExit}>
          New Settings
        </Button>
      </div>
    </div>
  );
}
