import { useEffect, useRef, useState } from "react";
import type { AuctionState, Team } from "@/lib/game";
import { minLegalBid, increment, hiddenPriceFor, loanHeadroom, MAX_LOAN, LOAN_INTEREST } from "@/lib/game";
import { RevealedCard, HiddenCard, HiddenRevealedCard } from "@/components/game/player-card";
import { Button } from "@/components/ui/button";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { Gavel, Eye, Sparkles, ArrowRight, CheckCircle2, Plus, Landmark, AlertTriangle, Brain } from "lucide-react";

const LOG_DOT: Record<string, string> = {
  info: "bg-muted-foreground",
  bid: "bg-primary",
  win: "bg-money",
  hidden: "bg-money",
};

export function AuctionScreen({
  state,
  teams,
  totalRounds,
  onBid,
  onTakeHidden,
  onPass,
  onNextRound,
  onTakeLoan,
  isLastRound,
}: {
  state: AuctionState;
  teams: Team[];
  totalRounds: number;
  onBid: (amount: number) => void;
  onTakeHidden: () => void;
  onPass: () => void;
  onNextRound: () => void;
  onTakeLoan: (amount: number) => void;
  isLastRound: boolean;
}) {
  const human = teams.find((t) => t.isHuman)!;
  const min = minLegalBid(state);
  const canAffordMin = min <= human.budget;
  const takeHiddenCost = hiddenPriceFor(state);
  const canTakeHidden = state.phase === "bidding" && takeHiddenCost <= human.budget;
  const highBidderName = teams.find((t) => t.id === state.highBidderId)?.name;
  const leadingIsHuman = state.highBidderId === human.id;
  const headroom = loanHeadroom(human);
  const shortfall = Math.max(0, min - human.budget);
  const loanSuggestion = Math.min(headroom, Math.max(shortfall, 5));
  const canTakeLoan = state.phase === "bidding" && headroom > 0 && shortfall > 0;

  const [bidInput, setBidInput] = useState<string>(String(min));
  useEffect(() => {
    setBidInput(String(min));
  }, [min]);

  // Play resolution sounds when the auction flips to resolved.
  const prevPhase = useRef(state.phase);
  useEffect(() => {
    if (prevPhase.current === "bidding" && state.phase === "resolved") {
      if (state.humanTookHidden || state.aiBluffed) sfx.hidden();
      else sfx.win();
    }
    prevPhase.current = state.phase;
  }, [state.phase, state.humanTookHidden, state.aiBluffed]);

  const parsed = Number.parseInt(bidInput, 10);
  const bidValid =
    state.phase === "bidding" &&
    Number.isFinite(parsed) &&
    parsed >= min &&
    parsed <= human.budget;
  let bidError: string | null = null;
  if (state.phase === "bidding" && bidInput.trim() !== "") {
    if (!Number.isFinite(parsed)) bidError = "Enter a number";
    else if (parsed < min) bidError = `Minimum bid is $${min}M`;
    else if (parsed > human.budget) bidError = `Over budget ($${human.budget}M left)`;
  }

  const submitBid = () => {
    if (bidValid) {
      sfx.bid();
      onBid(parsed);
    }
  };
  const bump = (delta: number) => {
    const base = Number.isFinite(parsed) ? parsed : min;
    const nextVal = Math.min(human.budget, Math.max(min, base + delta));
    setBidInput(String(nextVal));
  };

  const result = state.result;
  const humanWonRevealed = result?.revealedWinnerId === human.id;
  const humanGotHidden = result?.hiddenWinnerId === human.id;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Round {state.round} of {totalRounds}
            </span>
            <div className="font-display text-lg font-semibold">
              Bidding opens at $0M — type any amount
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground">Current high bid</span>
            <div
              className={cn(
                "font-mono text-xl font-bold",
                leadingIsHuman ? "text-primary" : "text-foreground",
              )}
            >
              {state.highBidderId ? `$${state.currentBid}M` : "—"}
            </div>
            {highBidderName && (
              <span className="text-[11px] text-muted-foreground">
                {leadingIsHuman ? "You lead" : `${highBidderName} leads`}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
          <div>
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Available cash
            </span>
            <div className="font-mono text-lg font-bold text-money">${human.budget}M</div>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Current Debt
            </span>
            <div
              className={cn(
                "font-mono text-lg font-bold",
                human.debt > 0 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              ${human.debt}M
            </div>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Loan headroom
            </span>
            <div className="font-mono text-lg font-bold">${headroom}M</div>
            <span className="text-[10px] text-muted-foreground">
              of ${MAX_LOAN}M max · {Math.round(LOAN_INTEREST * 100)}% interest
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <RevealedCard player={state.revealed} />
          {state.phase === "resolved" ? (
            <HiddenRevealedCard player={state.hidden} />
          ) : (
            <HiddenCard />
          )}
        </div>

        {state.phase === "bidding" ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <label
              htmlFor="bid-amount"
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
                  id="bid-amount"
                  type="number"
                  inputMode="numeric"
                  min={min}
                  max={human.budget}
                  value={bidInput}
                  disabled={!canAffordMin}
                  onChange={(e) => setBidInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitBid();
                  }}
                  className={cn(
                    "h-12 w-full rounded-xl border bg-background pl-7 pr-16 font-mono text-lg font-semibold text-foreground outline-none transition-colors",
                    "focus:border-primary focus:ring-2 focus:ring-primary/30",
                    bidError ? "border-destructive" : "border-border",
                    !canAffordMin && "cursor-not-allowed opacity-50",
                  )}
                  aria-invalid={!!bidError}
                  aria-describedby="bid-help"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                  M
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-12 w-12 p-0"
                disabled={!canAffordMin}
                onClick={() => bump(increment(state.currentBid || state.base))}
                aria-label="Increase bid"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p
              id="bid-help"
              className={cn(
                "mt-1.5 min-h-[1rem] text-xs",
                bidError ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {bidError ?? `Enter at least $${min}M · $${human.budget}M budget remaining`}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Button className="h-12 text-base" disabled={!bidValid} onClick={submitBid}>
                <Gavel className="h-4 w-4" />
                {canAffordMin ? "Place Bid" : "Budget too low"}
              </Button>
              <Button
                variant="secondary"
                className="h-12 text-base"
                disabled={!canTakeHidden}
                onClick={() => {
                  sfx.hidden();
                  onTakeHidden();
                }}
              >
                <Sparkles className="h-4 w-4" />
                Take Hidden (~${takeHiddenCost}M)
              </Button>
              {canTakeLoan && (
                <Button
                  variant="outline"
                  className="h-12 text-base sm:col-span-2"
                  onClick={() => {
                    sfx.coin();
                    onTakeLoan(loanSuggestion);
                  }}
                >
                  <Landmark className="h-4 w-4" />
                  Take a Loan (+${loanSuggestion}M)
                </Button>
              )}
              {human.debt > 0 && (
                <p className="flex items-center gap-1.5 text-[11px] text-destructive sm:col-span-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  ${human.debt}M borrowed — repaid with{" "}
                  {Math.round(LOAN_INTEREST * 100)}% interest at your next match.
                </p>
              )}
              {!canAffordMin && !canTakeHidden && !canTakeLoan && (
                <Button
                  variant="ghost"
                  className="h-10 text-sm sm:col-span-2"
                  onClick={() => {
                    sfx.click();
                    onPass();
                  }}
                >
                  Pass — you can&apos;t afford to compete this round
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="animate-pop rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 space-y-1.5 text-sm">
              <ResultLine
                ok={humanWonRevealed}
                text={
                  humanWonRevealed
                    ? `You signed ${state.revealed.name} for $${result?.revealedPrice}M`
                    : `${teams.find((t) => t.id === result?.revealedWinnerId)?.name ?? "Nobody"} signed ${state.revealed.name}`
                }
              />
              <ResultLine
                ok={humanGotHidden}
                text={
                  humanGotHidden
                    ? `You landed the hidden ${state.hidden.name} for $${result?.hiddenPrice}M`
                    : `${teams.find((t) => t.id === result?.hiddenWinnerId)?.name ?? "Nobody"} received the hidden ${state.hidden.name}`
                }
              />
            </div>
            {state.aiBluffed && (
              <p className="mb-3 flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
                <Brain className="mt-0.5 h-4 w-4 shrink-0" />
                Mind games! An opponent deliberately walked away from the revealed player to grab
                the hidden one — they know your squad is getting stronger.
              </p>
            )}
            {state.humanTookHidden && (
              <p className="mb-3 flex items-start gap-2 rounded-lg border border-money/40 bg-money/10 px-3 py-2 text-xs text-money">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                You gambled on the mystery player. Risky… but sometimes the best XI is built on
                instincts.
              </p>
            )}
            <Button
              className="h-11 w-full text-base"
              onClick={() => {
                sfx.click();
                onNextRound();
              }}
            >
              {isLastRound ? "Finish Draft" : "Next Round"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> Managers
          </h3>
          <ul className="space-y-2">
            {teams.map((t) => (
              <li
                key={t.id}
                className={cn(
                  "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm",
                  t.id === state.highBidderId
                    ? "animate-pulse-soft bg-primary/10"
                    : "bg-background/40",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn("font-medium", t.isHuman && "text-primary")}>{t.name}</span>
                  <span className="text-[11px] text-muted-foreground">{t.squad.length} signed</span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-xs font-semibold text-money">
                    ${t.budget}M
                  </span>
                  {t.debt > 0 && (
                    <span className="block font-mono text-[10px] text-destructive">
                      -${t.debt}M debt
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Auction Feed
          </h3>
          <ul className="max-h-64 space-y-2 overflow-y-auto pr-1 [contain:content] overscroll-contain [-webkit-overflow-scrolling:touch]">
            {state.log.map((entry) => (
              <li key={entry.id} className="flex gap-2 text-xs leading-relaxed">
                <span
                  className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", LOG_DOT[entry.kind])}
                />
                <span className="text-muted-foreground">{entry.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function ResultLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className={cn("h-4 w-4 shrink-0", ok ? "text-primary" : "text-muted-foreground")} />
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{text}</span>
    </div>
  );
}
