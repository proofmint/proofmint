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
import { Badge as UiBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Award, Search, ExternalLink, Calendar, Loader2, Copy } from "lucide-react";
import { Share2 } from "lucide-react";
import Image from "next/image";

type Badge = {
  id: string;
  title: string;
  issuer: string;
  description: string;
  image?: string;
  status: "CLAIMED" | "PENDING" | "REJECTED";
  type: string;
  properties: Record<string, string>;
  claimedDate?: string;
  rejectedDate?: string;
  issuedDate?: string;
  blockchainUrl?: string;
};

export default function BadgesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loadingById, setLoadingById] = useState<Record<string, "accept" | "reject">>({});
  const [copiedBadgeId, setCopiedBadgeId] = useState<string | null>(null);

  const filteredBadges = badges.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.issuer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    const matchesType =
      typeFilter === "all" ||
      item.type.toLowerCase() === typeFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesType;
  });

  const handleBadgeAction = async (id: string, action: "accept" | "reject") => {
    setLoadingById((prev) => ({ ...prev, [id]: action }));
    try {
      const res = await fetch(`/api/badges/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Failed to update badge status");

      const { updatedBadge, network } = await res.json();
      setBadges((prev) =>
        prev.map((badge) =>
          badge.id === id
            ? {
                ...badge,
                status: updatedBadge.status as Badge["status"],
                claimedDate: updatedBadge.claimedAt,
                blockchainUrl: updatedBadge.transactionHash
                  ? `https://lora.algokit.io/${network}/transaction/${updatedBadge.transactionHash}`
                  : undefined,
              }
            : badge
        )
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingById((prev) => {
        const { [id]: _omit, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleCopyLink = async (badgeId: string, badgeTitle: string) => {
    const shareUrl = `${window.location.origin}/share/badge/${badgeId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedBadgeId(badgeId);
      setTimeout(() => setCopiedBadgeId(null), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const response = await fetch("/api/badges");
        if (!response.ok) throw new Error("Failed to fetch badges");
        const rawData = await response.json();
        console.log(rawData);
        const transformed: Badge[] = rawData.badges.map((item: any) => ({
          id: item.id,
          title: item.badge.name,
          issuer: item.issuer.user.organizationName,
          description: item.badge.description,
          image: item.badge.imageUrl,
          status: item.status,
          type: item.badge.badgeType,
          properties:
            item.badge.customProperties?.reduce(
              (acc: Record<string, string>, prop: any) => {
                acc[prop.key] = prop.value;
                return acc;
              },
              {}
            ) ?? {},
          claimedDate: item.claimedAt,
          rejectedDate: null,
          issuedDate: item.issuedAt,
          blockchainUrl: item.transactionHash
            ? `https://lora.algokit.io/${rawData.network}/transaction/${item.transactionHash}`
            : undefined,
        }));

        setBadges(transformed);
      } catch (error) {
        console.error("Error fetching badges:", error);
      }
    };

    fetchBadges();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Badges</h1>
        <p className="text-gray-600">
          View and manage all your digital badges.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search badges..."
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="skill">Skill</SelectItem>
                <SelectItem value="achievement">Achievement</SelectItem>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="certification">Certification</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
        {filteredBadges.map((badge) => (
          <Card
            key={badge.id}
            className="group shadow-sm hover:shadow-lg transition-all border rounded-2xl flex flex-col overflow-hidden"
          >
            <div className="px-6 pt-6 pb-4">
              <div className="w-[100px] h-[100px] mx-auto mb-4 rounded-lg overflow-hidden border border-gray-200">
                <Image
                  src={badge.image || "/placeholder.png"}
                  alt={badge.title}
                  className="object-contain w-full h-full"
                />
              </div>
              <CardTitle className="text-center text-lg font-semibold text-gray-800">
                {badge.title}
              </CardTitle>
              <CardDescription className="text-center text-sm text-gray-500">
                Issued by{" "}
                <span className="font-medium text-gray-800">
                  {badge.issuer}
                </span>{" "}
              </CardDescription>
            </div>
            <CardContent className="p-6 flex flex-col flex-1">
              <div className="text-sm text-gray-600 line-clamp-4 mb-4">
                {badge.description}
              </div>
              {Object.keys(badge.properties).length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Properties:
                  </p>
                  <div className="space-y-1">
                    {Object.entries(badge.properties).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600">{key}:</span>
                        <span className="font-medium text-gray-800">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-auto space-y-2">
                <div className="flex items-center justify-between">
                  <UiBadge
                    className="px-2 py-1 rounded-full capitalize"
                    variant={
                      badge.status === "CLAIMED"
                        ? "default"
                        : badge.status === "PENDING"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {badge.status}
                  </UiBadge>
                  <div className="text-xs text-gray-500 flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    {badge.status === "CLAIMED" && badge.claimedDate
                      ? `Claimed ${new Date(
                          badge.claimedDate
                        ).toLocaleDateString()}`
                      : badge.status === "REJECTED" && badge.rejectedDate
                      ? `Rejected ${new Date(
                          badge.rejectedDate
                        ).toLocaleDateString()}`
                      : badge.issuedDate
                      ? `Issued ${new Date(
                          badge.issuedDate
                        ).toLocaleDateString()}`
                      : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {badge.status === "PENDING" && (
                    <>
                      <Button
                        size="sm"
                        className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white"
                        disabled={Boolean(loadingById[badge.id])}
                        onClick={() => handleBadgeAction(badge.id, "accept")}
                      >
                        {loadingById[badge.id] === "accept" ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />{" "}
                            Claiming...
                          </>
                        ) : (
                          "Claim"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(loadingById[badge.id])}
                        onClick={() => handleBadgeAction(badge.id, "reject")}
                      >
                        {loadingById[badge.id] === "reject" ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />{" "}
                            Rejecting...
                          </>
                        ) : (
                          "Reject"
                        )}
                      </Button>
                    </>
                  )}
                  {badge.status === "CLAIMED" && badge.blockchainUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-transparent"
                      asChild
                    >
                      <a
                        href={badge.blockchainUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" /> Verify
                      </a>
                    </Button>
                  )}
                  {badge.status === "CLAIMED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-transparent"
                      onClick={() => handleCopyLink(badge.id, badge.title)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      {copiedBadgeId === badge.id ? "Copied!" : "Copy Link"}
                    </Button>
                  )}
                  {badge.status === "CLAIMED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-transparent"
                      onClick={() => {
                        const text = `I just earned the ${badge.title} badge on ProofMint!`;
                        const shareUrl = `${window.location.origin}/share/badge/${badge.id}`;
                        const xUrl = `/api/share/twitter?text=${encodeURIComponent(
                          text
                        )}&url=${encodeURIComponent(shareUrl)}`;
                        window.open(xUrl, "_blank");
                      }}
                    >
                      <Share2 className="h-4 w-4 mr-1" /> Share on X
                    </Button>
                  )}
                  {badge.status === "CLAIMED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-transparent"
                      onClick={() => {
                        const text = `I just earned the ${badge.title} badge on ProofMint!`;
                        const shareUrl = `${window.location.origin}/share/badge/${badge.id}`;
                        const liUrl = `/api/share/linkedin?url=${encodeURIComponent(
                          shareUrl
                        )}&text=${encodeURIComponent(text)}`;
                        window.open(liUrl, "_blank");
                      }}
                    >
                      <Share2 className="h-4 w-4 mr-1" /> Share on LinkedIn
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredBadges.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">
              No badges found matching your criteria.
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