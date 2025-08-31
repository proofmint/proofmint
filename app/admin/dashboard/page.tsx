"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Pending Issuers</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            {/* API: GET /api/admin/issuers?status=pending */}
            <div className="text-3xl font-bold">--</div>
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
            {/* API: GET /api/admin/credit-requests?status=pending */}
            <div className="text-3xl font-bold">--</div>
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
            {/* API: GET /api/admin/coupons?isActive=true */}
            <div className="text-3xl font-bold">--</div>
            <Link href="/admin/coupons">
              <Button variant="outline">View</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


