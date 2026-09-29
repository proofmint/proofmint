"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge, BadgeClaimLink, Issuer, User } from "@prisma/client";
import { FallbackIpfsImage } from "@/components/FallbackIpfsImage";
import { Loader2 } from "lucide-react";
import { useSession } from "@/contexts/SessionContext";
import { x402Post } from "@/lib/x402/browser";

type ClaimDetails = BadgeClaimLink & {
  badge: Badge;
  issuer: Issuer & { user: User };
  receiverUsers: User[];
};

export default function ClaimPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading: isSessionLoading } = useSession();
  const { claimId } = params as { claimId: string };

  const [claim, setClaim] = useState<ClaimDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);

  const buttonText = useMemo(() => {
    let text = "Loading...";
    let disabled = true;
    if (claim && !isSessionLoading) {
      if (claim.claimCount >= claim.limit) {
        text = "Sold Out";
        disabled = true;
      } else if (claim.receiverUsers.some((u) => u.id === user?.id)) {
        text = "Claimed";
        disabled = true;
      } else {
        text = "Claim Badge";
        disabled = false;
      }
    }
    return { text, disabled };
  }, [claim, user, isSessionLoading]);

  useEffect(() => {
    if (!claimId) return;
    const fetchBadgeDetails = async () => {
      try {
        const res = await fetch(`/api/badges/claim/${claimId}`);
        if (!res.ok) throw new Error("Failed to fetch badge details");
        const data = await res.json();
        setClaim(data);
      } catch (error) {
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to fetch badge details",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchBadgeDetails();
  }, [claimId, toast]);

  const handleClaim = async () => {
    if (isSessionLoading) return;
    if (!isSessionLoading && !user) {
      localStorage.setItem(
        "pendingClaim",
        JSON.stringify({
          link: `${window.location.origin}/claim/${claimId}`,
          timestamp: new Date().getTime(),
        })
      );
      toast({
        title: "Login Required",
        description: "Please login to claim the badge",
        variant: "destructive",
      });
      router.push("/login");
      return;
    }
    if (isClaiming) return;
    setIsClaiming(true);
    try {
      const result = await x402Post(
        `/api/x402/badges/claim/${claimId}`,
        {},
        { payEndpoint: "/api/receiver/x402/pay" }
      );

      if (!result.ok) {
        toast({
          title: "Error",
          description:
            result.data?.error ||
            result.data?.message ||
            "Failed to claim badge",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Badge claimed successfully!",
      });
      router.push(`/receiver/badges`);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to claim badge",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold">Badge Not Found</h2>
        <p className="text-muted-foreground mt-2">
          The badge you are looking for does not exist or the link is invalid.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <Card>
        <CardHeader className="gap-2">
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="min-w-0 text-2xl leading-tight">
              {claim.badge.name}
              {claim.badge.unitName ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {claim.badge.unitName}
                </span>
              ) : null}
            </CardTitle>
            <p className="shrink-0 pt-1 text-sm text-muted-foreground whitespace-nowrap">
              <span className="font-semibold text-foreground">
                {claim.claimCount}/{claim.limit}
              </span>{" "}
              claimed
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Issued by{" "}
            <span className="font-semibold text-foreground">
              {claim.issuer.user.organizationName}
            </span>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-square w-full overflow-hidden rounded-md">
            <FallbackIpfsImage
              cid={claim.badge.imageCid}
              type="badge"
              alt={claim.badge.name}
              fill
              className="object-cover"
            />
          </div>
          {claim.badge.description ? (
            <p className="text-muted-foreground">{claim.badge.description}</p>
          ) : null}
          <Button
            onClick={handleClaim}
            className="w-full"
            disabled={buttonText.disabled || isClaiming}
          >
            {isClaiming && <Loader2 className="animate-spin mr-2" />}
            {buttonText.text}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
