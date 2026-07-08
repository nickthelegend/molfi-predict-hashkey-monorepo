import { ConnectButton } from "@rainbow-me/rainbowkit";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  fullWidth?: boolean;
  large?: boolean;
  /** Shorter label and tighter display for the site header on small screens */
  compact?: boolean;
  onMenuClose?: () => void;
}

/**
 * Connect Wallet — powered by RainbowKit. Renders the wallet-select modal
 * (MetaMask / WalletConnect / Coinbase / injected), the connected account chip
 * with copy + disconnect, and the HashKey Chain network selector.
 */
export function WalletConnectButton({ className, fullWidth, compact }: Props) {
  return (
    <div className={cn("rk-connect inline-flex", fullWidth && "w-full [&>*]:w-full", className)}>
      <ConnectButton
        label="Connect Wallet"
        showBalance={compact ? false : { smallScreen: false, largeScreen: true }}
        accountStatus={compact ? "address" : { smallScreen: "avatar", largeScreen: "full" }}
        chainStatus={compact ? "icon" : { smallScreen: "icon", largeScreen: "full" }}
      />
    </div>
  );
}
