"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function VerifyEmailPage() {
  const [status, setStatus] = useState<
    "verifying" | "success" | "error" | "idle"
  >("idle");
  const [message, setMessage] = useState("");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (token && status === "idle") {
      setStatus("verifying");
      const verifyEmail = async () => {
        try {
          const res = await fetch("/api/auth/verify-email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token }),
          });

          const data = await res.json();
          if (res.ok) {
            setStatus("success");
            setMessage("Your email has been verified successfully!");
          } else {
            setStatus("error");
            setMessage(data.message || "Failed to verify email.");
          }
        } catch (error) {
          setStatus("error");
          setMessage("An unexpected error occurred.");
        }
      };
      verifyEmail();
    }
  }, [token, status]);

  const renderContent = () => {
    switch (status) {
      case "verifying":
        return <p>Verifying your email...</p>;
      case "success":
        return (
          <div className="text-center">
            <p className="text-green-600">{message}</p>
            <Button asChild className="mt-4">
              <Link href="/auth/login">Go to Login</Link>
            </Button>
          </div>
        );
      case "error":
        return <p className="text-red-600">{message}</p>;
      case "idle":
        if (!token) {
          return <p>No verification token found.</p>;
        }
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center">{renderContent()}</CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailPage />
    </Suspense>
  );
}