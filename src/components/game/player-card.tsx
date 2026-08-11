import type { Player, Position } from "@/lib/players";
import { cn } from "@/lib/utils";

const POSITION_LABEL: Record<Position, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

const ERA_LABEL: Record<Player["era"], string> = {
  current: "Current",
  retired: "Legend",
  women: "Women's",
};

/** Deterministic hue from a player id — same player, same colours. */
function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const SIZE_CLASS = {
  sm: "h-10 w-10 rounded-lg text-sm",
  md: "h-16 w-16 rounded-xl text-xl",
  lg: "h-24 w-24 rounded-2xl text-3xl",
} as const;

/** Generated gradient avatar (initials) — no image assets needed. */
export function PlayerAvatar({
  player,
  size = "md",
  className,
}: {
  player: Player;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const hue = hashHue(player.id);
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex shrink-0 items-center justify-center border border-white/15 font-display font-bold text-white shadow-md",
        SIZE_CLASS[size],
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 55% 38%) 0%, hsl(${(hue + 45) % 360} 60% 26%) 100%)`,
      }}
    >
      {initialsOf(player.name)}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.25),transparent_55%)]" />
    </div>
  );
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right font-mono text-xs text-foreground">{value}</span>
    </div>
  );
}

export function RevealedCard({ player }: { player: Player }) {
  return (
    <div className="animate-card-in relative overflow-hidden rounded-2xl border border-primary/40 bg-card p-5 shadow-lg shadow-primary/5">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
      <div className="mb-4 flex items-center gap-3">
        <div className="relative shrink-0">
          <PlayerAvatar player={player} size="md" />
          <span className="absolute -bottom-1.5 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 font-display text-xs font-bold leading-none text-primary-foreground shadow">
            {player.ovr}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-block rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
              Revealed
            </span>
            <span className="inline-block rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {ERA_LABEL[player.era]}
            </span>
          </div>
          <h3 className="mt-1.5 font-display text-xl font-semibold leading-tight text-balance">
            {player.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {POSITION_LABEL[player.position]} · {player.country}
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <StatBar label="PAC" value={player.pace} />
        <StatBar label="SHO" value={player.shooting} />
        <StatBar label="PAS" value={player.passing} />
        <StatBar label="DEF" value={player.defending} />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
        <span className="text-muted-foreground">Market value</span>
        <span className="font-mono font-semibold text-money">${player.value}M</span>
      </div>
    </div>
  );
}

export function HiddenCard({ hint }: { hint?: string }) {
  return (
    <div className="animate-card-in relative flex flex-col overflow-hidden rounded-2xl border border-dashed border-money/40 bg-card/60 p-5">
      <span className="inline-block w-fit rounded-md bg-money/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-money">
        Hidden
      </span>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
        <div className="animate-pulse-soft relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-money/40 bg-secondary font-display text-4xl text-money/60">
          ?
          <span className="pointer-events-none absolute inset-0 rounded-full bg-money/10 blur-md" />
        </div>
        <div>
          <p className="font-display text-lg font-semibold">Mystery Player</p>
          <p className="max-w-[16rem] text-xs text-muted-foreground text-pretty">
            {hint ??
              "Revealed after the bidding ends. Whoever misses out on the revealed player is compensated with them."}
          </p>
        </div>
      </div>
    </div>
  );
}

export function HiddenRevealedCard({ player }: { player: Player }) {
  return (
    <div className="animate-pop relative overflow-hidden rounded-2xl border border-money/40 bg-card p-5">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-money/10 blur-2xl" />
      <div className="mb-3 flex items-center gap-3">
        <PlayerAvatar player={player} size="md" />
        <div className="min-w-0">
          <span className="inline-block rounded-md bg-money/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-money">
            Hidden · Revealed
          </span>
          <h3 className="mt-1 font-display text-2xl font-semibold leading-tight text-balance">
            {player.name}
          </h3>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {POSITION_LABEL[player.position]} · {player.country} · OVR{" "}
        <span className="font-mono font-semibold text-foreground">{player.ovr}</span>
      </p>
    </div>
  );
}
