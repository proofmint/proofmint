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
import { useToast } from "@/hooks/use-toast";

interface IssuerRow {
  id: string;
  userEmail: string;
  organizationName: string;
  websiteUrl?: string | null;
  status: string;
}

export default function AdminIssuersPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [issuers, setIssuers] = useState<IssuerRow[]>([]);
  const { toast } = useToast();

  const fetchIssuers = async () => {
    setIsLoading(true);
    try {
      // API: GET /api/admin/issuers?status=pending
      // Expected response: { issuers: IssuerRow[] }
      const res = await fetch("/api/admin/issuers?status=pending");
      if (res.ok) {
        const data = await res.json();
        setIssuers(data.issuers ?? []);
      } else {
        setIssuers([]);
      }
    } catch (e) {
      setIssuers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIssuers();
  }, []);

  const updateIssuerStatus = async (
    issuerId: string,
    action: "approve" | "reject"
  ) => {
    try {
      // API: POST /api/admin/issuers/{issuerId}/approve OR /reject
      // Expected body: { notes?: string }
      // Expected response: 200 OK
      const endpoint = `/api/admin/issuers/${issuerId}/${action}`;
      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) {
        toast({ title: `Issuer ${action}d` });
        fetchIssuers();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: `Failed to ${action}`,
          description: data.message ?? "",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({ title: "Network error", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Issuers Pending Approval</h1>
      <Card>
        <CardHeader>
          <CardTitle>Pending Issuers</CardTitle>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issuers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-gray-500"
                    >
                      {isLoading ? "Loading..." : "No pending issuers"}
                    </TableCell>
                  </TableRow>
                )}
                {issuers.map((issuer) => (
                  <TableRow key={issuer.id}>
                    <TableCell>{issuer.userEmail}</TableCell>
                    <TableCell>{issuer.organizationName}</TableCell>
                    <TableCell>{issuer.websiteUrl ?? "-"}</TableCell>
                    <TableCell className="capitalize">
                      {issuer.status.toLowerCase()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateIssuerStatus(issuer.id, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => updateIssuerStatus(issuer.id, "reject")}
                      >
                        Reject
                      </Button>
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
