"use client";

import type React from "react";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Logo from "@/public/images/Logo.png";
import Image from "next/image";
import CommonHeader from "@/components/CommonHeader";

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const target = e.target as typeof e.target & {
      email: { value: string };
      password: { value: string };
      confirmPassword: { value: string };
      firstName: { value: string };
      lastName: { value: string };
      orgName: { value: string };
    };

    const email = target.email.value;
    const password = target.password.value;
    const confirmPassword = target.confirmPassword.value;

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const name = `${target.firstName?.value} ${target.lastName?.value}`;

    const body = {
      name,
      email,
      password,
      role: "receiver" as const,
      organizationName: target.orgName?.value,
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        router.push("/auth/login?registered=receiver");
      } else {
        const data = await res.json();
        toast({
          title: "Registration failed",
          description: data.message || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <CommonHeader />
      <div className="flex items-center justify-center mt-6 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Image src={Logo} alt="ProofMint" width={32} height={32} />
              <span className="text-2xl font-bold">ProofMint</span>
            </div>
            <CardTitle>Create Your Account</CardTitle>
            <CardDescription>
              Join the future of digital credentialing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Receiver Registration Form */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <User className="h-5 w-5 text-[#9681FA]" />
                  <span className="font-medium">Receive Credentials</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input id="firstName" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input id="lastName" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orgName">College/Organization Name *</Label>
                    <Input
                      id="orgName"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input id="password" type="password" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                      Confirm Password *
                    </Label>
                    <Input id="confirmPassword" type="password" required />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                style={{ backgroundColor: "#9681FA" }}
                disabled={isLoading}
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="text-[#9681FA] hover:underline"
                >
                  Sign in
                </Link>
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Are you an organization?{" "}
                <Link
                  href="/auth/register/issuer"
                  className="text-[#9681FA] hover:underline"
                >
                  Register as issuer
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
