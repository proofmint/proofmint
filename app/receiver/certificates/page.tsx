"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  FileText,
  Search,
  ExternalLink,
  Calendar,
  Download,
  CheckCircle,
  XCircle,
  Loader2,
  Share2,
  Copy,
} from "lucide-react";

type Certificate = {
  id: string;
  title: string;
  issuer: string;
  description: string;
  image?: string;
  status: "claimed" | "pending" | "rejected";
  issuedDate?: string;
  claimedDate?: string;
  rejectedDate?: string;
  blockchainUrl?: string;
  fieldValues: {
    key: string;
    value: string;
  }[];
};

export default function CertificatesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [copiedCertificateId, setCopiedCertificateId] = useState<string | null>(null);
  const [loadingIds, setLoadingIds] = useState<string[]>([]);

  const filteredCertificates = certificates.filter((certificate) => {
    const matchesSearch =
      certificate.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      certificate.issuer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      certificate.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || certificate.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleCertificateAction = async (
    id: string,
    action: "accept" | "reject"
  ) => {
    setLoadingIds((prev) => [...prev, id]);
    try {
      const res = await fetch(`/api/certificates/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Failed to update certificate status");

      const { updatedCertificate, network } = await res.json();
      setCertificates((prev) =>
        prev.map((cert) =>
          cert.id === id
            ? {
                ...cert,
                status: updatedCertificate.status.toLowerCase() as Certificate["status"],
                claimedDate: updatedCertificate.claimedAt,
                blockchainUrl: updatedCertificate.claimTransactionHash
                  ? `https://lora.algokit.io/${network}/transaction/${updatedCertificate.claimTransactionHash}`
                  : updatedCertificate.mintTransactionHash
                  ? `https://lora.algokit.io/${network}/transaction/${updatedCertificate.mintTransactionHash}`
                  : undefined,
              }
            : cert
        )
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingIds((prev) => prev.filter((c) => c !== id));
    }
  };

  const handleCopyLink = async (certificateId: string) => {
    const shareUrl = `${window.location.origin}/share/certificate/${certificateId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedCertificateId(certificateId);
      setTimeout(() => setCopiedCertificateId(null), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleDownloadCertificate = async (certificate: Certificate) => {
    if (!certificate.image) return;
    try {
      const response = await fetch(certificate.image);
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }
      const imageBlob = await response.blob();
      const blobUrl = URL.createObjectURL(imageBlob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${certificate.title || "certificate"}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Failed to download the certificate:", error);
    }
  };

  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        const response = await fetch("/api/certificates");
        if (!response.ok) throw new Error("Failed to fetch certificates");
        const rawData = await response.json();

        const transformed: Certificate[] = rawData.certificates.map(
          (item: any) => ({
            id: item.id,
            title: item.template.templateName,
            issuer: item.issuer.user.organizationName,
            description: item.template.templateDescription,
            image: item.imageUrl || undefined,
            status: item.status.toLowerCase() as Certificate["status"],
            fieldValues: item.properties
              ? Object.entries(item.properties as Record<string, string>).map(([key, value]) => ({ key, value }))
              : [],
            claimedDate: item.claimedAt,
            issuedDate: item.issuedAt,
            blockchainUrl: item.claimTransactionHash
              ? `https://lora.algokit.io/${rawData.network}/transaction/${item.claimTransactionHash}`
              : item.mintTransactionHash
              ? `https://lora.algokit.io/${rawData.network}/transaction/${item.mintTransactionHash}`
              : undefined,
          })
        );

        setCertificates(transformed);
      } catch (error) {
        console.error("Error fetching certificates:", error);
      }
    };

    fetchCertificates();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Certificates</h1>
        <p className="text-gray-600">
          View and manage all your digital certificates.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search certificates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="claimed">Claimed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Certificates Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {filteredCertificates.map((certificate) => {
          const isLoading = loadingIds.includes(certificate.id);
          const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/share/certificate/${certificate.id}`;
          const shareText = `I just received the ${certificate.title} certificate on ProofMint!`;

          return (
            <Card
              key={certificate.id}
              className="group hover:shadow-lg transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="relative aspect-video bg-gray-100 rounded-lg mb-3 overflow-hidden">
                  <Image
                    src={certificate.image || "/placeholder.svg"}
                    alt={certificate.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{certificate.title}</CardTitle>
                    <CardDescription>
                      Issued by {certificate.issuer}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      certificate.status === "claimed"
                        ? "default"
                        : certificate.status === "pending"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {certificate.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">{certificate.description}</p>

                {/* Certificate Details */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Certificate Details:
                  </p>
                  <div className="space-y-1">
                    {certificate.fieldValues.map((value) => (
                      <div
                        key={value.key}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-gray-600">{value.key}:</span>
                        <span className="font-medium text-right">
                          {value.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Date Information */}
                <div className="text-xs text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    {certificate.status === "claimed" && certificate.claimedDate
                      ? `Claimed on ${new Date(certificate.claimedDate).toLocaleDateString()}`
                      : certificate.issuedDate
                      ? `Issued on ${new Date(certificate.issuedDate).toLocaleDateString()}`
                      : null}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  {certificate.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        className="flex-1"
                        style={{ backgroundColor: "#9681FA" }}
                        disabled={isLoading}
                        onClick={() => handleCertificateAction(certificate.id, "accept")}
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        )}
                        Claim
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={isLoading}
                        onClick={() => handleCertificateAction(certificate.id, "reject")}
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-1" />
                        )}
                        Reject
                      </Button>
                    </>
                  )}

                  {certificate.status === "claimed" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 bg-transparent"
                        onClick={() => handleDownloadCertificate(certificate)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                      {certificate.blockchainUrl && (
                        <Button size="sm" variant="outline" asChild>
                          <a
                            href={certificate.blockchainUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Verify
                          </a>
                        </Button>
                      )}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline" className="bg-transparent">
                            <Share2 className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2" align="end">
                          <div className="flex flex-col gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="justify-start"
                              onClick={() => handleCopyLink(certificate.id)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              {copiedCertificateId === certificate.id ? "Copied!" : "Copy Link"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="justify-start"
                              onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank")}
                            >
                              <Share2 className="h-4 w-4 mr-2" />
                              Share on X
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="justify-start"
                              onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&mini=true&summary=${encodeURIComponent(shareText)}`, "_blank")}
                            >
                              <Share2 className="h-4 w-4 mr-2" />
                              Share on LinkedIn
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredCertificates.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">
              No certificates found matching your criteria.
            </p>
            <p className="text-sm text-gray-400">
              Try adjusting your search or filters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
