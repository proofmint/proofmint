"use client";

import type React from "react";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Shield, Building, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function RegisterPage() {
  const [userType, setUserType] = useState<"issuer" | "receiver">("receiver");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const role = searchParams.get("role");
    if (role === "issuer" || role === "receiver") {
      setUserType(role);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const target = e.target as typeof e.target & {
      email: { value: string };
      password: { value: string };
      confirmPassword: { value: string };
      firstName?: { value: string };
      lastName?: { value: string };
      orgName?: { value: string };
      website?: { value: string };
      contactPerson?: { value: string };
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

    const isReceiver = userType === "receiver";
    const name = isReceiver
      ? `${target.firstName?.value} ${target.lastName?.value}`
      : target.contactPerson?.value;

    const body: any = {
      name,
      email,
      password,
      role: userType,
    };

    if (!isReceiver) {
      body.organizationName = target.orgName?.value;
      body.websiteUrl = target.website?.value;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({
          title: "Registration successful!",
          description: "We've sent a verification link to your email address.",
        });
        router.push("/auth/login");
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Shield className="h-8 w-8 text-[#9681FA]" />
            <span className="text-2xl font-bold">CredentialChain</span>
          </div>
          <CardTitle>Create Your Account</CardTitle>
          <CardDescription>
            Join the future of digital credentialing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User Type Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">I want to:</Label>
              <RadioGroup
                value={userType}
                onValueChange={(value: "issuer" | "receiver") =>
                  setUserType(value)
                }
                className="grid grid-cols-2 gap-4"
              >
                <Label className="cursor-pointer" htmlFor="issuer">
                  <div className="flex w-full items-center space-x-2 border rounded-lg p-4 hover:bg-gray-50">
                    <RadioGroupItem value="issuer" id="issuer" />
                    <div className="flex items-center space-x-2">
                      <Building className="h-5 w-5 text-[#9681FA]" />
                      <div>
                        <span className="font-medium">Issue Credentials</span>
                        <p className="text-xs text-gray-500">
                          For organizations
                        </p>
                      </div>
                    </div>
                  </div>
                </Label>

                <Label className="cursor-pointer" htmlFor="receiver">
                  <div className="flex w-full items-center space-x-2 border rounded-lg p-4 hover:bg-gray-50">
                    <RadioGroupItem value="receiver" id="receiver" />
                    <div className="flex items-center space-x-2">
                      <User className="h-5 w-5 text-[#9681FA]" />
                      <div>
                        <span className="font-medium">Receive Credentials</span>
                        <p className="text-xs text-gray-500">For individuals</p>
                      </div>
                    </div>
                  </div>
                </Label>
              </RadioGroup>
            </div>

            {userType === "issuer" ? (
              // Issuer Registration Form
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="orgName">Organization Name *</Label>
                    <Input
                      id="orgName"
                      placeholder="Acme University"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://acme.edu"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">Contact Person *</Label>
                    <Input id="contactPerson" placeholder="John Doe" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Official Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@acme.edu"
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
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <Input id="confirmPassword" type="password" required />
                  </div>
                </div>
              </div>
            ) : (
              // Receiver Registration Form
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input id="firstName" placeholder="John" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input id="lastName" placeholder="Doe" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input id="password" type="password" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <Input id="confirmPassword" type="password" required />
                  </div>
                </div>
              </div>
            )}

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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
