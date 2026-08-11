import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RevealedCard, HiddenCard, HiddenRevealedCard } from "@/components/game/player-card";
import { SquadDashboard } from "@/components/game/squad-dashboard";
import { hiddenCost, minMpBid, other, type MpAction, type MpState, type PeerId } from "@/lib/mp-game";
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
}: {
  state: MpState;
  meId: PeerId;
  onAction: (action: MpAction) => void;
}) {
  const me = state.teams[meId];
  const rival = state.teams[other(meId)];
  const myTurn = state.phase === "bidding" && state.turnId === meId;
  const min = minMpBid(state);
  const canAfford = min <= me.budget;

  const [bidInput, setBidInput] = useState(String(min));
  useEffect(() => {
    setBidInput(String(min));
  }, [min, state.round]);

  const parsed = Number.parseInt(bidInput, 10);
  const bidValid = myTurn && Number.isFinite(parsed) && parsed >= min && parsed <= me.budget;
  let bidError: string | null = null;
  if (myTurn && bidInput.trim() !== "") {
    if (!Number.isFinite(parsed)) bidError = "Enter a number";
    else if (parsed < min) bidError = `Minimum bid is $${min}M`;
    else if (parsed > me.budget) bidError = `Over budget ($${me.budget}M left)`;
  }

  const result = state.result;

  // Resolution sound when the round flips to resolved.
  const prevPhase = useRef(state.phase);
  useEffect(() => {
    if (prevPhase.current === "bidding" && state.phase === "resolved") sfx.win();
    prevPhase.current = state.phase;
  }, [state.phase]);

  const raise = (amount: number) => {
    sfx.bid();
    onAction({ type: "raise", by: meId, amount });
  };
  const concede = () => {
    sfx.hidden();
    onAction({ type: "concede", by: meId });
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
          {state.phase === "bidding" ? (
            <HiddenCard hint="Whoever drops out of this race receives the hidden player." />
          ) : (
            <HiddenRevealedCard player={state.hidden} />
          )}
        </div>

        {state.phase === "bidding" ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <label
              htmlFor="mp-bid"
              className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Your bid (in $M)
            </label>
            <div className="flex items-stretch gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                  $
                </span>
                <input
                  id="mp-bid"
                  type="number"
                  inputMode="numeric"
                  min={min}
                  max={me.budget}
                  value={bidInput}
                  disabled={!myTurn || !canAfford}
                  onChange={(e) => setBidInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && bidValid) raise(parsed);
                  }}
                  className={cn(
                    "h-12 w-full rounded-xl border bg-background pl-7 pr-4 font-mono text-lg font-semibold outline-none transition-colors",
                    "focus:border-primary focus:ring-2 focus:ring-primary/30",
                    bidError ? "border-destructive" : "border-border",
                    (!myTurn || !canAfford) && "cursor-not-allowed opacity-50",
                  )}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-12 w-12 p-0"
                disabled={!myTurn || !canAfford}
                onClick={() =>
                  setBidInput(
                    String(
                      Math.min(me.budget, Math.max(min, (Number.isFinite(parsed) ? parsed : min) + 2)),
                    ),
                  )
                }
                aria-label="Increase bid"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p
              className={cn(
                "mt-1.5 min-h-[1rem] text-xs",
                bidError ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {bidError ??
                (myTurn
                  ? `Enter at least $${min}M · $${me.budget}M budget remaining`
                  : `${rival.name} is deciding…`)}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Button className="h-12 text-base" disabled={!bidValid} onClick={() => raise(parsed)}>
                <Gavel className="h-4 w-4" />
                Place Bid
              </Button>
              <Button
                variant="secondary"
                className="h-12 text-base"
                disabled={!myTurn}
                onClick={concede}
              >
                <Flag className="h-4 w-4" />
                Drop out · take hidden (~${hiddenCost(state, meId)}M)
              </Button>
            </div>
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
