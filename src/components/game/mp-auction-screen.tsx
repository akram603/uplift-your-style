import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RevealedCard, HiddenCard, HiddenRevealedCard } from "@/components/game/player-card";
import { SquadDashboard } from "@/components/game/squad-dashboard";
import { hiddenCost, minMpBid, other, type MpAction, type MpState, type PeerId } from "@/lib/mp-game";
import { Timer, ArrowRight, Flag, Gavel, Wifi, Crown } from "lucide-react";
import { sfx } from "@/lib/sfx";
import { useCountdown } from "@/hooks/use-countdown";

const LOG_DOT: Record<string, string> = {
  info: "bg-muted-foreground",
  bid: "bg-primary",
  win: "bg-money",
  hidden: "bg-money",
};

function MpAuctionScreenBase({
  state,
  meId,
  onAction,
  controlledIds,
}: {
  state: MpState;
  meId: PeerId;
  onAction: (action: MpAction) => void;
  controlledIds?: PeerId[];
}) {
  const controlled = useMemo(() => controlledIds ?? [meId], [controlledIds, meId]);
  const me = state.teams[meId];
  const rival = state.teams[other(meId)];
  const bidding = state.phase === "bidding";
  const min = useMemo(() => minMpBid(state), [state]);
  const isMyTurn = bidding && controlled.includes(state.turnId);
  const turnName = state.teams[state.turnId].name;

  const left = useCountdown(state.endsAt, bidding);

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
  const prevTurn = useRef(state.turnId);
  useEffect(() => {
    if (prevPhase.current === "bidding" && state.phase === "resolved") sfx.win();
    if (bidding && prevTurn.current !== state.turnId) {
      if (controlled.includes(state.turnId)) sfx.bid();
      else sfx.counter();
    }
    prevPhase.current = state.phase;
    prevTurn.current = state.turnId;
  }, [state.phase, state.turnId, bidding, controlled]);

  const raise = useCallback(
    (by: PeerId, amount: number) => {
      sfx.bid();
      onAction({ type: "raise", by, amount });
    },
    [onAction],
  );
  const pass = useCallback(
    (by: PeerId) => {
      sfx.hidden();
      onAction({ type: "pass", by });
    },
    [onAction],
  );

  const timerPct = Math.min(100, (left / 15) * 100);
  const timerUrgent = left <= 5;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {/* Round + timer header */}
        <div className="glass rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Round {state.round} of {state.totalRounds}
              </span>
              <div className="font-display text-lg font-semibold">
                {bidding ? "Turn-based auction" : "Round resolved"}
              </div>
            </div>
            {bidding && (
              <div className="flex items-center gap-4">
                <div className="relative flex h-14 w-14 items-center justify-center">
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      fill="none"
                      strokeWidth="3"
                      className="stroke-secondary/40"
                    />
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      fill="none"
                      strokeWidth="3"
                      strokeLinecap="round"
                      className={cn(
                        "transition-all duration-300",
                        timerUrgent ? "stroke-destructive" : "stroke-primary",
                      )}
                      strokeDasharray={150.8}
                      strokeDashoffset={150.8 - (150.8 * timerPct) / 100}
                    />
                  </svg>
                  <span
                    className={cn(
                      "font-mono text-lg font-bold",
                      timerUrgent ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {left}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">Current turn</span>
                  <div
                    className={cn(
                      "font-display text-base font-bold",
                      isMyTurn ? "text-gold-gradient" : "text-foreground",
                    )}
                  >
                    {isMyTurn ? "Your turn" : turnName}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bid info bar */}
        <div className="glass rounded-2xl p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                High bid
              </span>
              <div
                className={cn(
                  "font-mono text-2xl font-bold",
                  state.highBidderId === meId ? "text-primary" : "text-foreground",
                )}
              >
                {state.highBidderId ? `$${state.currentBid}M` : "—"}
              </div>
              {state.highBidderId && (
                <span className="text-[11px] text-muted-foreground">
                  {state.highBidderId === meId ? "You lead" : `${state.teams[state.highBidderId].name} leads`}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Min bid
              </span>
              <div className="font-mono text-2xl font-bold text-money">${min}M</div>
            </div>
          </div>
        </div>

        {/* Player cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <RevealedCard player={state.revealed} />
          {bidding ? (
            <HiddenCard hint="Whoever passes gets this player as compensation." />
          ) : (
            <HiddenRevealedCard player={state.hidden} />
          )}
        </div>

        {/* Action area */}
        {bidding ? (
          <div className="glass-strong rounded-2xl p-5">
            {controlled.map((id) => (
              <TurnActions
                key={id}
                label={state.teams[id].name}
                isYou={id === meId}
                active={state.turnId === id}
                budget={state.teams[id].budget}
                min={min}
                onBid={(amount) => raise(id, amount)}
                onPass={() => pass(id)}
                hiddenCost={hiddenCost(state, id)}
              />
            ))}
            {!isMyTurn && controlled.length === 1 && (
              <p className="mt-3 text-center text-sm text-muted-foreground animate-pulse-soft">
                Waiting for {turnName} to make their move…
              </p>
            )}
          </div>
        ) : state.phase === "resolved" && result ? (
          <div className="glass-strong animate-pop rounded-2xl p-5">
            <ul className="mb-4 space-y-2 text-sm">
              <li
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2",
                  result.revealedWinnerId === meId ? "bg-primary/10" : "bg-secondary/30",
                )}
              >
                <Crown
                  className={cn(
                    "h-4 w-4 shrink-0",
                    result.revealedWinnerId === meId ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className={result.revealedWinnerId === meId ? "text-foreground" : "text-muted-foreground"}>
                  {state.teams[result.revealedWinnerId ?? "host"].name} signed {state.revealed.name} for $
                  {result.revealedPrice}M
                </span>
              </li>
              <li
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2",
                  result.hiddenWinnerId === meId ? "bg-money/10" : "bg-secondary/30",
                )}
              >
                <Flag
                  className={cn(
                    "h-4 w-4 shrink-0",
                    result.hiddenWinnerId === meId ? "text-money" : "text-muted-foreground",
                  )}
                />
                <span className={result.hiddenWinnerId === meId ? "text-foreground" : "text-muted-foreground"}>
                  {state.teams[result.hiddenWinnerId ?? "guest"].name} received the hidden{" "}
                  {state.hidden.name} for ${result.hiddenPrice}M
                </span>
              </li>
            </ul>
            <Button
              className="h-12 w-full text-base"
              onClick={() => onAction({ type: "next", by: meId })}
            >
              {state.round >= state.totalRounds ? "Finish Draft" : "Next Round"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>

      {/* Sidebar */}
      <aside className="space-y-4">
        <div className="glass rounded-2xl p-4">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Wifi className="h-3.5 w-3.5" /> Managers
          </h3>
          <ul className="space-y-2">
            {(["host", "guest"] as PeerId[]).map((id) => {
              const t = state.teams[id];
              const isActive = state.turnId === id && state.phase === "bidding";
              return (
                <li
                  key={id}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all",
                    isActive ? "glass-gold animate-turn-flash" : "bg-secondary/20",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        isActive ? "bg-primary animate-pulse-soft" : "bg-muted-foreground/40",
                      )}
                    />
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

        <div className="glass rounded-2xl p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Auction Feed
          </h3>
          <ul className="max-h-64 space-y-2 overflow-y-auto pr-1 [contain:content] overscroll-contain [-webkit-overflow-scrolling:touch]">
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

export const MpAuctionScreen = memo(MpAuctionScreenBase);

const TurnActions = memo(function TurnActions({
  label,
  isYou,
  active,
  budget,
  min,
  onBid,
  onPass,
  hiddenCost,
}: {
  label: string;
  isYou: boolean;
  active: boolean;
  budget: number;
  min: number;
  onBid: (amount: number) => void;
  onPass: () => void;
  hiddenCost: number;
}) {
  const [value, setValue] = useState("");
  const parsed = Number.parseInt(value, 10);
  const valid = Number.isFinite(parsed) && parsed >= min && parsed <= budget;
  let error: string | null = null;
  if (value.trim() !== "") {
    if (!Number.isFinite(parsed)) error = "Enter a number";
    else if (parsed < min) error = `Must bid at least $${min}M`;
    else if (parsed > budget) error = `Over budget ($${budget}M left)`;
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all",
        active
          ? "border-primary/40 glass-gold glow-soft"
          : "border-border bg-secondary/20 opacity-50",
      )}
    >
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className={cn("font-semibold", active ? "text-gold-gradient" : "text-muted-foreground")}>
          {label}
          {isYou ? " (you)" : ""}
          {active ? " · your turn" : ""}
        </span>
        <span className="font-mono text-money">${budget}M</span>
      </div>
      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
            $
          </span>
          <input
            type="number"
            inputMode="numeric"
            placeholder={`Bid at least $${min}M`}
            value={value}
            disabled={!active}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid && active) {
                onBid(parsed);
                setValue("");
              }
            }}
            className={cn(
              "h-12 w-full rounded-xl border bg-background/60 pl-7 pr-3 font-mono text-lg font-semibold outline-none transition-colors",
              "focus:border-primary focus:ring-2 focus:ring-primary/20",
              error ? "border-destructive" : "border-border",
              !active && "cursor-not-allowed",
            )}
          />
        </div>
        <Button
          className="h-12"
          disabled={!active || !valid}
          onClick={() => {
            onBid(parsed);
            setValue("");
          }}
        >
          <Gavel className="h-4 w-4" /> Bid
        </Button>
        <Button
          variant="secondary"
          className="h-12"
          disabled={!active}
          onClick={onPass}
        >
          <Flag className="h-4 w-4" /> Pass
        </Button>
      </div>
      <p className={cn("mt-1.5 text-[11px]", error ? "text-destructive" : "text-muted-foreground")}>
        {error ?? `Pass to take the hidden player for ~$${hiddenCost}M`}
      </p>
    </div>
  );
});
