import mammoth from "mammoth";
import pdf from "pdf-parse";
import { AppError, shortText } from "@/lib/core";

const MAX_BYTES = 10 * 1024 * 1024;
const DOCUMENT_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain"
} as const;

function extensionFor(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

export function documentTypeForName(name: string) {
  const extension = extensionFor(name);
  const mimeType = DOCUMENT_TYPES[extension as keyof typeof DOCUMENT_TYPES];
  if (!mimeType) throw new AppError("Use a PDF, DOCX, or TXT file.", 422);
  return { extension, mimeType };
}

function verifyFileSignature(extension: string, bytes: Buffer) {
  if (extension === "pdf" && !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new AppError("That file is not a valid PDF.", 422);
  }
  if (extension === "docx" && !bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    throw new AppError("That file is not a valid DOCX document.", 422);
  }
  if (extension === "txt" && bytes.includes(0)) {
    throw new AppError("That text file contains unsupported binary data.", 422);
  }
}

export async function readUserDocument(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  return readDocumentBytes({
    name: file.name,
    mimeType: file.type,
    bytes
  });
}

export async function readDocumentBytes(input: { name: string; mimeType: string; bytes: Buffer }) {
  const { extension, mimeType } = documentTypeForName(input.name);
  if (input.bytes.length === 0 || input.bytes.length > MAX_BYTES) {
    throw new AppError("Files must be between 1 byte and 10 MB.");
  }
  verifyFileSignature(extension, input.bytes);

  let text = "";

  try {
    if (extension === "txt") {
      text = input.bytes.toString("utf8");
    } else if (extension === "docx") {
      text = (await mammoth.extractRawText({ buffer: input.bytes })).value;
    } else {
      text = (await pdf(input.bytes)).text;
    }
  } catch {
    throw new AppError("This file could not be read. Try exporting it again or use a TXT file.", 422);
  }

  return {
    text: shortText(text, 12000),
    mimeType
  };
}
