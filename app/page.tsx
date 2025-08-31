import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge, Shield, Zap } from "lucide-react";
import Logo from "@/public/images/Logo.png";
import Image from "next/image";
import CommonHeader from "@/components/CommonHeader";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <CommonHeader />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Secure Digital Credentials on{" "}
            <span className="text-[#9681FA]">Blockchain</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Create, issue, and verify digital badges and certificates with
            blockchain technology. Ensure authenticity and prevent fraud with
            our decentralized credentialing platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register?role=issuer">
              <Button
                size="lg"
                style={{ backgroundColor: "#9681FA" }}
                className="hover:opacity-90"
              >
                Start Issuing Credentials
              </Button>
            </Link>
            <Link href="/auth/register?role=receiver">
              <Button size="lg" variant="outline">
                Claim Your Credentials
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Why Choose ProofMint?
          </h2>
          <p className="text-lg text-gray-600">
            Powerful features for modern digital credentialing
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center">
            <CardHeader>
              <Shield className="h-12 w-12 text-[#9681FA] mx-auto mb-4" />
              <CardTitle>Blockchain Security</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                All credentials are minted as NFTs on blockchain, ensuring
                immutability and preventing fraud.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Badge className="h-12 w-12 text-[#9681FA] mx-auto mb-4" />
              <CardTitle>Easy Badge Creation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Create beautiful digital badges and certificates with our
                intuitive template system.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Zap className="h-12 w-12 text-[#9681FA] mx-auto mb-4" />
              <CardTitle>Instant Verification</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Verify credentials instantly through blockchain explorer
                integration and IPFS storage.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-[#9681FA] text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of organizations already using ProofMint
          </p>
          <Link href="/auth/register">
            <Button size="lg" variant="secondary">
              Create Your Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Image src={Logo} alt="ProofMint" width={32} height={32} />
            <span className="text-lg font-semibold">ProofMint</span>
          </div>
          <p className="text-gray-400">
            © 2025 ProofMint. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
