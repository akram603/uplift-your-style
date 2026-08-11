import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Gamepad2, Wifi, Volume2, VolumeX, History, Users } from "lucide-react";
import { loadHistory, type RunRecord } from "@/lib/save";
import { sfx } from "@/lib/sfx";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Football Auction Draft — Bid, Bluff, Build Your XI" },
      {
        name: "description",
        content:
          "Auction football stars against AI or a friend online, gamble on hidden players, and build a squad within budget.",
      },
      { property: "og:title", content: "Football Auction Draft — Bid, Bluff, Build Your XI" },
      {
        property: "og:description",
        content:
          "Whoever loses the bidding war gets the hidden player. Build your XI and win the league.",
      },
    ],
  }),
  component: Menu,
});

function Menu() {
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    setMuted(sfx.isMuted());
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sfx.setMuted(next);
    if (!next) sfx.click();
  };

  const champions = history.filter((h) => h.champion).length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-20">
      <header className="mb-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
          <Trophy className="h-3.5 w-3.5" /> Bid Banter Buddy
        </span>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Football Auction Draft
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground text-pretty">
          Outbid your rivals for the revealed star — whoever drops out is compensated with the
          hidden mystery player. Build your XI, then fight for the title in a full league season.
        </p>
        <button
          onClick={toggleMute}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label={muted ? "Unmute sounds" : "Mute sounds"}
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          {muted ? "Sound off" : "Sound on"}
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/single-player"
          className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
        >
          <Gamepad2 className="h-7 w-7 text-primary" />
          <h2 className="mt-4 font-display text-xl font-semibold">Career</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Draft against AI managers, then play a full league season with transfers, loans and
            prize money. Fight for the trophy.
          </p>
        </Link>

        <Link
          to="/online-multiplayer"
          className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
        >
          <Wifi className="h-7 w-7 text-money" />
          <h2 className="mt-4 font-display text-xl font-semibold">Online Multiplayer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Draft head-to-head with a friend anywhere in the world. Host a room, share the invite
            link, bid in real time — no AI.
          </p>
        </Link>

        <Link
          to="/local-multiplayer"
          className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50 sm:col-span-2"
        >
          <Users className="h-7 w-7 text-primary" />
          <h2 className="mt-4 font-display text-xl font-semibold">Local Two-Player</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pass-and-play on one device. Take turns bidding head-to-head — no internet, no AI.
          </p>
        </Link>
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Trophy Room
        </h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No seasons finished yet. Complete a career run and it will show up here — champions
            get a trophy.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {history.length} season{history.length === 1 ? "" : "s"} played ·{" "}
              <span className="font-semibold text-money">{champions} title{champions === 1 ? "" : "s"}</span>
            </p>
            <ul className="mt-3 space-y-2">
              {history.slice(0, 4).map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/40 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    {h.champion ? (
                      <Trophy className="h-4 w-4 text-money" aria-label="Champion" />
                    ) : (
                      <span className="w-4" />
                    )}
                    <span className="font-medium">
                      #{h.rank} of {h.totalTeams}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      OVR {h.avgOvr} · {h.teamSize}-a-side · {h.difficulty}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {new Date(h.date).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
