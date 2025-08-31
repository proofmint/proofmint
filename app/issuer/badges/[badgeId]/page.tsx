"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge as UiBadge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Badge, IssuedBadge, BadgeClaimLink, User } from "@prisma/client";
import Link from "next/link";
import { Copy, CheckCircle, Clock, XCircle, ArrowLeft } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type IssuedBadgeWithReceiver = IssuedBadge & {
  receiver: {
    email: string;
    fullName: string | null;
  } | null;
};

type BadgeDetails = Badge & {
  claimLinks: BadgeClaimLink[];
  issuedInstances: IssuedBadgeWithReceiver[];
  distributionType: "magic" | "email";
  receiverUsers: User[];
};

export default function BadgeDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const { badgeId } = params as { badgeId: string };

  const [badge, setBadge] = useState<BadgeDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!badgeId) return;
    const fetchBadgeDetails = async () => {
      try {
        const res = await fetch(`/api/badges/${badgeId}`);
        if (!res.ok) throw new Error("Failed to fetch badge details");
        const data = await res.json();
        console.log(data);
        setBadge(data);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchBadgeDetails();
  }, [badgeId, toast]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Link copied to clipboard." });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-1/4 animate-pulse"></div>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <Card className="animate-pulse">
              <CardContent className="h-64 bg-muted rounded-md"></CardContent>
            </Card>
          </div>
          <div className="md:col-span-2 space-y-6">
            <Card className="animate-pulse">
              <CardContent className="h-96 bg-muted rounded-md"></CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const getFullName = (email: string) => {
    const user = badge?.receiverUsers.find((user) => user.email === email);
    return user?.fullName || "N/A";
  };

  if (!badge) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold">Badge Not Found</h2>
        <p className="text-muted-foreground mt-2">
          The badge you are looking for does not exist or you do not have
          permission to view it.
        </p>
      </div>
    );
  }

  const claimLink =
    badge.distributionType === "magic"
      ? `${window.location.origin}/claim/${badge.claimLinks[0]?.id}`
      : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/issuer/badges"
          className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="h-8 w-8" />
        </Link>
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold truncate">{badge.name}</h1>
          <p className="text-muted-foreground">{badge.description}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle>Badge Details</CardTitle>
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <p className="text-xl font-bold">
                    {badge.distributionType === "magic"
                      ? badge.claimLinks[0]?.limit || 0
                      : badge.issuedInstances.length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {badge.distributionType === "magic" ? "Limit" : "Issued"}
                  </p>
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-xl font-bold">
                    {badge.distributionType === "magic"
                      ? badge.claimLinks[0]?.claimCount || 0
                      : badge.issuedInstances.filter(
                          (i) => i.status === "CLAIMED"
                        ).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Claimed</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative aspect-square w-full">
                <Image
                  src={badge.imageUrl}
                  alt={badge.name}
                  layout="fill"
                  objectFit="cover"
                  className="rounded-md"
                />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Unit Name</h3>
                <p className="text-muted-foreground">{badge.unitName}</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Badge Type</h3>
                <UiBadge variant="secondary">{badge.badgeType}</UiBadge>
              </div>
              {Array.isArray(badge.customProperties) &&
                badge.customProperties.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Custom Properties</h3>
                    <div className="text-sm space-y-1">
                      {badge.customProperties.map((property: any) => (
                        <p key={property.key}>
                          <span className="font-medium">{property.key}:</span>{" "}
                          {property.value}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Distribution Details</CardTitle>
              <CardDescription>
                Method:{" "}
                <UiBadge variant="outline">
                  {badge.distributionType === "magic" ? "Magic Link" : "Email"}
                </UiBadge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {badge.distributionType === "magic" && badge.claimLinks[0] && (
                <div className="space-y-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="claimLink">Sharable Claim Link</Label>
                    <div className="flex items-center gap-2">
                      <Input id="claimLink" value={claimLink} readOnly />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(claimLink)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.No.</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {badge.issuedInstances.map((instance, index) => (
                    <TableRow key={instance.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        {getFullName(instance.receiverEmail)}
                      </TableCell>
                      <TableCell>{instance.receiverEmail}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {instance.status === "CLAIMED" ? (
                            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                          ) : instance.status === "PENDING" ? (
                            <Clock className="h-4 w-4 mr-2 text-yellow-500" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-2 text-red-500" />
                          )}
                          {instance.status.charAt(0).toUpperCase() +
                            instance.status.slice(1)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
