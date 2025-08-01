import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    (await cookies()).delete("token");
    return NextResponse.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
