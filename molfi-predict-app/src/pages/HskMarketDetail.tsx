import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useWallet } from "@/hooks/useWallet";
import {
  getMarketInfo,
  bet,
  redeem,
  OUTCOME_YES,
  OUTCOME_NO,
  type OnChainMarket,
} from "@/services/molfi-chain";
import { CONTRACTS, USDC_DECIMALS, addressUrl, txUrl } from "@/config/molfi";
import { parseUnits } from "ethers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ExternalLink, CheckCircle2, ArrowLeft } from "lucide-react";

const STATUS = ["Trading", "Resolving", "Resolved"];
const OUTCOME = ["YES", "NO", "INVALID"];

/** Single market, read live from the `Market` contract, with a real on-chain bet / redeem. */
export default function HskMarketDetail() {
  const { id = "" } = useParams();
  const { isConnected, connect, getSigner } = useWallet();
  const [m, setM] = useState<OnChainMarket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<string | null>(null);
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("10");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        setM(await getMarketInfo(id));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "failed to read market");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const status = m ? m.status : 0;
  const outcome = m ? m.outcome : 2;

  const placeBet = async () => {
    const signer = await getSigner();
    if (!signer) return;
    setBusy(true);
    setError(null);
    setTx(null);
    try {
      const amt = parseUnits(amount || "0", USDC_DECIMALS);
      const hash = await bet(
        signer,
        id,
        side === "yes" ? OUTCOME_YES : OUTCOME_NO,
        amt,
      );
      setTx(hash);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "bet failed");
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    const signer = await getSigner();
    if (!signer) return;
    setBusy(true);
    setError(null);
    setTx(null);
    try {
      setTx(await redeem(signer, id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "redeem failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link to="/markets-live" className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> All markets
        </Link>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading market from chain…
          </div>
        )}
        {error && <p className="text-red-500 text-sm break-all">⚠️ {error}</p>}

        {m && (
          <>
            <header className="space-y-2">
              <h1 className="text-2xl font-bold">{m.question}</h1>
              <div className="flex items-center gap-3 text-sm">
                <span className={`px-2 py-1 rounded-full border ${status === 2 ? "border-green-600 text-green-500" : "border-border text-muted-foreground"}`}>
                  {STATUS[status]}
                </span>
                {status === 2 && (
                  <span className={`font-bold ${outcome === 0 ? "text-green-500" : "text-red-400"}`}>
                    Resolved {OUTCOME[outcome]}
                  </span>
                )}
                <a className="text-muted-foreground underline inline-flex items-center gap-1 ml-auto" href={addressUrl(CONTRACTS.market)} target="_blank" rel="noreferrer">
                  on-chain <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-xs font-mono text-muted-foreground break-all">{id}</p>
            </header>

            <section className="rounded-xl border border-border p-5 space-y-4">
              {status === 2 ? (
                <>
                  <h2 className="font-semibold">Redeem winnings</h2>
                  <p className="text-sm text-muted-foreground">
                    This market resolved {OUTCOME[outcome]}. If you hold a winning
                    position, redeem your payout on-chain.
                  </p>
                  {isConnected ? (
                    <Button size="sm" onClick={claim} disabled={busy}>
                      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Redeem
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => connect()}>Connect wallet</Button>
                  )}
                </>
              ) : (
                <>
                  <h2 className="font-semibold">Place a bet</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSide("yes")}
                      className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${side === "yes" ? "border-green-600 bg-green-600/10 text-green-500" : "border-border text-muted-foreground"}`}
                    >
                      YES
                    </button>
                    <button
                      onClick={() => setSide("no")}
                      className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${side === "no" ? "border-red-500 bg-red-500/10 text-red-400" : "border-border text-muted-foreground"}`}
                    >
                      NO
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Amount (mUSDC)</label>
                    <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
                  </div>
                  {isConnected ? (
                    <Button size="sm" onClick={placeBet} disabled={busy}>
                      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Bet {amount} mUSDC on {side.toUpperCase()}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => connect()}>Connect wallet</Button>
                  )}
                </>
              )}
              {tx && (
                <p className="text-sm text-green-500 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Confirmed —{" "}
                  <a className="underline inline-flex items-center gap-1" href={txUrl(tx)} target="_blank" rel="noreferrer">
                    {tx.slice(0, 10)}… <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
