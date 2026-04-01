"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface RequestRow {
  id: string;
  creditsRequested: number;
  amountPaid: string;
  referenceNumber: string;
  status: string;
  createdAt: string;
}

export default function IssuerCreditsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState<number | null>(null);
  const [upiQrBase64, setUpiQrBase64] = useState<string | null>(null);
  const [credits, setCredits] = useState("");
  const [coupon, setCoupon] = useState("");
  const [calcDiscount, setCalcDiscount] = useState<number>(0);
  const [calcTotal, setCalcTotal] = useState<number>(0);
  const [proofUrl, setProofUrl] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);

  const qty = useMemo(() => Number(credits || 0), [credits]);
  const refreshCalledRef = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // API: GET /api/issuer/credit-price
      const p = await fetch("/api/issuer/credit-price")
        .then((r) => r.json())
        .catch(() => ({ value: null }));
      setPrice(p.value != null ? Number(p.value) : null);
      setUpiQrBase64(p.upiQrBase64 ?? null);
      // API: GET /api/issuer/credit-requests
      const reqRes = await fetch("/api/issuer/credit-requests");
      if (reqRes.ok) {
        const data = await reqRes.json();
        setRequests(data.requests ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (refreshCalledRef.current) return;
    refreshCalledRef.current = true;
    refresh();
  }, [refresh]);

  const handleApplyCoupon = async () => {
    try {
      // API: POST /api/issuer/coupons/validate { code, credits, amount }
      const res = await fetch("/api/issuer/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: coupon,
          credits: qty,
          amount: (price ?? 0) * qty,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCalcDiscount(Number(data.discountAmount || 0));
        setCalcTotal(Number(data.finalAmount));
        toast({ title: "Coupon applied" });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Invalid coupon",
          description: data.message ?? "",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({ title: "Network error", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (price != null) {
      const amount = price * qty;
      setCalcTotal(Math.max(0, amount - calcDiscount));
    }
  }, [price, qty]);

  const raiseRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!price)
      return toast({ title: "Price not available", variant: "destructive" });
    if (!qty || qty <= 0)
      return toast({ title: "Enter credits", variant: "destructive" });
    if (!reference)
      return toast({ title: "Reference required", variant: "destructive" });
    if (!proofUrl)
      return toast({ title: "Payment proof required", variant: "destructive" });
    setSubmitting(true);
    try {
      // API: POST /api/issuer/credit-requests
      // Body: { creditsRequested, amountPaid, paymentProofBase64, referenceNumber, couponCode? }
      const res = await fetch("/api/issuer/credit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditsRequested: qty,
          amountPaid: calcTotal || price * qty,
          paymentProofBase64: proofUrl,
          referenceNumber: reference,
          couponCode: coupon || null,
        }),
      });
      if (res.ok) {
        toast({ title: "Request submitted" });
        setCredits("");
        setCoupon("");
        setCalcDiscount(0);
        setCalcTotal(0);
        setProofUrl("");
        setReference("");
        refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Submit failed",
          description: data.message ?? "",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Purchase Credits</h1>
      <Card>
        <CardHeader>
          <CardTitle>New Request</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={raiseRequest}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="space-y-2">
              <Label htmlFor="credits">Credits</Label>
              <Input
                id="credits"
                type="number"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Price per Credit</Label>
              <div className="h-10 px-3 py-2 border rounded flex items-center bg-gray-50">
                {price ?? "-"}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon">Coupon (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="coupon"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="e.g. SAVE10"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleApplyCoupon}
                >
                  Apply
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Discount</Label>
              <div className="h-10 px-3 py-2 border rounded flex items-center bg-gray-50">
                {calcDiscount}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Total Amount</Label>
              <div className="h-10 px-3 py-2 border rounded flex items-center bg-gray-50">
                {calcTotal || (price ?? 0) * qty}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Payment Reference</Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="proof">Payment Proof URL</Label>
              <Input
                id="proof"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const result = reader.result as string;
                    const base64 = result.split(",")[1] || result;
                    setProofUrl(base64);
                  };
                  reader.readAsDataURL(file);
                }}
                required
              />
            </div>
            {upiQrBase64 && (
              <div className="space-y-2 md:col-span-2">
                <Label>Pay via UPI QR</Label>
                <img
                  src={`data:image/png;base64,${upiQrBase64}`}
                  alt="UPI QR"
                  className="max-h-48 border rounded"
                />
                <div className="text-sm text-gray-600">
                  Note: Pay to this QR with the exact amount shown above and
                  attach payment proof.
                </div>
              </div>
            )}
            <div className="md:col-span-2">
              <Button
                type="submit"
                style={{ backgroundColor: "#9681FA" }}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Credits</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-gray-500"
                    >
                      No requests yet
                    </TableCell>
                  </TableRow>
                )}
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.creditsRequested}</TableCell>
                    <TableCell>{r.amountPaid}</TableCell>
                    <TableCell>{r.referenceNumber}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
