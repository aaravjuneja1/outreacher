import { AppError, safeName } from "@/lib/core";
import { requiredEnv } from "@/lib/env";

const MAX_PRIVATE_FILE_BYTES = 10 * 1024 * 1024;

function storageConfig() {
  const url = requiredEnv("FILE_STORAGE_URL").replace(/\/$/, "");
  return {
    url,
    key: requiredEnv("FILE_STORAGE_SERVICE_KEY"),
    bucket: requiredEnv("FILE_STORAGE_BUCKET")
  };
}

function objectUrl(path: string) {
  const config = storageConfig();
  return config.url + "/storage/v1/object/" + encodeURIComponent(config.bucket) + "/" + path.split("/").map(encodeURIComponent).join("/");
}

function headers(contentType?: string) {
  const config = storageConfig();
  return {
    apikey: config.key,
    Authorization: "Bearer " + config.key,
    ...(contentType ? { "Content-Type": contentType } : {})
  };
}

async function logStorageFailure(operation: string, response: Response) {
  let providerMessage = "";
  try {
    const data = await response.clone().json() as { error?: string; message?: string };
    providerMessage = data.message || data.error || "";
  } catch {
    // Status and operation are enough when the provider does not return JSON.
  }
  console.error("Supabase Storage " + operation + " failed", response.status, providerMessage.slice(0, 240));
}

export async function uploadPrivateFile(userId: string, documentId: string, originalName: string, bytes: Buffer, mimeType: string) {
  const path = safeName(userId) + "/" + safeName(documentId) + "-" + safeName(originalName);
  const response = await fetch(objectUrl(path), {
    method: "POST",
    headers: {
      ...headers(mimeType),
      "x-upsert": "false"
    },
    body: new Uint8Array(bytes)
  });
  if (!response.ok) {
    await logStorageFailure("upload", response);
    throw new AppError("Your file could not be stored privately. Please try again.", 503);
  }
  return path;
}

export function privateStoragePath(userId: string, documentId: string, originalName: string) {
  return safeName(userId) + "/" + safeName(documentId) + "-" + safeName(originalName);
}

export async function createPrivateUploadUrl(path: string) {
  const config = storageConfig();
  const endpoint = config.url + "/storage/v1/object/upload/sign/" + encodeURIComponent(config.bucket) + "/" + path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: headers("application/json"),
    body: "{}"
  });
  if (!response.ok) {
    await logStorageFailure("signed upload URL", response);
    if (response.status === 404) {
      throw new AppError("The private storage bucket is missing. Create the configured bucket in Supabase Storage.", 503);
    }
    if (response.status === 401 || response.status === 403) {
      throw new AppError("Supabase rejected the private storage key. Update the server storage key and try again.", 503);
    }
    throw new AppError("Your private upload link could not be created. Please try again.", 503);
  }
  const data = await response.json() as { url?: string };
  if (!data.url) throw new AppError("Your private upload link could not be created. Please try again.", 503);
  return data.url.startsWith("http") ? data.url : config.url + "/storage/v1" + data.url;
}

export async function downloadPrivateFile(path: string, maxBytes = MAX_PRIVATE_FILE_BYTES) {
  const response = await fetch(objectUrl(path), { headers: headers() });
  if (!response.ok) {
    await logStorageFailure("download", response);
    throw new AppError("An attached file is no longer available.", 422);
  }
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw new AppError("This file is larger than the allowed limit.", 422);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new AppError("This file is larger than the allowed limit.", 422);
  return bytes;
}

export async function removePrivateFile(path: string) {
  const response = await fetch(objectUrl(path), { method: "DELETE", headers: headers() });
  if (!response.ok && response.status !== 404) {
    await logStorageFailure("delete", response);
    throw new AppError("The file could not be deleted right now. Please try again.", 503);
  }
}
