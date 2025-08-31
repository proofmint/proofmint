"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlusCircle, CheckCircle, Clock, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { IssuedCertificate, CertificateTemplate, User } from "@prisma/client";

type CertificateWithTemplate = IssuedCertificate & {
  template: CertificateTemplate;
};

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<CertificateWithTemplate[]>(
    []
  );
  const [receivers, setReceivers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        const res = await fetch("/api/certificates");
        if (!res.ok) throw new Error("Failed to fetch certificates");
        const data = await res.json();
        setCertificates(data.certificates);
        setReceivers(data.receivers);
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
    fetchCertificates();
  }, [toast]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Your Certificates</h1>
          <p className="text-muted-foreground">
            Manage and view all your issued certificates.
          </p>
        </div>
        <Link href="/issuer/certificates/create">
          <Button style={{ backgroundColor: "#9681FA" }}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Certificate
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-32 bg-muted rounded-md"></div>
              </CardContent>
              <CardFooter>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : certificates.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {certificates.map((certificate) => (
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="truncate">
                  {certificate.template.templateName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-square w-full">
                  <Image
                    src={certificate.generatedImageUrl || ""}
                    alt={certificate.template.templateName}
                    layout="fill"
                    objectFit="cover"
                    className="rounded-md"
                  />
                </div>
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground flex-col justify-start items-start">
                <div className="flex items-center">
                  {certificate.claimedAt ? (
                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  ) : (
                    <Clock className="mr-2 h-4 w-4 text-yellow-500" />
                  )}
                  {certificate.claimedAt ? "Claimed" : "Pending"}
                </div>
                <div className="flex items-center mt-2">
                  <FileText className="mr-2 h-4 w-4" />
                  {
                    receivers.find(
                      (receiver) => receiver.email === certificate.receiverEmail
                    )?.fullName
                  }
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <h2 className="text-xl font-semibold">No Certificates Yet</h2>
          <p className="text-muted-foreground mt-2">
            Get started by creating your first certificate.
          </p>
        </div>
      )}
    </div>
  );
}
