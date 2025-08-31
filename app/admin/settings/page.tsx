"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export default function AdminSettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creditPrice, setCreditPrice] = useState("")
  const [upiQrBase64, setUpiQrBase64] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/admin/credit-price")
        if (res.ok) {
          const data = await res.json()
          setCreditPrice(data.value != null ? String(data.value) : "")
          setUpiQrBase64(data.upiQrBase64 ?? null)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const valueNum = Number(creditPrice)
      const res = await fetch("/api/admin/credit-price", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: valueNum, upiQrBase64 }),
      })
      if (res.ok) {
        toast({ title: "Credit price saved" })
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Save failed", description: data.message ?? "", variant: "destructive" })
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
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Credit Price</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="creditPrice">Price per Credit</Label>
              <Input id="creditPrice" type="number" step="0.01" value={creditPrice} onChange={(e) => setCreditPrice(e.target.value)} required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>UPI QR (base64)</Label>
              {upiQrBase64 ? (
                <img src={`data:image/png;base64,${upiQrBase64}`} alt="UPI QR" className="max-h-48 border rounded" />
              ) : (
                <div className="text-sm text-gray-500">No QR uploaded</div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    const result = reader.result as string
                    const base64 = result.split(",")[1] || result
                    setUpiQrBase64(base64)
                  }
                  reader.readAsDataURL(file)
                }}
              />
              <Button type="button" variant="outline" onClick={() => setUpiQrBase64(null)}>Remove QR</Button>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" style={{ backgroundColor: "#9681FA" }} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}


