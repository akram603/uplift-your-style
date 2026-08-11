import type { Player } from "@/lib/players";
import {
  formationsForSize,
  slotsForSize,
  type FormationSlot,
  type TeamSize,
} from "@/lib/formations";
import { PlayerAvatar } from "@/components/game/player-card";
import { Wallet, AlertTriangle } from "lucide-react";

/** Assigns squad players to formation slots, preferring positional fit. */
function assignToSlots(slots: FormationSlot[], squad: Player[]): (Player | null)[] {
  const filled: (Player | null)[] = slots.map(() => null);
  const remaining = [...squad];

  slots.forEach((slot, i) => {
    const idx = remaining.findIndex((p) => p.position === slot.position);
    if (idx !== -1) {
      filled[i] = remaining[idx]!;
      remaining.splice(idx, 1);
    }
  });
  slots.forEach((_, i) => {
    if (filled[i] === null && remaining.length) {
      filled[i] = remaining.shift()!;
    }
  });
  return filled;
}

function SlotChip({ player, position }: { player: Player | null; position: string }) {
  if (!player) {
    return (
      <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full border border-dashed border-border/70 bg-background/40 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:h-[4.5rem] sm:w-[4.5rem]">
        {position}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <PlayerAvatar player={player} size="sm" className="h-16 w-16 rounded-full text-base sm:h-[4.5rem] sm:w-[4.5rem] sm:text-lg" />
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 py-px font-display text-[10px] font-bold leading-tight text-primary-foreground">
          {player.ovr}
        </span>
      </div>
      <span className="max-w-[5.5rem] truncate text-[10px] font-medium text-foreground">
        {player.name.split(" ").slice(-1)}
      </span>
    </div>
  );
}

export function SquadDashboard({
  name,
  budget,
  squad,
  teamSize,
  formationId,
  startingBudget = 100,
  debt = 0,
  penalty = false,
}: {
  name: string;
  budget: number;
  squad: Player[];
  teamSize: TeamSize;
  formationId?: string | undefined;
  startingBudget?: number;
  debt?: number;
  penalty?: boolean;
}) {
  const slots = slotsForSize(teamSize, formationId);
  const formation =
    formationsForSize(teamSize).find((f) => f.id === formationId) ?? formationsForSize(teamSize)[0];
  const filled = assignToSlots(slots, squad);
  const rows = Array.from(new Set(slots.map((s) => s.row))).sort((a, b) => a - b);
  const spent = startingBudget - budget;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">{name}</h2>
          <p className="text-xs text-muted-foreground">
            {squad.length} / {teamSize} signed{formation ? ` · ${formation.label}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-money/10 px-3 py-1.5">
          <Wallet className="h-4 w-4 text-money" aria-hidden="true" />
          <span className="font-mono text-base font-bold text-money">${budget}M</span>
        </div>
      </div>

      {debt > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-destructive">
            Current Debt
          </span>
          <span className="font-mono text-sm font-bold text-destructive">${debt}M</span>
        </div>
      )}

      {penalty && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/15 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Financial penalty: loan not fully repaid. Transfer funds stay frozen until the debt is
            cleared.
          </span>
        </div>
      )}

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
        <div
          className="h-full rounded-full bg-money transition-all"
          style={{ width: `${Math.min(100, Math.max(0, (budget / startingBudget) * 100))}%` }}
        />
      </div>

      <div
        className="relative flex flex-col justify-between gap-4 rounded-xl border border-primary/15 bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_70%)] p-4 py-6"
        style={{ minHeight: teamSize === 11 ? 420 : 300 }}
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20" />
        <div className="pointer-events-none absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 bg-primary/15" />
        {[...rows].reverse().map((row) => {
          const rowSlotIdx = slots
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => s.row === row)
            .map(({ i }) => i);
          return (
            <div key={row} className="flex items-center justify-center gap-4 sm:gap-8">
              {rowSlotIdx.map((i) => (
                <SlotChip key={i} player={filled[i] ?? null} position={slots[i]!.position} />
              ))}
            </div>
          );
        })}
      </div>

      {spent > 0 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Spent <span className="font-mono text-foreground">${spent}M</span> so far
        </p>
      )}
    </div>
  );
}
