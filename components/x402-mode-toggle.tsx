"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Zap, AlertCircle } from "lucide-react";

interface X402Status {
  optedIn: boolean;
  balance: string;
  network: string;
  managed: boolean;
  prices: { badge: string; certificate: string };
}

export interface X402ModeState {
  enabled: boolean;
  /** True when the wallet can actually pay: opted in and funded. */
  ready: boolean;
  totalUsd: number;
}

/**
 * Toggles paid minting through the x402 endpoints.
 *
 * In x402 mode a mint costs USDC on top of the usual credit, paid from the
 * issuer's custodial wallet over the HTTP 402 flow.
 */
export default function X402ModeToggle({
  kind,
  quantity,
  enabled,
  onChange,
  onReadyChange,
}: {
  kind: "badge" | "certificate";
  quantity: number;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  onReadyChange?: (state: X402ModeState) => void;
}) {
  const [status, setStatus] = useState<X402Status | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/issuer/x402/usdc");
        const data = await res.json();
        if (!cancelled && res.ok) setStatus(data);
      } catch {
        // Leaving status null just disables the toggle; nothing to recover.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const unitPrice = status
    ? Number(
        (kind === "badge" ? status.prices.badge : status.prices.certificate).replace(
          /[^0-9.]/g,
          ""
        )
      )
    : 2;
  const totalUsd = unitPrice * Math.max(quantity, 0);
  const balance = Number(status?.balance ?? 0);
  const funded = Boolean(status?.optedIn) && balance >= totalUsd;
  const ready = Boolean(status?.optedIn) && funded;

  useEffect(() => {
    onReadyChange?.({ enabled, ready, totalUsd });
    // onReadyChange is expected to be stable enough for this dependency set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ready, totalUsd]);

  const canEnable = Boolean(status?.optedIn);

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor="x402-mode" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Pay with USDC (x402)
            <Badge variant="outline" className="text-[10px] uppercase">
              {status?.network ?? "algorand"}
            </Badge>
          </Label>
          <p className="text-xs text-muted-foreground">
            Mints through the paid x402 endpoint at ${unitPrice.toFixed(2)} per{" "}
            {kind}, settled in USDC from your wallet. Credits are still used.
          </p>
        </div>
        <Switch
          id="x402-mode"
          checked={enabled}
          onCheckedChange={onChange}
          disabled={isLoading || !canEnable}
        />
      </div>

      {!isLoading && status && !status.optedIn && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Your wallet is not opted into USDC yet.{" "}
            <Link href="/issuer/profile" className="underline">
              Opt in from your profile
            </Link>{" "}
            to enable x402 minting.
          </span>
        </div>
      )}

      {enabled && status?.optedIn && (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">USDC cost</span>
            <span className="font-medium">${totalUsd.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Wallet balance</span>
            <span className={funded ? "font-medium" : "font-medium text-red-500"}>
              {status.balance} USDC
            </span>
          </div>
          {!funded && (
            <p className="text-red-500">
              Not enough USDC. Send USDC to your wallet address from your profile
              page.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
