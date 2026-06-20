import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
  const url = `${backendUrl}/api/schools/${params.id}/timetables/generate`;

  try {
    const body = await req.json();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error("Custom proxy error for generation:", error);
    return NextResponse.json(
      { detail: "Failed to reach backend generation endpoint" },
      { status: 500 }
    );
  }
}
