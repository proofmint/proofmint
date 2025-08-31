"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

interface CreditRequestRow {
  id: string
  issuerId: string
  issuerEmail: string
  creditsRequested: number
  amountPaid: string
  paymentProofUrl: string
  referenceNumber: string
  status: string
  createdAt: string
}

export default function AdminCreditRequestsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [requests, setRequests] = useState<CreditRequestRow[]>([])
  const [granting, setGranting] = useState<string | null>(null)
  const [grantNotes, setGrantNotes] = useState<Record<string, string>>({})
  const { toast } = useToast()

  const fetchRequests = async () => {
    setIsLoading(true)
    try {
      // API: GET /api/admin/credit-requests?status=pending
      // Response: { requests: CreditRequestRow[] }
      const res = await fetch("/api/admin/credit-requests?status=pending")
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests ?? [])
      } else {
        setRequests([])
      }
    } catch (e) {
      setRequests([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const updateRequest = async (requestId: string, action: "approve" | "reject") => {
    try {
      // API: POST /api/admin/credit-requests/{requestId}/approve OR /reject
      // Body: { adminNotes?: string }
      const res = await fetch(`/api/admin/credit-requests/${requestId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: grantNotes[requestId] ?? undefined })
      })
      if (res.ok) {
        toast({ title: `Request ${action}d` })
        fetchRequests()
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: `Failed to ${action}`, description: data.message ?? "", variant: "destructive" })
      }
    } catch (e) {
      toast({ title: "Network error", variant: "destructive" })
    }
  }

  const approveAndGrant = async (requestId: string) => {
    setGranting(requestId)
    try {
      // API: POST /api/admin/credit-requests/{requestId}/approve
      // Body: { adminNotes?: string }
      const res = await fetch(`/api/admin/credit-requests/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: grantNotes[requestId] ?? undefined })
      })
      if (res.ok) {
        toast({ title: "Approved & Granted" })
        fetchRequests()
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Action failed", description: data.message ?? "", variant: "destructive" })
      }
    } catch (e) {
      toast({ title: "Network error", variant: "destructive" })
    } finally {
      setGranting(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Credit Purchase Requests</h1>
      <Card>
        <CardHeader>
          <CardTitle>Pending Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issuer</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Amount Paid</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Proof</TableHead>
                  <TableHead>Requested At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500">
                      {isLoading ? "Loading..." : "No pending requests"}
                    </TableCell>
                  </TableRow>
                )}
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.issuerEmail}</TableCell>
                    <TableCell>{r.creditsRequested}</TableCell>
                    <TableCell>{r.amountPaid}</TableCell>
                    <TableCell>{r.referenceNumber}</TableCell>
                    <TableCell>
                      <a href={r.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="text-[#9681FA] underline">View</a>
                    </TableCell>
                    <TableCell>{new Date(r.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Input
                        placeholder="Notes (optional)"
                        value={grantNotes[r.id] ?? ""}
                        onChange={(e) => setGrantNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        className="inline-block w-48 mr-2"
                      />
                      <Button size="sm" variant="outline" onClick={() => approveAndGrant(r.id)}>
                        {granting === r.id ? "Processing..." : "Approve & Grant"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => updateRequest(r.id, "reject")}>Reject</Button>
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


