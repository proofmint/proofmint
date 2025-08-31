"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

export default function EditCouponPage() {
  const params = useParams<{ couponId: string }>()
  const couponId = params?.couponId
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [code, setCode] = useState("")
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE")
  const [discountValue, setDiscountValue] = useState("")
  const [maxUses, setMaxUses] = useState<string>("")
  const [uses, setUses] = useState<number>(0)
  const [isActive, setIsActive] = useState(true)
  const [expiresAt, setExpiresAt] = useState<string>("")
  const [issuerEmail, setIssuerEmail] = useState<string>("")
  const [minPurchaseAmount, setMinPurchaseAmount] = useState<string>("")

  useEffect(() => {
    const load = async () => {
      if (!couponId) return
      setLoading(true)
      try {
        // API: GET /api/admin/coupons/{couponId}
        const res = await fetch(`/api/admin/coupons/${couponId}`)
        if (res.ok) {
          const data = await res.json()
          const c = data.coupon
          setCode(c.code)
          setDiscountType(c.discountType)
          setDiscountValue(String(c.discountValue))
          setMaxUses(c.maxUses ? String(c.maxUses) : "")
          setUses(c.uses ?? 0)
          setIsActive(Boolean(c.isActive))
          setExpiresAt(c.expiresAt ? String(c.expiresAt).substring(0,10) : "")
          // Optional: fetch issuer email if needed by a separate endpoint; keep empty for manual entry
          setIssuerEmail("")
          setMinPurchaseAmount(c.minPurchaseAmount ? String(c.minPurchaseAmount) : "")
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [couponId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!couponId) return
    setSaving(true)
    try {
      // API: PUT /api/admin/coupons/{couponId}
      // Body: { code, discountType, discountValue, maxUses?, expiresAt?, isActive, issuerEmail?, minPurchaseAmount? }
      const res = await fetch(`/api/admin/coupons/${couponId}`, {
        method: "PUT",
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
        toast({ title: "Saved" })
        router.push("/admin/coupons")
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Failed to save", description: data.message ?? "", variant: "destructive" })
      }
    } catch (e) {
      toast({ title: "Network error", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit Coupon</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coupon Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label htmlFor="isActive">Status</Label>
              <Select value={isActive ? "active" : "inactive"} onValueChange={(v: "active"|"inactive") => setIsActive(v === "active")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="minPurchaseAmount">Min Purchase Amount (optional)</Label>
              <Input id="minPurchaseAmount" value={minPurchaseAmount} onChange={(e) => setMinPurchaseAmount(e.target.value)} />
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <Button type="submit" style={{ backgroundColor: "#9681FA" }} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/admin/coupons")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}


