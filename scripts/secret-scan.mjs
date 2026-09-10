import { execFileSync } from "node:child_process";
import fs from "node:fs";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8"
}).split("\n").filter(Boolean);

const patterns = [
  { name: "Google API key", expression: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "Hugging Face token", expression: /hf_[A-Za-z0-9]{20,}/ },
  { name: "OpenAI-style secret", expression: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: "Supabase secret key", expression: /sb_secret_[A-Za-z0-9_-]{20,}/ },
  { name: "GitHub personal access token", expression: /(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,})/ },
  { name: "private key block", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "filled environment secret", expression: /(?:GEMINI_API_KEY|GOOGLE_CLIENT_SECRET|TOKEN_ENCRYPTION_KEY|NEXTAUTH_SECRET|DATABASE_URL|FILE_STORAGE_SERVICE_KEY)[ \t]*=[ \t]*(?![ \t]*(?:\r?\n|$))[^\s]+/m },
  { name: "database connection string", expression: /postgres(?:ql)?:\/\/[^\s'"`]+:[^\s'"`]+@/i }
];

const findings = [];
for (const file of files) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
  const content = fs.readFileSync(file, "utf8");
  for (const pattern of patterns) {
    if (pattern.expression.test(content)) findings.push(file + ": " + pattern.name);
  }
}

const history = execFileSync("git", ["log", "--all", "--format=", "--no-ext-diff", "-p"], { encoding: "utf8" });
for (const pattern of patterns) {
  if (pattern.expression.test(history)) findings.push("Git history: " + pattern.name);
}

if (findings.length) {
  console.error("Potential secrets found in commit candidates:");
  for (const finding of findings) console.error("- " + finding);
  process.exit(1);
}

console.info("Secret scan passed for " + files.length + " commit candidates.");
