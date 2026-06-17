import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const dataUrl = "data:" + file.type + ";base64," + base64;

    console.log("[Upload Proxy] Uploaded:", file.name, file.size + " bytes, type:", file.type);
    return NextResponse.json({ success: true, data: dataUrl, mimeType: file.type });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
