"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSession } from "@/contexts/SessionContext";
import CommonHeader from "@/components/CommonHeader";

function VerifyTokenPage() {
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying"
  );
  const [message, setMessage] = useState("");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { login } = useSession();

  useEffect(() => {
    if (token) {
      const verifyToken = async () => {
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token, loginType: "magic-link" }),
          });

          const data = await res.json();
          if (res.ok) {
            setStatus("success");
            setMessage("You have been successfully logged in!");
            login();
          } else {
            setStatus("error");
            setMessage(data.message || "Failed to verify token.");
          }
        } catch (error) {
          setStatus("error");
          setMessage("An unexpected error occurred.");
        }
      };
      verifyToken();
    }
  }, [token, login]);

  const renderContent = () => {
    switch (status) {
      case "verifying":
        return <p>Verifying your token...</p>;
      case "success":
        return (
          <div className="text-center">
            <p className="text-green-600">{message}</p>
            <Button asChild className="mt-4">
              <Link href="/">Go to Dashboard</Link>
            </Button>
          </div>
        );
      case "error":
        return <p className="text-red-600">{message}</p>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <CommonHeader />

      <div className="flex items-center justify-center mt-10 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">
              Magic Link Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyTokenPageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyTokenPage />
    </Suspense>
  );
}
