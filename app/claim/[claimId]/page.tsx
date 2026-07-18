"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge, BadgeClaimLink, Issuer, User } from "@prisma/client";
import { FallbackIpfsImage } from "@/components/FallbackIpfsImage";
import { CheckCircle, Clock, Loader2 } from "lucide-react";
import { useSession } from "@/contexts/SessionContext";

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
    if(isClaiming) return;
    setIsClaiming(true);
    const res = await fetch(`/api/badges/claim/${claimId}`, {
      method: "POST",
    });

    if (!res.ok) {
      toast({
        title: "Error",
        description: "Failed to claim badge",
        variant: "destructive",
      });
      setIsClaiming(false);
      return;
    }

    const data = await res.json();

    toast({
      title: "Success",
      description: "Badge claimed successfully!",
    });

    setIsClaiming(false);
    router.push(`/receiver/badges`);
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
    <div className="w-fit mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            <div className="flex">
              <div className="flex-1">
                <div className="flex items-center">
                  {claim.badge.name}
                  <span className="text-sm ml-2 text-muted-foreground">
                    {claim.badge.unitName}
                  </span>
                </div>
                <div className="flex mt-2">
                  <span className="text-sm text-muted-foreground">
                    Issued by{" "}
                    <span className="font-bold">
                      {claim.issuer.user.organizationName}
                    </span>
                  </span>
                </div>
              </div>
              <div className="items-end justify-start flex flex-col text-[18px]">
                <span className="whitespace-nowrap">
                  <span className="font-bold">
                    {claim.claimCount}/{claim.limit}
                  </span>
                  <span> claimed</span>
                </span>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-square w-full">
            <FallbackIpfsImage
              cid={claim.badge.imageCid}
              type="badge"
              alt={claim.badge.name}
              fill
              className="rounded-md object-cover"
            />
          </div>
          <p className="text-muted-foreground">{claim.badge.description}</p>
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
