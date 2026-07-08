import { useState } from "react";
import { ChevronDown, Copy, Loader2, LogOut, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useWallet } from "@/context/WalletContext";
import { showError, showTxSuccess } from "@/lib/toast";

interface Props {
  className?: string;
  fullWidth?: boolean;
  large?: boolean;
  /** Shorter label and tighter padding for the site header on small screens */
  compact?: boolean;
  onMenuClose?: () => void;
}

/** Truncate a 0x EVM address for display (0x1234…abcd). */
function formatAddress(address: string): string {
  if (!address.startsWith("0x") || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletConnectButton({
  className,
  fullWidth,
  large,
  compact,
  onMenuClose,
}: Props) {
  const { address, connecting, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);

  if (address) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "btn-connect gap-2 text-sm",
              compact && "btn-connect--compact",
              fullWidth && "w-full justify-between",
              large && "btn-connect-lg",
              className,
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <WalletIcon className="h-4 w-4 shrink-0 opacity-80" />
              <span className={cn("truncate", compact && "max-w-[5.5rem] sm:max-w-none")}>
                {formatAddress(address)}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 opacity-60 transition-transform",
                compact && "hidden sm:block",
                open && "rotate-180",
              )}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className={cn(
            "min-w-[12rem]",
            fullWidth && "w-[var(--radix-dropdown-menu-trigger-width)]",
          )}
        >
          <DropdownMenuLabel className="text-sm font-normal text-muted-foreground">
            Connected · HashKey Chain
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(address);
                showTxSuccess("Wallet address copied");
              } catch {
                showError("Could not copy address");
              }
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy wallet address
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              onMenuClose?.();
              void disconnect();
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const buttonClasses = cn(
    "btn-connect gap-2",
    compact && "btn-connect--compact",
    fullWidth && "w-full",
    large && "btn-connect-lg",
    className,
  );

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={connecting}
      onClick={() => {
        onMenuClose?.();
        void connect();
      }}
      className={buttonClasses}
      title="Connect MetaMask on HashKey Chain"
    >
      {connecting ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className={cn(compact && "hidden sm:inline")}>Connecting…</span>
        </>
      ) : (
        <>
          <WalletIcon className="h-4 w-4 shrink-0 opacity-90" />
          Connect Wallet
        </>
      )}
    </Button>
  );
}
