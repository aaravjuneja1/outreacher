import mammoth from "mammoth";
import pdf from "pdf-parse";
import { AppError, shortText } from "@/lib/core";

const MAX_BYTES = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = ["pdf", "docx", "txt"];

function extensionFor(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
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
  const extension = extensionFor(input.name);
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    throw new AppError("Use a PDF, DOCX, or TXT file.");
  }
  if (input.bytes.length === 0 || input.bytes.length > MAX_BYTES) {
    throw new AppError("Files must be between 1 byte and 10 MB.");
  }

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
    mimeType: input.mimeType || (extension === "pdf" ? "application/pdf" : extension === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain")
  };
}
