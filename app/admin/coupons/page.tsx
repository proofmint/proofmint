"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"

interface CouponRow {
  id: string
  code: string
  discountType: "PERCENTAGE" | "FIXED_AMOUNT"
  discountValue: string
  maxUses?: number | null
  uses: number
  isActive: boolean
  expiresAt?: string | null
}

export default function AdminCouponsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [coupons, setCoupons] = useState<CouponRow[]>([])

  const fetchCoupons = async () => {
    setIsLoading(true)
    try {
      // API: GET /api/admin/coupons
      // Expected response: { coupons: CouponRow[] }
      const res = await fetch("/api/admin/coupons")
      if (res.ok) {
        const data = await res.json()
        setCoupons(data.coupons ?? [])
      } else {
        setCoupons([])
      }
    } catch (e) {
      setCoupons([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCoupons()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Coupons</h1>
        <Link href="/admin/coupons/create">
          <Button style={{ backgroundColor: "#9681FA" }}>Create Coupon</Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Coupons</CardTitle>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500">
                      {isLoading ? "Loading..." : "No coupons found"}
                    </TableCell>
                  </TableRow>
                )}
                {coupons.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.code}</TableCell>
                    <TableCell>{c.discountType === "PERCENTAGE" ? "%" : "Fixed"}</TableCell>
                    <TableCell>{c.discountValue}</TableCell>
                    <TableCell>{c.uses}{c.maxUses ? `/${c.maxUses}` : ""}</TableCell>
                    <TableCell>{c.isActive ? "Active" : "Inactive"}</TableCell>
                    <TableCell>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "-"}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/coupons/${c.id}`}>
                        <Button size="sm" variant="outline">Edit</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


