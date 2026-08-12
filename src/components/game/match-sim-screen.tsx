import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sfx";
import type { MatchSim } from "@/lib/mp-match";
import type { PeerId } from "@/lib/mp-game";
import { FastForward, RotateCcw, Trophy } from "lucide-react";

/** Live text commentary of a simulated head-to-head, plus the leaderboard. */
export function MatchSimScreen({
  sim,
  names,
  points,
  canAdvance,
  onNextRound,
}: {
  sim: MatchSim;
  names: Record<PeerId, string>;
  points: Record<PeerId, number>;
  canAdvance: boolean;
  onNextRound: () => void;
}) {
  const [clock, setClock] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    timer.current = window.setInterval(() => {
      setClock((m) => {
        if (m >= 90) {
          if (timer.current) window.clearInterval(timer.current);
          return 90;
        }
        return m + 1;
      });
    }, 90);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [sim]);

  const shown = useMemo(
    () => sim.events.filter((e) => e.minute <= clock || (clock >= 90 && e.kind === "fulltime")),
    [sim, clock],
  );
  const goalsSoFar = shown.filter((e) => e.kind === "goal");
  const hostGoals = goalsSoFar.filter((e) => e.side === "host").length;
  const guestGoals = goalsSoFar.filter((e) => e.side === "guest").length;
  const done = clock >= 90;

  const prevGoals = useRef(0);
  useEffect(() => {
    if (goalsSoFar.length > prevGoals.current) sfx.win();
    prevGoals.current = goalsSoFar.length;
  }, [goalsSoFar.length]);

  const verdict =
    sim.winner === null ? "Draw — 1 point each" : `${names[sim.winner]} wins — 3 points`;

  return (
    <div className="animate-pop space-y-4">
      <div className="rounded-2xl border border-primary/30 bg-card p-5 text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {done ? "Full time" : `${clock}'`}
        </span>
        <div className="mt-2 flex items-center justify-center gap-4 font-display text-2xl font-bold sm:text-3xl">
          <span className="flex-1 text-right">{names.host}</span>
          <span className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-1 font-mono text-primary">
            {hostGoals} : {guestGoals}
          </span>
          <span className="flex-1 text-left">{names.guest}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Squad rating {sim.hostRating} vs {sim.guestRating} · ATT {sim.hostAttack}/{sim.guestAttack}{" "}
          · DEF {sim.hostDefense}/{sim.guestDefense}
        </p>
        {!done && (
          <Button variant="ghost" className="mt-3 h-9" onClick={() => setClock(90)}>
            <FastForward className="h-4 w-4" /> Skip to full time
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Live commentary
        </h3>
        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {[...shown].reverse().map((e, i) => (
            <li key={`${e.minute}-${i}`} className="flex gap-2 text-sm leading-relaxed">
              <span className="w-9 shrink-0 font-mono text-xs text-muted-foreground">
                {e.minute}&apos;
              </span>
              <span
                className={cn(
                  e.kind === "goal"
                    ? "font-semibold text-primary"
                    : e.kind === "fulltime"
                      ? "font-semibold text-money"
                      : "text-muted-foreground",
                )}
              >
                {e.text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {done && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" /> Leaderboard
          </h3>
          <p className="mb-3 text-sm font-semibold">{verdict}</p>
          <ul className="space-y-2">
            {(["host", "guest"] as PeerId[])
              .sort((a, b) => points[b] - points[a])
              .map((id) => (
                <li
                  key={id}
                  className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{names[id]}</span>
                  <span className="font-mono font-semibold text-primary">{points[id]} pts</span>
                </li>
              ))}
          </ul>
          {canAdvance ? (
            <Button className="mt-4 h-12 w-full text-base" onClick={onNextRound}>
              <RotateCcw className="h-4 w-4" /> Next Round — new draft
            </Button>
          ) : (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Waiting for the host to start the next round…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
