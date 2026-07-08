import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import {
  winningOutcome,
  faucet,
  bet,
  confidentialCommit,
  musdcBalance,
  OUTCOME_YES,
} from "@/services/molfi-chain";
import {
  CONTRACTS,
  DEMO_MARKET_ID,
  USDC_DECIMALS,
  addressUrl,
  txUrl,
} from "@/config/molfi";
import { formatUnits, parseUnits } from "ethers";
import { ExternalLink, Loader2, CheckCircle2 } from "lucide-react";

const OUTCOME = ["YES", "NO", "INVALID"];

/**
 * Live on-chain demo: connect MetaMask on HashKey Chain, mint test mUSDC,
 * read a resolved market outcome, place a real bet, and make a confidential
 * commit — all against Molfi's HashKey testnet deployment.
 */
export default function MolfiDemo() {
  const { address, isConnected, connect, disconnect, getSigner } = useWallet();
  const [outcome, setOutcome] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setError(null);
    setBusy(key);
    try {
      await fn();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `${key} failed`);
    } finally {
      setBusy(null);
    }
  };

  const readOutcome = () =>
    run("read", async () => {
      const res = await winningOutcome(DEMO_MARKET_ID);
      setOutcome(OUTCOME[res] ?? String(res));
    });

  const getFaucet = () =>
    run("faucet", async () => {
      const signer = await getSigner();
      if (!signer || !address) return;
      const hash = await faucet(signer, address);
      setLastTx(hash);
      setBalance(formatUnits(await musdcBalance(address), USDC_DECIMALS));
    });

  const placeBet = () =>
    run("bet", async () => {
      const signer = await getSigner();
      if (!signer) return;
      const hash = await bet(
        signer,
        DEMO_MARKET_ID,
        OUTCOME_YES,
        parseUnits("10", USDC_DECIMALS),
      );
      setLastTx(hash);
    });

  const commit = () =>
    run("commit", async () => {
      const signer = await getSigner();
      if (!signer) return;
      const { hash } = await confidentialCommit(signer, "yes");
      setLastTx(hash);
    });

  const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-6)}`;

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Molfi — Live on HashKey Chain Testnet</h1>
          <p className="text-muted-foreground">
            Private prediction markets. Connect MetaMask and interact with the
            deployed contracts directly.
          </p>
        </header>

        {/* Wallet */}
        <section className="rounded-xl border border-border p-5">
          {isConnected && address ? (
            <div className="flex items-center justify-between">
              <span className="text-sm">
                Connected: <span className="font-mono">{short(address)}</span>
                {balance != null && (
                  <span className="ml-3 text-muted-foreground">{balance} mUSDC</span>
                )}
              </span>
              <Button variant="outline" size="sm" onClick={() => disconnect()}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button onClick={() => connect()}>Connect MetaMask</Button>
          )}
        </section>

        {/* Faucet */}
        <section className="rounded-xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">1. Get test mUSDC</h2>
          <Button onClick={getFaucet} disabled={!isConnected || busy === "faucet"} size="sm">
            {busy === "faucet" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mint mUSDC from faucet
          </Button>
        </section>

        {/* Read market */}
        <section className="rounded-xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">2. Read a resolved market's outcome (on-chain)</h2>
          <Button onClick={readOutcome} disabled={busy === "read"} size="sm">
            {busy === "read" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Read on-chain outcome
          </Button>
          {outcome && (
            <p className="text-sm">
              Resolved outcome:{" "}
              <span className={outcome === "YES" ? "text-green-500 font-bold" : "font-bold"}>
                {outcome}
              </span>
            </p>
          )}
        </section>

        {/* Bet */}
        <section className="rounded-xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">3. Place a bet (10 mUSDC on YES)</h2>
          <p className="text-sm text-muted-foreground">
            Approves the escrow and places a real on-chain bet, signed by your wallet.
          </p>
          <Button onClick={placeBet} disabled={!isConnected || busy === "bet"} size="sm">
            {busy === "bet" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Bet 10 mUSDC on YES
          </Button>
        </section>

        {/* Confidential commit */}
        <section className="rounded-xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">4. Confidential position</h2>
          <p className="text-sm text-muted-foreground">
            Deposit a fixed denomination into the confidential bet pool — the note is
            saved locally for later claiming.
          </p>
          <Button onClick={commit} disabled={!isConnected || busy === "commit"} size="sm">
            {busy === "commit" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Commit confidentially
          </Button>
        </section>

        {lastTx && (
          <p className="text-sm flex items-center gap-2 text-green-500">
            <CheckCircle2 className="h-4 w-4" /> Confirmed —{" "}
            <a className="underline inline-flex items-center gap-1" href={txUrl(lastTx)} target="_blank" rel="noreferrer">
              {short(lastTx)} <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        )}
        {error && <p className="text-sm text-red-500 break-all">⚠️ {error}</p>}

        {/* Deployed contracts */}
        <section className="rounded-xl border border-border p-5">
          <h2 className="font-semibold mb-3">Deployed contracts (testnet)</h2>
          <ul className="space-y-1 text-sm">
            {Object.entries(CONTRACTS).map(([name, addr]) => (
              <li key={name} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{name}</span>
                <a className="font-mono underline inline-flex items-center gap-1" href={addressUrl(addr)} target="_blank" rel="noreferrer">
                  {short(addr)} <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
