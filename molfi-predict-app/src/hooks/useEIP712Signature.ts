import { useState } from "react";
import { useWallet } from "./useWallet";
import { Order, SignedOrder } from "@/types/eip712";
import { toast } from "sonner";

/**
 * Order-signing hook.
 *
 * Signs the order's canonical serialization with the connected HashKey Chain
 * wallet (MetaMask / injected) via an ethers `personal_sign`. The legacy
 * name/types are kept so existing call sites (e.g. CLOBDemo) and the matching
 * backend stay compatible.
 */
export function useEIP712Signature() {
  const { address, isConnected, signMessage } = useWallet();
  const [isSigningOrder, setIsSigningOrder] = useState(false);

  /** Canonical string the wallet signs. Field order is fixed and stable. */
  const canonical = (order: Order): string =>
    [
      "molfi:order:v1",
      order.maker,
      order.marketId,
      order.outcome,
      order.price,
      order.size,
      order.nonce,
      order.expiry,
    ].join("|");

  const signOrder = async (order: Order): Promise<SignedOrder | null> => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return null;
    }

    setIsSigningOrder(true);
    try {
      const signature = await signMessage(canonical(order));

      toast.success("Order signed successfully!");
      return {
        ...order,
        signature,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error("Error signing order:", error);
      toast.error("Failed to sign order");
      return null;
    } finally {
      setIsSigningOrder(false);
    }
  };

  /** Create an order object from form inputs. */
  const createOrder = (params: {
    marketId: string;
    outcome: "YES" | "NO";
    price: number; // probability, e.g. 0.65
    size: number; // shares
    nonce: number;
    expiryMinutes?: number;
  }): Order => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    const expiryTimestamp =
      Math.floor(Date.now() / 1000) + (params.expiryMinutes || 60) * 60;

    return {
      maker: address,
      marketId: params.marketId,
      outcome: params.outcome,
      price: params.price.toString(),
      size: params.size.toString(),
      nonce: params.nonce.toString(),
      expiry: expiryTimestamp.toString(),
    };
  };

  return {
    signOrder,
    createOrder,
    isSigningOrder,
    isConnected,
    address,
  };
}
