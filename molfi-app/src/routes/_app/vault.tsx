import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownLeft, Coins, Loader2, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/context/WalletContext";
import {
  vaultDepositOnChain,
  vaultWithdrawAll,
  vaultStats,
  vaultPositionOf,
  musdcBalance,
} from "@/lib/hsk/evm";
import { showError, showTxSuccess } from "@/lib/toast";
import { pageTitle } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/vault")({
  head: () => ({
    meta: [
      { title: pageTitle("Vault") },
      { name: "description", content: "Deposit mUSDC to the Molfi LP vault and earn real yield from the 2% trading fee." },
    ],
  }),
  component: VaultPage,
});

const usd = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: n >= 1000 ? 0 : 2 });

interface Stats {
  tvl: number;
  sharePrice: number;
  totalShares: number;
}
interface Pos {
  value: number;
  earned: number;
  principal: number;
  shares: bigint;
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-mono text-2xl font-semibold", accent ? "text-accent" : "text-foreground")}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function VaultPage() {
  const { address, connect } = useWallet();
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [wallet, setWallet] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStats(await vaultStats());
    } catch {
      /* ignore */
    }
    if (address) {
      try {
        setPos(await vaultPositionOf(address));
      } catch {
        /* ignore */
      }
      try {
        setWallet(Number((await musdcBalance(address)) as bigint) / 1e6);
      } catch {
        /* ignore */
      }
    } else {
      setPos(null);
      setWallet(null);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleDeposit = async () => {
    if (!address) return void connect();
    const amt = Number(amount);
    if (!(amt > 0)) return showError("Enter an amount");
    setBusy(true);
    try {
      const hash = await vaultDepositOnChain(address, amt);
      showTxSuccess(`Deposited ${amt} mUSDC to the vault`, hash);
      await refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Deposit failed");
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!address) return void connect();
    setBusy(true);
    try {
      const hash = await vaultWithdrawAll();
      showTxSuccess("Withdrew your vault position + yield", hash);
      await refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Withdraw failed");
    } finally {
      setBusy(false);
    }
  };

  const navGrowth = stats?.sharePrice ? (stats.sharePrice - 1) * 100 : 0;

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          <Coins className="mb-1 mr-2 inline h-6 w-6 text-accent" />
          LP Vault
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Deposit mUSDC to provide liquidity. The <strong className="text-foreground">2% trading fee</strong> charged on
          every bet accrues to the vault, lifting NAV per share — so you earn{" "}
          <strong className="text-foreground">real yield</strong> from trading volume across all markets. Withdraw
          anytime for your principal plus accrued fees.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total value locked" value={`${usd(stats?.tvl ?? 0)}`} sub="mUSDC" />
        <Stat
          label="NAV / share"
          value={(stats?.sharePrice ?? 1).toFixed(4)}
          sub={`${navGrowth >= 0 ? "+" : ""}${navGrowth.toFixed(2)}% since inception`}
          accent
        />
        <Stat label="Total shares" value={`${usd(stats?.totalShares ?? 0)}`} sub="on-chain LP shares" />
        <Stat
          label="Your position"
          value={`${usd(pos?.value ?? 0)}`}
          sub={pos && pos.earned > 0 ? `+${usd(pos.earned)} earned` : "mUSDC (connect + deposit)"}
          accent={!!pos && pos.earned > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold text-foreground">Provide liquidity</h2>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Amount (mUSDC)</label>
              {wallet != null ? (
                <button
                  type="button"
                  className="text-xs text-accent hover:underline"
                  onClick={() => setAmount(String(Math.floor(wallet)))}
                >
                  Balance: {usd(wallet)}
                </button>
              ) : null}
            </div>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border-border bg-background font-mono"
            />
          </div>
          <Button onClick={handleDeposit} disabled={busy} className="w-full gap-1.5" size="lg">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
            {address ? "Deposit to vault" : "Connect wallet"}
          </Button>
          {address && pos && pos.value > 0 ? (
            <Button onClick={handleWithdraw} disabled={busy} variant="outline" className="w-full gap-1.5" size="lg">
              <ArrowDownLeft className="h-4 w-4" />
              Withdraw all · {usd(pos.value)} mUSDC
            </Button>
          ) : null}
          {address && pos ? (
            <div className="space-y-1 rounded-lg border border-border bg-background p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deposited</span>
                <span className="font-mono">{usd(pos.principal)} mUSDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current value</span>
                <span className="font-mono">{usd(pos.value)} mUSDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Yield earned</span>
                <span className="font-mono text-[color:var(--long-text,#22c55e)]">+{usd(pos.earned)} mUSDC</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-accent" /> How the vault earns
          </h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">1. Deposit mUSDC</span> → you receive vault shares at the
              current NAV.
            </li>
            <li>
              <span className="font-semibold text-foreground">2. Traders bet</span> across all markets. A 2% protocol fee
              on every winning redeem is routed on-chain to this vault.
            </li>
            <li>
              <span className="font-semibold text-foreground">3. NAV rises</span> as fees accrue — your shares are worth
              more mUSDC without you doing anything.
            </li>
            <li>
              <span className="font-semibold text-foreground">4. Withdraw anytime</span> → burn shares for principal +
              accrued yield. All on-chain, settled in mUSDC.
            </li>
          </ol>
          <p className="mt-4 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
            The vault is an ERC-4626-style share vault on HashKey Chain. Yield is real protocol revenue — no emissions,
            no inflation. NAV / share only moves up as fees flow in.
          </p>
        </div>
      </div>
    </section>
  );
}
