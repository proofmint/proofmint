"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FallbackIpfsImage } from "@/components/FallbackIpfsImage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Lightweight row type for the table ───────────────────────────────────────
interface CertRow {
  id: string;
  receiverEmail: string;
  recipientName: string | null;
  mintingStatus: "PENDING" | "MINTED" | "FAILED";
  status: "PENDING" | "CLAIMED" | "REJECTED";
  issuedAt: string;
  certificateName: string;
  errorMessage?: string | null;
}

interface BulkJob {
  id: string;
  certificateName: string;
  unitName: string;
  description: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  totalItems: number;
  processedItems: number;
  failedItems: number;
  sendEmail: boolean;
  createdAt: string;
  updatedAt: string;
  template: { templateName: string };
  issuedCertificates: CertRow[];
}

// ── Full detail type for the modal ───────────────────────────────────────────
interface CertDetail {
  id: string;
  receiverEmail: string;
  recipientName: string | null;
  certificateName: string;
  unitName: string;
  description: string;
  mintingStatus: "PENDING" | "MINTED" | "FAILED";
  status: "PENDING" | "CLAIMED" | "REJECTED";
  properties: Record<string, string>;
  imageCid: string | null;
  assetId: string | null;
  mintTransactionHash: string | null;
  claimTransactionHash: string | null;
  issuedAt: string;
  claimedAt: string | null;
  errorMessage: string | null;
  network: string;
}

// ── Small helper badges ───────────────────────────────────────────────────────
function MintingBadge({ status }: { status: string }) {
  if (status === "MINTED")
    return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Minted</Badge>;
  if (status === "FAILED")
    return <Badge variant="destructive" className="text-xs">Failed</Badge>;
  return <Badge variant="secondary" className="text-xs">Pending</Badge>;
}

