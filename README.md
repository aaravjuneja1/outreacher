# Outreacher

Outreacher helps students, researchers, and builders find relevant professors and start meaningful conversations with a thoughtful first email.

## What it does

- Free for the first 20 accounts only.
- Gives each account 10 personalised email drafts with no daily limit.
- Finds professors through OpenAlex and public university sources, then shows the work and match reason behind every suggestion.
- Creates short, editable emails using Gemini on the server. A draft only uses a credit after automated accuracy checks pass.
- Stores PDF, DOCX, and TXT files privately. Each file can be used for email context, attached to a specific email, both, or neither.
- Connects the user's Gmail with the send-only permission. The app never asks for a Gmail password or reads an inbox.
- Requires a one-time Live sending choice before a swipe right sends an email.

## Free launch and costs

Your first 10 personalised emails are free. Each email has research and AI processing fees that cost the developer money to cover. The user pays nothing during the free allowance.

## Before deployment

1. Create a Supabase project with Postgres and a private bucket named outreacher-files.
2. Open the Supabase SQL Editor and run db/schema.sql.
3. Create a Gemini API key.
4. Create a Google OAuth Web Client, enable Gmail API, and add the final Vercel callback URL: https://YOUR-APP.vercel.app/api/gmail/callback.
5. Add the required values from .env.example in Vercel Environment Variables. Keep every value out of Git and chat.
6. Configure Supabase Storage CORS for the final Vercel URL. Files upload directly to private storage through short-lived signed URLs, so the 10 MB limit does not pass through a Vercel Function.

## Local checks

Run npm install, npm run typecheck, npm run build, npm audit --omit=dev, and npm run secret:scan.

Never commit real environment files, OAuth credentials, uploaded documents, database exports, or tokens. Rotate any previously exposed provider key.
