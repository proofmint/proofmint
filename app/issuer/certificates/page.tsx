"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FallbackIpfsImage } from "@/components/FallbackIpfsImage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, FileText, CheckCircle, Clock, XCircle, Loader2, AlertTriangle, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface IssuedCertificate {
  id: string;
  receiverEmail: string;
  imageCid: string | null;
  mintingStatus: "PENDING" | "MINTED" | "FAILED";
  status: "PENDING" | "CLAIMED" | "REJECTED";
  issuedAt: string;
  certificateName: string;
  template: { templateName: string };
}

interface BulkJob {
  id: string;
  certificateName: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  totalItems: number;
  processedItems: number;
  failedItems: number;
  createdAt: string;
  template: { templateName: string };
  _count: { issuedCertificates: number };
}

interface Receiver {
  email: string;
  fullName: string;
}

function MintingBadge({ status }: { status: string }) {
  switch (status) {
    case "MINTED":
      return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Minted</Badge>;
    case "FAILED":
      return <Badge variant="destructive" className="text-xs">Minting Failed</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">Minting Pending</Badge>;
  }
}

function ClaimBadge({ status }: { status: string }) {
  switch (status) {
    case "CLAIMED":
      return (
        <span className="flex items-center gap-1 text-green-600 text-xs">
          <CheckCircle className="h-3.5 w-3.5" /> Claimed
        </span>
      );
    case "REJECTED":
      return (
        <span className="flex items-center gap-1 text-red-500 text-xs">
          <XCircle className="h-3.5 w-3.5" /> Rejected
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-yellow-600 text-xs">
          <Clock className="h-3.5 w-3.5" /> Awaiting Claim
        </span>
      );
  }
}

function JobStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "COMPLETED":
      return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Completed</Badge>;
    case "PROCESSING":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
    case "FAILED":
      return <Badge variant="destructive" className="text-xs">Failed</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">Pending</Badge>;
  }
}

export default function CertificatesPage() {
  const [singleCertificates, setSingleCertificates] = useState<IssuedCertificate[]>([]);
  const [bulkJobs, setBulkJobs] = useState<BulkJob[]>([]);
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        const res = await fetch("/api/certificates");
        if (!res.ok) throw new Error("Failed to fetch certificates");
        const data = await res.json();
        setSingleCertificates(data.singleCertificates ?? []);
        setBulkJobs(data.bulkJobs ?? []);
        setReceivers(data.receivers ?? []);
      } catch (error: unknown) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load certificates",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchCertificates();
  }, [toast]);

  const getReceiverName = (email: string) =>
    receivers.find((r) => r.email === email)?.fullName ?? email;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Certificates</h1>
          <p className="text-muted-foreground">Manage and view all your issued certificates.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/issuer/certificates/issue">
            <Button style={{ backgroundColor: "#9681FA" }}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Issue Single
            </Button>
          </Link>
          <Link href="/issuer/certificates/bulk">
            <Button variant="outline">
              <PlusCircle className="mr-2 h-4 w-4" />
              Bulk Issue
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Single Certificates Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Single Issuances</h2>
              <span className="text-sm text-gray-400">{singleCertificates.length} certificate{singleCertificates.length !== 1 ? "s" : ""}</span>
            </div>

            {singleCertificates.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed rounded-lg">
                <p className="text-gray-500 text-sm">No single certificates issued yet.</p>
                <Link href="/issuer/certificates/issue">
                  <Button size="sm" className="mt-3" style={{ backgroundColor: "#9681FA" }}>
                    Issue your first certificate
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {singleCertificates.map((cert) => (
                  <Card key={cert.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium truncate">{cert.certificateName}</CardTitle>
                      <p className="text-xs text-muted-foreground truncate">{cert.template.templateName}</p>
                    </CardHeader>
                    <CardContent className="pb-2">
                      {cert.imageCid ? (
                        <div className="relative aspect-4/3 w-full">
                          <FallbackIpfsImage
                            cid={cert.imageCid}
                            type="certificate"
                            alt={cert.certificateName}
                            fill
                            className="rounded-md object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-4/3 w-full rounded-md bg-gray-100 flex items-center justify-center">
                          <FileText className="h-8 w-8 text-gray-300" />
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex flex-col items-start gap-1.5 text-sm pt-0">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-xs text-gray-600 truncate max-w-[150px]">{getReceiverName(cert.receiverEmail)}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <MintingBadge status={cert.mintingStatus} />
                        {cert.mintingStatus === "MINTED" && <ClaimBadge status={cert.status} />}
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Bulk Issuances Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Bulk Issuances</h2>
              <span className="text-sm text-gray-400">{bulkJobs.length} job{bulkJobs.length !== 1 ? "s" : ""}</span>
            </div>

            {bulkJobs.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed rounded-lg">
                <p className="text-gray-500 text-sm">No bulk issuance jobs yet.</p>
                <Link href="/issuer/certificates/bulk">
                  <Button size="sm" className="mt-3" variant="outline">
                    Start a bulk issuance
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {bulkJobs.map((job) => {
                  const progress = job.totalItems > 0 ? Math.round((job.processedItems / job.totalItems) * 100) : 0;
                  return (
                    <Link key={job.id} href={`/issuer/certificates/bulk/jobs/${job.id}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <p className="font-medium text-sm text-gray-900 truncate">{job.certificateName}</p>
                                <JobStatusBadge status={job.status} />
                                {job.failedItems > 0 && (
                                  <span className="flex items-center gap-1 text-xs text-amber-600">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    {job.failedItems} failed
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mb-2">Template: {job.template.templateName}</p>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>{job.totalItems} total</span>
                                <span className="text-green-600">{job.processedItems - job.failedItems} minted</span>
                                {job.failedItems > 0 && <span className="text-red-500">{job.failedItems} failed</span>}
                              </div>
                              {job.status === "PROCESSING" && (
                                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                                  <div className="bg-[#9681FA] h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                                </div>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