function ClaimBadge({ status }: { status: string }) {
  if (status === "CLAIMED")
    return (
      <span className="flex items-center gap-1 text-green-600 text-xs">
        <CheckCircle className="h-3.5 w-3.5" /> Claimed
      </span>
    );
  if (status === "REJECTED")
    return (
      <span className="flex items-center gap-1 text-red-500 text-xs">
        <XCircle className="h-3.5 w-3.5" /> Rejected
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-yellow-600 text-xs">
      <Clock className="h-3.5 w-3.5" /> Awaiting
    </span>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED")
    return <Badge className="bg-green-100 text-green-700 border-green-200">Completed</Badge>;
  if (status === "PROCESSING")
    return (
      <Badge className="bg-blue-100 text-blue-700 border-blue-200">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing
      </Badge>
    );
  if (status === "FAILED")
    return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [job, setJob] = useState<BulkJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);

  // Modal state
  const [selectedCertId, setSelectedCertId] = useState<string | null>(null);
  const [certDetail, setCertDetail] = useState<CertDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchJob = async () => {
    try {
      const res = await fetch(`/api/certificates/bulk/${jobId}`);
      if (!res.ok) throw new Error("Failed to fetch job");
      const data = await res.json();
      setJob(data.job);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load job",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
    const interval = setInterval(async () => {
      const res = await fetch(`/api/certificates/bulk/${jobId}`).catch(() => null);
      if (!res?.ok) return;
      const data = await res.json();
      setJob(data.job);
      if (data.job.status !== "PROCESSING") clearInterval(interval);
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const openDetail = async (certId: string) => {
    setSelectedCertId(certId);
    setCertDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/certificates/${certId}`);
      if (!res.ok) throw new Error("Failed to fetch certificate details");
      const data = await res.json();
      setCertDetail(data.certificate);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load details",
        variant: "destructive",
      });
      setSelectedCertId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRetry = async () => {
    if (!job) return;
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/certificates/bulk/${jobId}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Retry failed");
      toast({
        title: "Retry started",
        description: `Re-queued ${data.retriedCount} failed certificate${data.retriedCount !== 1 ? "s" : ""}.`,
      });
      await fetchJob();
    } catch (error: unknown) {
      toast({
        title: "Retry failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRetrying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Job not found.</p>
        <Link href="/issuer/certificates">
          <Button className="mt-4" variant="outline">Back to Certificates</Button>
        </Link>
      </div>
    );
  }

  const progress = job.totalItems > 0 ? Math.round((job.processedItems / job.totalItems) * 100) : 0;
  const canRetry = job.failedItems > 0 && job.status === "COMPLETED";
  const mintedCount = job.processedItems - job.failedItems;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push("/issuer/certificates")}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Certificates
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{job.certificateName}</h1>
          <p className="text-gray-500 text-sm mt-0.5">Template: {job.template.templateName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchJob}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          {canRetry && (
            <Button size="sm" variant="destructive" onClick={handleRetry} disabled={isRetrying}>
              {isRetrying ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4 mr-1" />
              )}
              Retry {job.failedItems} Failed
            </Button>
          )}
        </div>
      </div>

      {/* Common details + stats */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-6">
            <JobStatusBadge status={job.status} />
            <div className="grid grid-cols-3 gap-6 flex-1">
              <div>
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-2xl font-bold text-gray-900">{job.totalItems}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Minted</p>
                <p className="text-2xl font-bold text-green-600">{mintedCount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Failed</p>
                <p className="text-2xl font-bold text-red-500">{job.failedItems}</p>
              </div>
            </div>
          </div>

          {job.status === "PROCESSING" && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-[#9681FA] h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}

          {/* Common certificate fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm border-t pt-4">
            <div className="flex justify-between">
              <span className="text-gray-500">Description</span>
              <span className="font-medium text-right max-w-[60%]">{job.description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Unit Name</span>
              <span className="font-medium">{job.unitName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Send Email</span>
              <span className="font-medium">{job.sendEmail ? "Yes" : "No"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Created</span>
              <span className="font-medium">{new Date(job.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certificates table */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Certificates ({job.issuedCertificates.length})
        </h2>

        {job.issuedCertificates.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed rounded-lg">
            <p className="text-gray-500 text-sm">No certificates yet. Processing is starting…</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">#</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Mint Status</TableHead>
                  <TableHead>Claim Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.issuedCertificates.map((cert, index) => (
                  <TableRow
                    key={cert.id}
                    className={cert.mintingStatus === "FAILED" ? "bg-red-50" : undefined}
                  >
                    <TableCell className="text-gray-400 text-xs">{index + 1}</TableCell>
                    <TableCell className="text-sm">{cert.receiverEmail}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {cert.recipientName ?? <span className="text-gray-400 italic">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <MintingBadge status={cert.mintingStatus} />
                        {cert.mintingStatus === "FAILED" && cert.errorMessage && (
                          <span className="text-xs text-red-500 line-clamp-1 max-w-[160px]" title={cert.errorMessage}>
                            {cert.errorMessage}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {cert.mintingStatus === "MINTED" ? (
                        <ClaimBadge status={cert.status} />
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDetail(cert.id)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Detail modal */}
      <Dialog open={selectedCertId !== null} onOpenChange={(open) => { if (!open) setSelectedCertId(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Certificate Details</DialogTitle>
          </DialogHeader>

          {loadingDetail ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
            </div>
          ) : certDetail ? (
            <div className="space-y-5 pt-1">
              {/* Image */}
              {certDetail.imageCid && (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100">
                  <FallbackIpfsImage cid={certDetail.imageCid} type="certificate" alt={certDetail.certificateName} fill className="object-cover" />
                </div>
              )}

              {/* Recipient */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Recipient Email</p>
                  <p className="font-medium">{certDetail.receiverEmail}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Recipient Name</p>
                  <p className="font-medium">{certDetail.recipientName ?? <span className="text-gray-400 italic">Not registered</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Mint Status</p>
                  <MintingBadge status={certDetail.mintingStatus} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Claim Status</p>
                  <ClaimBadge status={certDetail.status} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Issued</p>
                  <p className="font-medium">{new Date(certDetail.issuedAt).toLocaleString()}</p>
                </div>
                {certDetail.claimedAt && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Claimed</p>
                    <p className="font-medium">{new Date(certDetail.claimedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Error message */}
              {certDetail.errorMessage && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  <strong>Error:</strong> {certDetail.errorMessage}
                </div>
              )}

              {/* Properties */}
              {certDetail.properties && Object.keys(certDetail.properties).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Certificate Properties</p>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableBody>
                        {Object.entries(certDetail.properties).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell className="text-gray-500 text-sm w-1/3">{key}</TableCell>
                            <TableCell className="text-sm font-medium">{value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Blockchain links */}
              {(certDetail.assetId || certDetail.mintTransactionHash || certDetail.claimTransactionHash) && (
                <div>
                  <p className="text-sm font-medium mb-2">Blockchain</p>
                  <div className="flex flex-wrap gap-2">
                    {certDetail.assetId && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`https://lora.algokit.io/${certDetail.network.toLowerCase()}/asset/${certDetail.assetId}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Asset {certDetail.assetId}
                        </a>
                      </Button>
                    )}
                    {certDetail.mintTransactionHash && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`https://lora.algokit.io/${certDetail.network.toLowerCase()}/transaction/${certDetail.mintTransactionHash}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Mint Tx
                        </a>
                      </Button>
                    )}
                    {certDetail.claimTransactionHash && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`https://lora.algokit.io/${certDetail.network.toLowerCase()}/transaction/${certDetail.claimTransactionHash}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Claim Tx
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
