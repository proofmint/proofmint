"use client";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Logo from "@/public/images/Logo.png";
import Link from "next/link";

export default function CommonHeader() {
  const router = useRouter();
  return (
    <header className="border-b bg-white/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div
          onClick={() => router.push("/")}
          className="flex items-center space-x-2 cursor-pointer"
        >
          <Image src={Logo} alt="Logo" width={44} height={48} />
          <span className="text-2xl font-bold text-gray-900">ProofMint</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/auth/login">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link href="/auth/register">
            <Button
              style={{ backgroundColor: "#9681FA" }}
              className="hover:opacity-90"
            >
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
