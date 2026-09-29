"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface Manifest {
  payment: {
    network: string;
    mintNetwork: string;
    asset: string;
    payTo: string | null;
  };
  endpoints: Array<{ method: string; path: string; price: string }>;
}

export default function IssuerApiKeysPage() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/issuer/api-keys");
    if (res.ok) setKeys((await res.json()).keys ?? []);
  }, []);

  useEffect(() => {
    refresh();
    fetch("/api/x402/manifest")
      .then((r) => (r.ok ? r.json() : null))
      .then(setManifest)
      .catch(() => setManifest(null));
  }, [refresh]);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/issuer/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create key");
      setFreshKey(data.key);
      setName("");
      await refresh();
    } catch (e) {
      toast({
        title: "Failed to create key",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    const res = await fetch(`/api/issuer/api-keys/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Key revoked" });
      await refresh();
    } else {
      toast({ title: "Could not revoke key", variant: "destructive" });
    }
  };

  const badgeEndpoint = manifest?.endpoints.find((e) =>
    e.path.includes("/badges/mint")
  );

  const curl = `curl -X POST ${
    typeof window !== "undefined" ? window.location.origin : ""
  }/api/x402/badges/mint \\
  -H "X-Issuer-Key: <your key>" \\
  -H "Content-Type: application/json" \\
  -d '{"badgeName":"Hackathon Finalist","unitName":"HACK",
       "description":"Awarded to finalists",
       "imageUrl":"https://example.com/badge.png",
       "recipientEmail":"winner@example.com"}'`;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <p className="text-muted-foreground text-sm">
          Mint badges and certificates programmatically, paying per mint in USDC
          over the x402 protocol. The key identifies your issuer account; the
          payment authorizes the mint. A credit is still consumed per mint.
        </p>
      </div>

      {freshKey && (
        <Alert>
          <AlertTitle>Copy this key now</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>It is shown once and never stored in full.</p>
            <code className="block break-all rounded bg-muted p-2 text-xs">
              {freshKey}
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(freshKey);
                toast({ title: "Key copied" });
              }}
            >
              Copy
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create a key</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="keyName">Name</Label>
            <Input
              id="keyName"
              value={name}
              placeholder="CI pipeline"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button onClick={create} disabled={creating || !name.trim()}>
            {creating ? "Creating..." : "Create"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your keys</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No keys yet.
                  </TableCell>
                </TableRow>
              )}
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell>{k.name}</TableCell>
                  <TableCell>
                    <code className="text-xs">{k.prefix}…</code>
                  </TableCell>
                  <TableCell>
                    {k.lastUsedAt
                      ? new Date(k.lastUsedAt).toLocaleString()
                      : "Never"}
                  </TableCell>
                  <TableCell>{k.revokedAt ? "Revoked" : "Active"}</TableCell>
                  <TableCell className="text-right">
                    {!k.revokedAt && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => revoke(k.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pay per mint with USDC</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {manifest && (
            <dl className="grid grid-cols-[10rem_1fr] gap-y-1">
              <dt className="text-muted-foreground">Settlement network</dt>
              <dd className="break-all">{manifest.payment.network}</dd>
              <dt className="text-muted-foreground">Mint network</dt>
              <dd>{manifest.payment.mintNetwork}</dd>
              <dt className="text-muted-foreground">USDC asset</dt>
              <dd>{manifest.payment.asset}</dd>
              <dt className="text-muted-foreground">Badge mint</dt>
              <dd>{badgeEndpoint?.price ?? "—"}</dd>
            </dl>
          )}
          <p className="text-muted-foreground">
            Call the endpoint with an x402-aware client. It replies{" "}
            <code>402 Payment Required</code>, your client pays in USDC, and the
            mint runs. You are never charged if the mint fails.
          </p>
          <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
            {curl}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
