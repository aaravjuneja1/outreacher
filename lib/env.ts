import { AppError } from "@/lib/core";

export function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new AppError("This part of the app is not configured yet. Please try again later.", 503);
  }
  return value;
}

export function optionalEnv(name: string) {
  return process.env[name]?.trim() || undefined;
}
