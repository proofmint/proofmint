"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import UsdcWalletCard from "@/components/usdc-wallet-card";
import {
  Plus,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  CreditCard,
  Copy,
} from "lucide-react";

interface WalletBalance {
  address: string;
  balance: number;
  minBalance: number;
  spendableBalance: number;
}

interface WalletBalancesResponse {
  wallets: {
    admin: WalletBalance;
    operational: WalletBalance;
    onboarding: WalletBalance;
  };
  calculations: {
    creditsPerAlgo: number;
    usersPerAlgo: number;
    creditCost: number;
    onboardingCost: number;
  };
}

export default function AdminCreditManagementPage() {
  const [walletData, setWalletData] = useState<WalletBalancesResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [usersToOnboard, setUsersToOnboard] = useState<string>("");
  const [transferring, setTransferring] = useState(false);
  const { toast } = useToast();

  const fetchWalletData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/wallet-balances");
      if (res.ok) {
        const data = await res.json();
        setWalletData(data);
      } else {
        toast({ title: "Failed to load wallet data", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  const calculateMaxUsers = () => {
    if (!walletData) return 0;
    const { wallets, calculations } = walletData;
    const admin = wallets.admin;
    const maxAlgosForOnboarding = admin.spendableBalance;
    return Math.floor(maxAlgosForOnboarding * calculations.usersPerAlgo);
  };

  const handleTransfer = async () => {
    const users = parseInt(usersToOnboard);
    if (isNaN(users) || users <= 0) {
      toast({ title: "Please enter a valid number", variant: "destructive" });
      return;
    }

    const maxUsers = calculateMaxUsers();
    if (users > maxUsers) {
      toast({
        title: `Maximum ${maxUsers} users can be onboarded`,
        variant: "destructive",
      });
      return;
    }

    setTransferring(true);
    try {
      const algosNeeded = users * walletData!.calculations.onboardingCost;
      const res = await fetch("/api/admin/wallet-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: algosNeeded }),
      });

      if (res.ok) {
        toast({ title: "Transfer successful" });
        setTransferModalOpen(false);
        setUsersToOnboard("");
        fetchWalletData();
      } else {
        const data = await res.json();
        toast({
          title: "Transfer failed",
          description: data.message ?? "",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  };

  const formatBalance = (balance: number) => {
    return `${balance.toFixed(4)} ALGO`;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied to clipboard` });
    } catch (e) {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Credit Management</h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading wallet data...</div>
        </div>
      </div>
    );
  }

  if (!walletData) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Credit Management</h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">Failed to load wallet data</div>
        </div>
      </div>
    );
  }

  const { wallets, calculations } = walletData;
  const adminMaxUsers = calculateMaxUsers();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Credit Management</h1>

      {/* Wallet Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Admin Wallet */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Admin Wallet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {formatBalance(wallets.admin.spendableBalance)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => copyToClipboard(wallets.admin.address, "Admin wallet address")}
              >
                <Copy className="h-3 w-3 mr-1" />
                <span className="text-xs">{truncateAddress(wallets.admin.address)}</span>
              </Button>
            </div>
            <p className="text-xs text-gray-500">Spendable Balance</p>
            <Separator className="my-3" />
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  Transferable Credits
                </span>
                <span className="font-semibold flex items-center gap-1">
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                  {Math.floor(
                    wallets.admin.spendableBalance * calculations.creditsPerAlgo
                  ).toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-gray-400">
                Cost: {calculations.creditCost} ALGO per credit
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Onboarding Wallet */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Onboarding Wallet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {formatBalance(wallets.onboarding.spendableBalance)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => copyToClipboard(wallets.onboarding.address, "Onboarding wallet address")}
              >
                <Copy className="h-3 w-3 mr-1" />
                <span className="text-xs">{truncateAddress(wallets.onboarding.address)}</span>
              </Button>
            </div>
            <p className="text-xs text-gray-500">Spendable Balance</p>
            <Separator className="my-3" />
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Onboardable Users</span>
                <span className="font-semibold flex items-center gap-1">
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                  {Math.floor(
                    wallets.onboarding.spendableBalance *
                      calculations.usersPerAlgo
                  ).toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-gray-400">
                Cost: {calculations.onboardingCost} ALGO per user
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2"
                onClick={() => setTransferModalOpen(true)}
                disabled={adminMaxUsers <= 0}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Users
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Operational Wallet */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Operational Wallet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {formatBalance(wallets.operational.spendableBalance)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => copyToClipboard(wallets.operational.address, "Operational wallet address")}
              >
                <Copy className="h-3 w-3 mr-1" />
                <span className="text-xs">{truncateAddress(wallets.operational.address)}</span>
              </Button>
            </div>
            <p className="text-xs text-gray-500">Spendable Balance</p>
            <Separator className="my-3" />
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Usage</span>
                <span className="font-semibold text-gray-600">
                  Operational transfers
                </span>
              </div>
              <div className="text-xs text-gray-400">
                For certificate/badge operations
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* x402 USDC revenue */}
      <UsdcWalletCard
        endpoint="/api/admin/x402/usdc"
        title="x402 USDC revenue"
        description="USDC collected from paid minting endpoints, held at X402_PAY_TO."
      />

      {/* Additional Info */}
      <Card>
        <CardHeader>
          <CardTitle>Wallet Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Wallet</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Total Balance</TableHead>
                <TableHead>Min Balance</TableHead>
                <TableHead>Spendable</TableHead>
                <TableHead>Capacity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Admin</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => copyToClipboard(wallets.admin.address, "Admin wallet address")}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    <span className="text-xs">{truncateAddress(wallets.admin.address)}</span>
                  </Button>
                </TableCell>
                <TableCell>{formatBalance(wallets.admin.balance)}</TableCell>
                <TableCell>{formatBalance(wallets.admin.minBalance)}</TableCell>
                <TableCell>
                  {formatBalance(wallets.admin.spendableBalance)}
                </TableCell>
                <TableCell>
                  {Math.floor(
                    wallets.admin.spendableBalance * calculations.creditsPerAlgo
                  ).toLocaleString()}{" "}
                  credits
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Onboarding</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => copyToClipboard(wallets.onboarding.address, "Onboarding wallet address")}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    <span className="text-xs">{truncateAddress(wallets.onboarding.address)}</span>
                  </Button>
                </TableCell>
                <TableCell>
                  {formatBalance(wallets.onboarding.balance)}
                </TableCell>
                <TableCell>
                  {formatBalance(wallets.onboarding.minBalance)}
                </TableCell>
                <TableCell>
                  {formatBalance(wallets.onboarding.spendableBalance)}
                </TableCell>
                <TableCell>
                  {Math.floor(
                    wallets.onboarding.spendableBalance *
                      calculations.usersPerAlgo
                  ).toLocaleString()}{" "}
                  users
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Operational</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => copyToClipboard(wallets.operational.address, "Operational wallet address")}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    <span className="text-xs">{truncateAddress(wallets.operational.address)}</span>
                  </Button>
                </TableCell>
                <TableCell>
                  {formatBalance(wallets.operational.balance)}
                </TableCell>
                <TableCell>
                  {formatBalance(wallets.operational.minBalance)}
                </TableCell>
                <TableCell>
                  {formatBalance(wallets.operational.spendableBalance)}
                </TableCell>
                <TableCell>-</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transfer Modal */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer to Onboarding Wallet</DialogTitle>
            <DialogDescription>
              Calculate how many users can be onboarded and transfer funds.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Admin Wallet Spendable:
                </span>
                <span className="font-medium">
                  {formatBalance(wallets.admin.spendableBalance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Onboarding Wallet Balance:
                </span>
                <span className="font-medium">
                  {formatBalance(wallets.onboarding.spendableBalance)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-green-600">
                <span className="text-sm font-medium">
                  Max Users Onboardable:
                </span>
                <span className="font-bold">
                  {adminMaxUsers.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="users">Number of Users to Onboard</Label>
              <Input
                id="users"
                type="number"
                placeholder={`Max: ${adminMaxUsers.toLocaleString()}`}
                value={usersToOnboard}
                onChange={(e) => setUsersToOnboard(e.target.value)}
                max={adminMaxUsers}
              />
              <p className="text-xs text-gray-500">
                Cost: {calculations.onboardingCost} ALGO per user ={" "}
                {usersToOnboard
                  ? (
                      parseInt(usersToOnboard) * calculations.onboardingCost
                    ).toFixed(4)
                  : "0"}{" "}
                ALGO total
              </p>
            </div>

            {usersToOnboard && parseInt(usersToOnboard) > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                <div className="text-sm font-medium text-blue-800">
                  Transfer Summary
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-600">Before (Admin):</span>
                  <span>{formatBalance(wallets.admin.spendableBalance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-600">Transfer Amount:</span>
                  <span className="font-medium text-red-600">
                    -
                    {formatBalance(
                      parseInt(usersToOnboard) * calculations.onboardingCost
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-600">After (Admin):</span>
                  <span className="font-bold">
                    {formatBalance(
                      wallets.admin.spendableBalance -
                        parseInt(usersToOnboard) * calculations.onboardingCost
                    )}
                  </span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Before (Onboarding):</span>
                  <span>
                    {formatBalance(wallets.onboarding.spendableBalance)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Add Amount:</span>
                  <span className="font-medium text-green-600">
                    +
                    {formatBalance(
                      parseInt(usersToOnboard) * calculations.onboardingCost
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-green-700">After (Onboarding):</span>
                  <span className="text-green-700">
                    {formatBalance(
                      wallets.onboarding.spendableBalance +
                        parseInt(usersToOnboard) * calculations.onboardingCost
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferModalOpen(false)}
              disabled={transferring}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={
                transferring || !usersToOnboard || parseInt(usersToOnboard) <= 0
              }
            >
              {transferring ? "Processing..." : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
