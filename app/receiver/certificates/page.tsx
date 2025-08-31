"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  FileText,
  Search,
  ExternalLink,
  Eye,
  Calendar,
  Download,
  CheckCircle,
  XCircle,
  Loader2,
  Share2,
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
  const [loadingIds, setLoadingIds] = useState<string[]>([]);
  const [selectedCertificate, setSelectedCertificate] =
    useState<Certificate | null>(null);

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
                status: updatedCertificate.status as Certificate["status"],
                claimedDate: updatedCertificate.claimedAt,
                blockchainUrl: updatedCertificate.transactionHash
                  ? `https://lora.algokit.io/${network}/transaction/${updatedCertificate.transactionHash}`
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

  const handleDownloadCertificate = async (certificate: Certificate) => {
    // Simulate certificate download
    console.log(`Downloading certificate: ${certificate.title}`);

    if (!certificate.image) return;
    try {
      // 1. Fetch the image data
      const response = await fetch(certificate.image);
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }

      // 2. Create a Blob from the response
      const imageBlob = await response.blob();

      // 3. Create a temporary URL for the Blob
      const blobUrl = URL.createObjectURL(imageBlob);

      // 4. Use the temporary URL to trigger the download
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${certificate.title || "certificate"}.png`; // Set a fallback name
      document.body.appendChild(a); // Append to body to ensure it works in all browsers
      a.click();

      // 5. Clean up by removing the element and revoking the URL
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Failed to download the certificate:", error);
      // Optionally, inform the user that the download failed
    }
  };

  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        const response = await fetch("/api/certificates");
        if (!response.ok) throw new Error("Failed to fetch certificates");
        const rawData = await response.json();

        console.log(rawData, "rawData");
        const transformed: Certificate[] = rawData.certificates.map(
          (item: any) => ({
            id: item.id,
            title: item.template.templateName,
            issuer: item.issuer.organizationName,
            description: item.template.templateDescription,
            image: item.generatedImageUrl,
            status: item.status,
            fieldValues:
              (item.fieldData as { key: string; value: string }[]) ?? [],
            claimedDate: item.claimedAt,
            rejectedDate: null, // The DB schema doesn't seem to have rejectedAt.
            issuedDate: item.issuedAt,
            blockchainUrl: item.transactionHash
              ? `https://lora.algokit.io/${rawData.network}/transaction/${item.transactionHash}`
              : undefined,
          })
        );

        console.log(transformed, "transformed");

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
        {filteredCertificates.map((certificate) => (
          <Card
            key={certificate.id}
            className="group hover:shadow-lg transition-shadow"
          >
            <CardHeader className="pb-3">
              <div className="aspect-video bg-gray-100 rounded-lg mb-3 overflow-hidden">
                <img
                  src={certificate.image || "/placeholder.svg"}
                  alt={certificate.title}
                  className="w-full h-full object-cover"
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
                    ? `Claimed on ${new Date(
                        certificate.claimedDate
                      ).toLocaleDateString()}`
                    : certificate.issuedDate
                    ? `Issued on ${new Date(
                        certificate.issuedDate
                      ).toLocaleDateString()}`
                    : null}
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2 pt-2">
                {certificate.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      className="flex-1"
                      style={{ backgroundColor: "#9681FA" }}
                      disabled={loadingIds.includes(certificate.id)}
                      onClick={() =>
                        handleCertificateAction(certificate.id, "accept")
                      }
                    >
                      {loadingIds.includes(certificate.id) ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />{" "}
                          Claiming...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Claim
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingIds.includes(certificate.id)}
                      onClick={() =>
                        handleCertificateAction(certificate.id, "reject")
                      }
                    >
                      {loadingIds.includes(certificate.id) ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />{" "}
                          Rejecting...
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </>
                      )}
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
                    <Button size="sm" variant="outline" className="flex-1 bg-transparent" onClick={() => {
                      const text = `I just received the ${certificate.title} certificate on ProofMint!`;
                      const url = certificate.blockchainUrl || window.location.href;
                      const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
                      window.open(xUrl, "_blank");
                    }}>
                      <Share2 className="h-4 w-4 mr-1" /> Share on X
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 bg-transparent" onClick={() => {
                      const text = `I just received the ${certificate.title} certificate on ProofMint!`;
                      const url = certificate.blockchainUrl || window.location.href;
                      const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&mini=true&summary=${encodeURIComponent(text)}`;
                      window.open(liUrl, "_blank");
                    }}>
                      <Share2 className="h-4 w-4 mr-1" /> Share on LinkedIn
                    </Button>
                  </>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedCertificate(certificate)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
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

      {/* Certificate Detail Modal/Preview would go here */}
      {selectedCertificate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{selectedCertificate.title}</CardTitle>
                  <CardDescription>
                    Issued by {selectedCertificate.issuer}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCertificate(null)}
                >
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <img
                src={selectedCertificate.image || "/placeholder.svg"}
                alt={selectedCertificate.title}
                className="w-full rounded-lg"
              />
              <p className="text-sm text-gray-600">
                {selectedCertificate.description}
              </p>

              <div>
                <h4 className="font-medium mb-2">Certificate Information:</h4>
                <div className="space-y-2">
                  {selectedCertificate.fieldValues.map((value) => (
                    <div key={value.key} className="flex justify-between">
                      <span className="text-gray-600">{value.key}:</span>
                      <span className="font-medium">{value.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedCertificate.status === "claimed" &&
                selectedCertificate.blockchainUrl && (
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      className="flex-1 bg-transparent"
                      onClick={() =>
                        handleDownloadCertificate(selectedCertificate)
                      }
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Certificate
                    </Button>
                    <Button variant="outline" asChild>
                      <a
                        href={selectedCertificate.blockchainUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Verify on Blockchain
                      </a>
                    </Button>
                  </div>
                )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
