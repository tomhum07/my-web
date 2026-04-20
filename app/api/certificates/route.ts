import { NextRequest, NextResponse } from "next/server";

interface CertificateData {
  studentName: string;
  studentWalletAddress: string;
  imageHash: string;
  metadataJson?: string;
  documentType: "commendation" | "diploma" | "certificate";
  expirationTimestamp: number;
}

// Store certificates in memory (in production, use a database)
const certificateStore = new Map<string, CertificateData>();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract form fields
    const image = formData.get("image") as File;
    const studentName = formData.get("studentName") as string;
    const studentWalletAddress = formData.get("studentWalletAddress") as string;
    const imageHash = formData.get("imageHash") as string;
    const metadataJson = formData.get("metadataJson") as string | null;
    const documentType = formData.get("documentType") as string;
    const expirationTimestamp = parseInt(formData.get("expirationTimestamp") as string, 10);

    // Validate required fields
    if (!image || !studentName || !studentWalletAddress || !imageHash) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate image is actually an image
    if (!image.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Uploaded file must be an image" },
        { status: 400 }
      );
    }

    // Store certificate metadata
    const certificateData: CertificateData = {
      studentName,
      studentWalletAddress,
      imageHash,
      metadataJson: metadataJson?.trim() || undefined,
      documentType: documentType as "commendation" | "diploma" | "certificate",
      expirationTimestamp,
    };

    // Use imageHash as the key for fast lookup during verification
    certificateStore.set(imageHash, certificateData);

    console.log(`Certificate stored for hash: ${imageHash}`);
    console.log("Certificate data:", certificateData);

    return NextResponse.json(
      {
        success: true,
        message: "Certificate saved successfully",
        imageHash,
        studentName,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Certificate upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to process certificate: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get certificate by hash
    const imageHash = request.nextUrl.searchParams.get("hash");

    if (!imageHash) {
      return NextResponse.json(
        { error: "Hash parameter required" },
        { status: 400 }
      );
    }

    const certificate = certificateStore.get(imageHash);

    if (!certificate) {
      return NextResponse.json(
        { error: "Certificate not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(certificate, { status: 200 });
  } catch (error) {
    console.error("Certificate lookup error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to lookup certificate: ${errorMessage}` },
      { status: 500 }
    );
  }
}
