"use client";

import { useState } from "react";
import Link from "next/link";
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
import { Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/contexts/SessionContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const { toast } = useToast();
  const { login } = useSession();

  const handleSendOtp = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address to receive an OTP.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setShowOtpInput(true);
        toast({
          title: "OTP sent",
          description: "Check your email for the one-time password.",
        });
      } else {
        const data = await res.json();
        toast({
          title: "Failed to send OTP",
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

  const handleSendMagicLink = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address to receive a magic link.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setMagicLinkSent(true);
        toast({
          title: "Magic link sent",
          description: "Check your email for the magic login link.",
        });
      } else {
        const data = await res.json();
        toast({
          title: "Failed to send magic link",
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

  const handleLogin = async (
    loginType: "password" | "otp",
    payload: any
  ) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, loginType }),
      });

      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Login successful!",
          description: "Welcome back.",
        });
        login();
      } else {
        toast({
          title: "Login failed",
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
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Shield className="h-8 w-8 text-[#9681FA]" />
            <span className="text-2xl font-bold">CredentialChain</span>
          </div>
          <CardTitle>Welcome Back</CardTitle>
          <CardDescription>
            Choose your preferred sign-in method
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="password">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="otp">OTP</TabsTrigger>
              <TabsTrigger value="magiclink">Magic Link</TabsTrigger>
            </TabsList>
            <TabsContent value="password">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleLogin("password", { email, password });
                }}
                className="space-y-4 pt-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  style={{ backgroundColor: "#9681FA" }}
                  disabled={isLoading}
                >
                  {isLoading ? "Signing In..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="otp">
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="otp-email">Email Address</Label>
                  <Input
                    id="otp-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={showOtpInput}
                  />
                </div>
                {showOtpInput && (
                  <div className="space-y-2">
                    <Label htmlFor="otp">One-Time Password</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Enter your OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                    />
                  </div>
                )}
                {!showOtpInput ? (
                  <Button
                    onClick={handleSendOtp}
                    className="w-full"
                    style={{ backgroundColor: "#9681FA" }}
                    disabled={isLoading}
                  >
                    {isLoading ? "Sending..." : "Send OTP"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleLogin("otp", { email, otp })}
                    className="w-full"
                    style={{ backgroundColor: "#9681FA" }}
                    disabled={isLoading}
                  >
                    {isLoading ? "Verifying..." : "Verify OTP & Sign In"}
                  </Button>
                )}
              </div>
            </TabsContent>
            <TabsContent value="magiclink">
              {!magicLinkSent ? (
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="magic-email">Email Address</Label>
                    <Input
                      id="magic-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    onClick={handleSendMagicLink}
                    className="w-full"
                    style={{ backgroundColor: "#9681FA" }}
                    disabled={isLoading}
                  >
                    {isLoading ? "Sending..." : "Send Magic Link"}
                  </Button>
                </div>
              ) : (
                <div className="text-center pt-4">
                  <p>
                    We've sent a magic link to your email. Click the link to log
                    in.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <Link
                href="/auth/register"
                className="text-[#9681FA] hover:underline"
              >
                Sign up
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
