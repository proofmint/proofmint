"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export default function CreateCouponPage() {
  const [code, setCode] = useState("")
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE")
  const [discountValue, setDiscountValue] = useState("")
  const [maxUses, setMaxUses] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [issuerEmail, setIssuerEmail] = useState("")
  const [minPurchaseAmount, setMinPurchaseAmount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      // API: POST /api/admin/coupons
      // Expected body: { code, discountType, discountValue, maxUses?, expiresAt?, isActive, issuerEmail?, minPurchaseAmount? }
      // Response: 201 Created { id }
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          discountType,
          discountValue,
          maxUses: maxUses ? Number(maxUses) : null,
          expiresAt: expiresAt || null,
          isActive,
          issuerEmail: issuerEmail || null,
          minPurchaseAmount: minPurchaseAmount || null,
        }),
      })
      if (res.ok) {
        toast({ title: "Coupon created" })
        router.push("/admin/coupons")
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Failed to create", description: data.message ?? "", variant: "destructive" })
      }
    } catch (e) {
      toast({ title: "Network error", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Create Coupon</h1>
      <Card>
        <CardHeader>
          <CardTitle>New Coupon</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Discount Type</Label>
              <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                  <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">Discount Value</Label>
              <Input id="value" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxUses">Max Uses (optional)</Label>
              <Input id="maxUses" type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expires At (optional)</Label>
              <Input id="expiresAt" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issuerEmail">Issuer Email (optional)</Label>
              <Input id="issuerEmail" value={issuerEmail} onChange={(e) => setIssuerEmail(e.target.value)} placeholder="issuer@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minPurchaseAmount">Min Purchase Amount (optional)</Label>
              <Input id="minPurchaseAmount" value={minPurchaseAmount} onChange={(e) => setMinPurchaseAmount(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" style={{ backgroundColor: "#9681FA" }} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Coupon"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}


