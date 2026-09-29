"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Coins,
  Copy,
  ExternalLink,
  RefreshCw,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface UsdcStatus {
  address: string;
  assetId: string;
  network: string;
  optedIn: boolean;
  balance: string;
  balanceAtomic: string;
  algoBalance: number;
  algoSpendable: number;
  explorerUrl: string;
  label: string;
  managed: boolean;
}

/**
 * USDC panel for a ProofMint-custodied wallet: balance on the x402 settlement
 * network, a one-click ASA opt-in when the account cannot yet hold USDC, and a
 * withdrawal once it has a balance.
 */
export default function UsdcWalletCard({
  endpoint,
  title,
  description,
}: {
  /** Base path, e.g. "/api/issuer/x402/usdc". opt-in/withdraw hang off it. */
  endpoint: string;
  title: string;
  description: string;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<UsdcStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOptingIn, setIsOptingIn] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawTo, setWithdrawTo] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      if (!res.ok) {
        setStatus(null);
        setLoadError(data.error || "Could not load USDC balance");
        return;
      }
      setStatus(data);
      setLoadError(null);
    } catch {
      setStatus(null);
      setLoadError("Network error while loading USDC balance");
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  const optIn = async () => {
    setIsOptingIn(true);
    try {
      const res = await fetch(`${endpoint}/opt-in`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Opt-in failed");
      toast({ title: data.message || "Opted into USDC" });
      await load();
    } catch (e) {
      toast({
        title: "USDC opt-in failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsOptingIn(false);
    }
  };

  const withdraw = async () => {
    setIsWithdrawing(true);
    try {
      const res = await fetch(`${endpoint}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: withdrawTo.trim(), amount: Number(withdrawAmount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Withdrawal failed");
      toast({ title: data.message || "Withdrawal sent", description: data.txId });
      setWithdrawOpen(false);
      setWithdrawTo("");
      setWithdrawAmount("");
      await load();
    } catch (e) {
      toast({
        title: "Withdrawal failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied to clipboard` });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const balance = Number(status?.balance ?? 0);
  const amountValue = Number(withdrawAmount);
  const canWithdraw =
    !isWithdrawing &&
    withdrawTo.trim().length === 58 &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    amountValue <= balance;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="h-4 w-4" />
              {title}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            disabled={isLoading}
            aria-label="Refresh USDC balance"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && !status && (
          <p className="text-sm text-muted-foreground">Loading USDC balance...</p>
        )}

        {loadError && !status && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {status && (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-2xl font-bold">
                  {status.optedIn ? `${status.balance} USDC` : "--"}
                </div>
                <p className="text-xs text-muted-foreground">
                  ASA {status.assetId} on Algorand {status.network}
                </p>
              </div>
              {status.optedIn ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Opted in
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Not opted in
                </Badge>
              )}
            </div>

            <Separator />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => copy(status.address, "Address")}
              >
                <Copy className="mr-1 h-3 w-3" />
                <span className="text-xs">
                  {status.address.slice(0, 8)}...{status.address.slice(-6)}
                </span>
              </Button>
              <a
                href={status.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Explorer
              </a>
              <span className="ml-auto text-xs text-muted-foreground">
                {status.algoSpendable.toFixed(4)} ALGO spendable
              </span>
            </div>

            {!status.managed && (
              <div className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  This address is not held by ProofMint, so opt-in and withdrawal
                  have to be done from the wallet that controls it.
                </span>
              </div>
            )}

            {status.managed && !status.optedIn && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  This wallet cannot hold USDC yet. Opting in is a one-time
                  Algorand transaction that reserves 0.1 ALGO of minimum balance.
                </p>
                <Button onClick={optIn} disabled={isOptingIn} className="w-full">
                  {isOptingIn ? "Opting in..." : "Opt in to USDC"}
                </Button>
              </div>
            )}

            {status.managed && status.optedIn && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setWithdrawOpen(true)}
                disabled={balance <= 0}
              >
                <ArrowUpRight className="mr-1 h-4 w-4" />
                {balance > 0 ? "Withdraw USDC" : "No USDC to withdraw"}
              </Button>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw USDC</DialogTitle>
            <DialogDescription>
              Sends USDC on Algorand {status?.network}. The destination must
              already be opted into ASA {status?.assetId}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="withdraw-to">Destination address</Label>
              <Input
                id="withdraw-to"
                placeholder="58-character Algorand address"
                value={withdrawTo}
                onChange={(e) => setWithdrawTo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="withdraw-amount">Amount (USDC)</Label>
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => setWithdrawAmount(status?.balance ?? "")}
                >
                  Max {status?.balance}
                </button>
              </div>
              <Input
                id="withdraw-amount"
                type="number"
                step="0.000001"
                min="0"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              {withdrawAmount && amountValue > balance && (
                <p className="text-xs text-red-500">
                  Amount exceeds the available balance.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWithdrawOpen(false)}
              disabled={isWithdrawing}
            >
              Cancel
            </Button>
            <Button onClick={withdraw} disabled={!canWithdraw}>
              {isWithdrawing ? "Sending..." : "Send USDC"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
