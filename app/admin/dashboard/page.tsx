"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useEffect, useState } from "react"

export default function AdminDashboardPage() {
  const [counts, setCounts] = useState<{ pendingIssuers: number; pendingCreditRequests: number; activeCoupons: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/dashboard")
        if (!res.ok) throw new Error("Failed to load counts")
        const data = await res.json()
        setCounts(data)
      } catch (e) {
        setCounts({ pendingIssuers: 0, pendingCreditRequests: 0, activeCoupons: 0 })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Pending Issuers</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-bold">{loading ? "--" : counts?.pendingIssuers ?? 0}</div>
            <Link href="/admin/issuers">
              <Button variant="outline">Review</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Credit Requests</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-bold">{loading ? "--" : counts?.pendingCreditRequests ?? 0}</div>
            <Link href="/admin/credit-requests">
              <Button variant="outline">Manage</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Coupons Active</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-bold">{loading ? "--" : counts?.activeCoupons ?? 0}</div>
            <Link href="/admin/coupons">
              <Button variant="outline">View</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


