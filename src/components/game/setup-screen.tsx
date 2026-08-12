import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  formationsForSize,
  defaultFormationId,
  type TeamSize,
} from "@/lib/formations";
import {
  availableCountries,
  availableLeagues,
  availableClubs,
  filterPool,
  type PoolFilterConfig,
} from "@/lib/players";
import { DIFFICULTIES, type Difficulty } from "@/lib/game";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { Users, Globe2, Gauge, LayoutGrid } from "lucide-react";

type FilterKind = PoolFilterConfig["kind"];

const TEAM_SIZES: TeamSize[] = [5, 6, 11];

const FILTERS: { kind: FilterKind; label: string; desc: string }[] = [
  { kind: "all", label: "All Players", desc: "Everyone in the pool" },
  { kind: "current", label: "FC26 Squad Pool", desc: "1000 real current players" },
  { kind: "legends", label: "Elite Only", desc: "88 OVR and above" },
  { kind: "retired", label: "Retired Icons", desc: "Legends of the past" },
  { kind: "women", label: "Women's Stars", desc: "Icons of the women's game" },
  { kind: "league", label: "One League", desc: "Pick a single competition" },
  { kind: "club", label: "One Club", desc: "Draft from a single club" },
  { kind: "country", label: "One Nation", desc: "Pick a single country" },
];

export interface SetupResult {
  teamSize: TeamSize;
  filter: PoolFilterConfig;
  startingBudget: number;
  numOpponents: number;
  difficulty: Difficulty;
  formationId: string;
}

export function SetupScreen({
  onStart,
  showOpponents = true,
  ctaLabel = "Start Draft",
}: {
  onStart: (result: SetupResult) => void;
  showOpponents?: boolean;
  ctaLabel?: string;
}) {
  const [teamSize, setTeamSize] = useState<TeamSize>(5);
  const [filterKind, setFilterKind] = useState<FilterKind>("all");
  const [country, setCountry] = useState<string>("");
  const [league, setLeague] = useState<string>("");
  const [club, setClub] = useState<string>("");
  const [numOpponents, setNumOpponents] = useState(3);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [formationId, setFormationId] = useState<string>(defaultFormationId(5));

  const countries = useMemo(() => availableCountries(), []);
  const leagues = useMemo(() => availableLeagues(), []);
  const clubs = useMemo(() => availableClubs(), []);
  const filter: PoolFilterConfig = {
    kind: filterKind,
    country: country || countries[0] || "",
    league: league || leagues[0] || "",
    club: club || clubs[0] || "",
  };
  const poolSize = filterPool(filter).length;
  const needed = teamSize * 2;
  const enough = poolSize >= needed;

  const pickTeamSize = (size: TeamSize) => {
    setTeamSize(size);
    setFormationId((prev) => (size === 11 ? prev : defaultFormationId(size)));
  };

  const start = () => {
    sfx.click();
    onStart({
      teamSize,
      filter,
      startingBudget: 100,
      numOpponents: showOpponents ? numOpponents : 0,
      difficulty,
      formationId,
    });
  };

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle icon={<Users className="h-4 w-4" />} title="Team Size" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TEAM_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => pickTeamSize(size)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                teamSize === size
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40",
              )}
              aria-pressed={teamSize === size}
            >
              <div className="font-display text-2xl font-bold">{size}</div>
              <div className="text-xs text-muted-foreground">
                {formationsForSize(size).length > 1
                  ? "Pick your formation"
                  : formationsForSize(size)[0]!.label}
              </div>
            </button>
          ))}
        </div>
      </section>

      {teamSize === 11 && (
        <section>
          <SectionTitle icon={<LayoutGrid className="h-4 w-4" />} title="Formation" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {formationsForSize(11).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormationId(f.id)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  formationId === f.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40",
                )}
                aria-pressed={formationId === f.id}
              >
                <div className="font-display text-lg font-bold">{f.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  {f.slots.filter((s) => s.position === "DEF").length} DEF ·{" "}
                  {f.slots.filter((s) => s.position === "MID").length} MID ·{" "}
                  {f.slots.filter((s) => s.position === "FWD").length} FWD
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle icon={<Globe2 className="h-4 w-4" />} title="Player Pool" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {FILTERS.map((f) => (
            <button
              key={f.kind}
              type="button"
              onClick={() => setFilterKind(f.kind)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                filterKind === f.kind
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40",
              )}
              aria-pressed={filterKind === f.kind}
            >
              <div className="text-sm font-semibold">{f.label}</div>
              <div className="text-[11px] text-muted-foreground">{f.desc}</div>
            </button>
          ))}
        </div>

        {filterKind === "country" && (
          <div className="mt-3">
            <label
              htmlFor="country"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Choose nation
            </label>
            <select
              id="country"
              value={country || countries[0]}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        {filterKind === "league" && (
          <div className="mt-3">
            <label htmlFor="league" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Choose league
            </label>
            <select
              id="league"
              value={league || leagues[0]}
              onChange={(e) => setLeague(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {leagues.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}

        {filterKind === "club" && (
          <div className="mt-3">
            <label htmlFor="club" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Choose club
            </label>
            <select
              id="club"
              value={club || clubs[0]}
              onChange={(e) => setClub(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {clubs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      <section>
        <SectionTitle icon={<Gauge className="h-4 w-4" />} title="Difficulty" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDifficulty(d.id)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                difficulty === d.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40",
              )}
              aria-pressed={difficulty === d.id}
            >
              <div className="text-sm font-semibold">{d.label}</div>
              <div className="text-[11px] text-muted-foreground">{d.desc}</div>
            </button>
          ))}
        </div>
      </section>

      {showOpponents && (
        <section>
          <SectionTitle icon={<Users className="h-4 w-4" />} title="AI Opponents" />
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNumOpponents(n)}
                className={cn(
                  "h-11 w-11 rounded-lg border font-display text-lg font-bold transition-colors",
                  numOpponents === n
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:border-primary/40",
                )}
                aria-pressed={numOpponents === n}
              >
                {n}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="rounded-xl border border-border bg-card/50 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Starting budget</span>
          <span className="font-mono font-semibold text-money">$100M</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Players available</span>
          <span
            className={cn(
              "font-mono font-semibold",
              enough ? "text-foreground" : "text-destructive",
            )}
          >
            {poolSize} / {needed} needed
          </span>
        </div>
      </div>

      <Button
        className="h-12 w-full text-base"
        disabled={!enough}
        onClick={start}
      >
        {enough ? ctaLabel : "Not enough players in this pool"}
      </Button>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {icon}
      {title}
    </h2>
  );
}
