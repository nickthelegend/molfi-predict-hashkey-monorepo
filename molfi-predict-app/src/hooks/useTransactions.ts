import { useState } from "react";
import { toast } from "sonner";
import type { TransactionRequest } from "@/types/wallet";
import { useWallet } from "@/hooks/useWallet";

/**
 * Hook for handling generic transactions with user feedback.
 *
 * Sends a raw transaction through the connected wallet's ethers signer on
 * HashKey Chain. Contract-specific flows (bet / redeem / confidential) use the
 * dedicated helpers in `services/molfi-chain.ts`.
 */
export function useTransactions() {
  const [isPending, setIsPending] = useState(false);
  const { isConnected, getSigner } = useWallet();

  const sendTransaction = async (request: TransactionRequest) => {
    if (!isConnected) {
      toast.error("Wallet not connected");
      return null;
    }
    setIsPending(true);
    try {
      const signer = await getSigner();
      if (!signer) throw new Error("No signer available");
      const tx = await signer.sendTransaction({
        to: (request as { to?: string }).to,
        value: (request as { value?: bigint | string }).value,
        data: (request as { data?: string }).data,
      });
      await tx.wait();
      toast.success("Transaction confirmed");
      return tx.hash;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Transaction failed");
      return null;
    } finally {
      setIsPending(false);
    }
  };

  return {
    sendTransaction,
    isPending,
  };
}
