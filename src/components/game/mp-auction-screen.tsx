import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RevealedCard, HiddenCard, HiddenRevealedCard } from "@/components/game/player-card";
import { SquadDashboard } from "@/components/game/squad-dashboard";
import { hiddenCost, minMpBid, other, type MpAction, type MpState, type PeerId } from "@/lib/mp-game";
import { Timer } from "lucide-react";
import { sfx } from "@/lib/sfx";
import { ArrowRight, Flag, Gavel, Plus, Wifi } from "lucide-react";

const LOG_DOT: Record<string, string> = {
  info: "bg-muted-foreground",
  bid: "bg-primary",
  win: "bg-money",
  hidden: "bg-money",
};

export function MpAuctionScreen({
  state,
  meId,
  onAction,
  controlledIds,
}: {
  state: MpState;
  meId: PeerId;
  onAction: (action: MpAction) => void;
  /** Which managers can bid from this device (local play controls both). */
  controlledIds?: PeerId[];
}) {
  const controlled = controlledIds ?? [meId];
  const me = state.teams[meId];
  const rival = state.teams[other(meId)];
  const bidding = state.phase === "bidding";
  const min = minMpBid(state);

  // Live countdown — anyone may type any amount until the hammer falls.
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000)));
  useEffect(() => {
    if (!bidding) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000)));
    tick();
    const t = window.setInterval(tick, 250);
    return () => window.clearInterval(t);
  }, [state.endsAt, bidding, state.round]);

  const firedRef = useRef(false);
  useEffect(() => {
    firedRef.current = false;
  }, [state.endsAt, state.round]);
  useEffect(() => {
    if (!bidding || left > 0 || firedRef.current) return;
    if (!controlled.includes("host") && meId !== "host") return;
    firedRef.current = true;
    onAction({ type: "timeout" });
  }, [left, bidding, controlled, meId, onAction]);

  const result = state.result;

  const prevPhase = useRef(state.phase);
  useEffect(() => {
    if (prevPhase.current === "bidding" && state.phase === "resolved") sfx.win();
    prevPhase.current = state.phase;
  }, [state.phase]);

  const raise = (by: PeerId, amount: number) => {
    sfx.bid();
    onAction({ type: "raise", by, amount });
  };
  const concede = (by: PeerId) => {
    sfx.hidden();
    onAction({ type: "concede", by });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Round {state.round} of {state.totalRounds}
            </span>
            <div className="font-display text-lg font-semibold">Opening price ${state.base}M</div>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground">Current high bid</span>
            <div
              className={cn(
                "font-mono text-xl font-bold",
                state.highBidderId === meId ? "text-primary" : "text-foreground",
              )}
            >
              {state.highBidderId ? `$${state.currentBid}M` : "—"}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {state.phase === "bidding"
                ? myTurn
                  ? "Your move"
                  : `Waiting for ${rival.name}…`
                : "Round resolved"}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <RevealedCard player={state.revealed} />
          {bidding ? (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Free bidding — any amount, any time
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-sm font-bold",
                  left <= 5 ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary",
                )}
              >
                <Timer className="h-3.5 w-3.5" /> {left}s
              </span>
            </div>
            {controlled.map((id) => (
              <BidRow
                key={id}
                label={state.teams[id].name}
                budget={state.teams[id].budget}
                min={min}
                leading={state.highBidderId === id}
                onBid={(amount) => raise(id, amount)}
                onConcede={() => concede(id)}
                hiddenCost={hiddenCost(state, id)}
              />
            ))}
          </div>
        ) : state.phase === "resolved" && result ? (
          <div className="animate-pop rounded-2xl border border-border bg-card p-4">
            <ul className="mb-3 space-y-1.5 text-sm">
              <li className={result.revealedWinnerId === meId ? "text-foreground" : "text-muted-foreground"}>
                {state.teams[result.revealedWinnerId ?? "host"].name} signed {state.revealed.name} for $
                {result.revealedPrice}M
              </li>
              <li className={result.hiddenWinnerId === meId ? "text-foreground" : "text-muted-foreground"}>
                {state.teams[result.hiddenWinnerId ?? "guest"].name} received the hidden {state.hidden.name}{" "}
                for ${result.hiddenPrice}M
              </li>
            </ul>
            <Button
              className="h-11 w-full text-base"
              onClick={() => onAction({ type: "next", by: meId })}
            >
              {state.round >= state.totalRounds ? "Finish Draft" : "Next Round"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Wifi className="h-3.5 w-3.5" /> Managers
          </h3>
          <ul className="space-y-2">
            {(["host", "guest"] as PeerId[]).map((id) => {
              const t = state.teams[id];
              return (
                <li
                  key={id}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm",
                    state.turnId === id && state.phase === "bidding"
                      ? "bg-primary/10"
                      : "bg-background/40",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("font-medium", id === meId && "text-primary")}>
                      {t.name}
                      {id === meId ? " (you)" : ""}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{t.squad.length} signed</span>
                  </span>
                  <span className="font-mono text-xs font-semibold text-money">${t.budget}M</span>
                </li>
              );
            })}
          </ul>
        </div>

        <SquadDashboard
          name={me.name}
          budget={me.budget}
          squad={me.squad}
          teamSize={state.teamSize}
          formationId={state.formationId}
        />

        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Auction Feed
          </h3>
          <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {state.log.map((entry) => (
              <li key={entry.id} className="flex gap-2 text-xs leading-relaxed">
                <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", LOG_DOT[entry.kind])} />
                <span className="text-muted-foreground">{entry.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
