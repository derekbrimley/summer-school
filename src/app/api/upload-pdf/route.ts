import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
  }

  // 10MB limit
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
      import.meta.url
    ).href;

    const pdf = await pdfjsLib.getDocument({ data } as Parameters<typeof pdfjsLib.getDocument>[0]).promise;
    const pages: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .filter((item: Record<string, unknown>) => "str" in item)
        .map((item: Record<string, unknown>) => item.str as string)
        .join(" ");
      if (text.trim()) {
        pages.push(text.trim());
      }
    }

    const fullText = pages.join("\n\n");

    if (!fullText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from this PDF. It may be image-based — try copying the text manually." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: fullText,
      pages: pdf.numPages,
      fileName: file.name,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to parse PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
