import { getWallet } from "@/lib/vault";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";


export async function GET(req: NextRequest) {
    try {
        const wallet = await getWallet("issuer-wallet");
        return NextResponse.json({ message: "Wallet created", wallet }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}