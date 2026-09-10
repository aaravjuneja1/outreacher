import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/core";
import { requiredEnv } from "@/lib/env";

type Attachment = {
  name: string;
  mimeType: string;
  bytes: Buffer;
};

function appUrl() {
  return requiredEnv("APP_URL").replace(/\/$/, "");
}

function redirectUri() {
  return appUrl() + "/api/gmail/callback";
}

function stateSignature(value: string) {
  return createHmac("sha256", requiredEnv("NEXTAUTH_SECRET")).update(value).digest("base64url");
}

export function createGoogleState(userId: string) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    nonce: randomBytes(18).toString("base64url"),
    exp: Date.now() + 10 * 60 * 1000
  })).toString("base64url");
  return payload + "." + stateSignature(payload);
}

export function readGoogleState(value: string) {
  const [payload, providedSignature] = value.split(".");
  if (!payload || !providedSignature) throw new AppError("Your Gmail connection link expired. Try connecting again.", 400);
  const expectedSignature = stateSignature(payload);
  const left = Buffer.from(providedSignature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new AppError("Your Gmail connection link is invalid. Try connecting again.", 400);
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId: string; exp: number };
    if (!parsed.userId || parsed.exp < Date.now()) throw new Error("Expired state");
    return parsed.userId;
  } catch {
    throw new AppError("Your Gmail connection link expired. Try connecting again.", 400);
  }
}

export function googleConnectUrl(userId: string) {
  const query = new URLSearchParams({
    client_id: requiredEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.send",
    access_type: "offline",
    prompt: "consent",
    state: createGoogleState(userId)
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + query.toString();
}

export async function exchangeGoogleCode(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: requiredEnv("GOOGLE_CLIENT_ID"),
    client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
    redirect_uri: redirectUri(),
    grant_type: "authorization_code"
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) {
    throw new AppError("Google could not finish the Gmail connection. Please try again.", 502);
  }
  const data = await response.json() as { refresh_token?: string };
  if (!data.refresh_token) {
    throw new AppError("Google did not provide a reusable Gmail connection. Disconnect it in Google, then try again.", 422);
  }
  return data.refresh_token;
}

async function googleAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: requiredEnv("GOOGLE_CLIENT_ID"),
    client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new AppError("Your Gmail connection needs to be connected again.", 401);
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new AppError("Your Gmail connection needs to be connected again.", 401);
  return data.access_token;
}

function foldedBase64(value: Buffer) {
  return value.toString("base64").replace(/.{1,76}/g, (line) => line + "\r\n");
}

function encodedHeader(value: string) {
  return "=?UTF-8?B?" + Buffer.from(value, "utf8").toString("base64") + "?=";
}

function textPart(value: string) {
  return value.replaceAll("\r\n", "\n").split("\n").join("\r\n");
}

function buildRawEmail(input: {
  to: string;
  subject: string;
  body: string;
  attachments: Attachment[];
}) {
  const baseHeaders = [
    "To: " + input.to,
    "Subject: " + encodedHeader(input.subject),
    "MIME-Version: 1.0"
  ];

  if (input.attachments.length === 0) {
    return baseHeaders.concat([
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      textPart(input.body)
    ]).join("\r\n");
  }

  const boundary = "coldoutreach-" + randomBytes(12).toString("hex");
  const message = baseHeaders.concat([
    "Content-Type: multipart/mixed; boundary=" + boundary,
    "",
    "--" + boundary,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    textPart(input.body)
  ]);

  for (const attachment of input.attachments) {
    const filename = attachment.name.replaceAll("\r", "").replaceAll("\n", "").replaceAll('"', "").split(" ").join("-");
    message.push(
      "--" + boundary,
      "Content-Type: " + attachment.mimeType + "; name=" + filename,
      "Content-Disposition: attachment; filename=" + filename,
      "Content-Transfer-Encoding: base64",
      "",
      foldedBase64(attachment.bytes)
    );
  }

  message.push("--" + boundary + "--", "");
  return message.join("\r\n");
}

export async function sendWithGmail(input: {
  refreshToken: string;
  to: string;
  subject: string;
  body: string;
  attachments: Attachment[];
}) {
  const accessToken = await googleAccessToken(input.refreshToken);
  const raw = Buffer.from(buildRawEmail(input), "utf8").toString("base64url");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ raw })
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AppError("Gmail did not allow this send. Reconnect Gmail and try again.", 401);
    }
    throw new AppError("Gmail could not send this email. Nothing was marked as sent.", 502);
  }
  const data = await response.json() as { id?: string };
  return data.id || undefined;
}
