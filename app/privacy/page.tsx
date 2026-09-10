import Link from "next/link";
import { Footer } from "@/components/Footer";

export default function PrivacyPage() {
  return (
    <>
      <main className="legal-page">
        <nav className="site-nav">
          <Link href="/" className="wordmark">Outreacher</Link>
          <Link href="/sign-up">Get started</Link>
        </nav>
        <article className="legal-copy">
          <p className="eyebrow">Privacy Policy</p>
          <h1>Plain language, first.</h1>
          <p>Outreacher stores only what it needs to provide the app: your account email and hashed password, outreach profile, chosen fields, purpose, uploaded files, professor information, drafts, send history, and basic security events.</p>
          <h2>How your information is used</h2>
          <p>Your selected profile information, purpose, and the text extracted from files marked “Use for email context” are sent to Gemini to create a draft. The Gemini API key stays on the server. Google says free-tier Gemini content may be used to improve its products, so do not upload sensitive, confidential, or personal information that should not be shared with Google.</p>
          <p>Researcher details come from OpenAlex and linked public sources. We keep the sources shown on each card so you can review them yourself.</p>
          <h2>Gmail</h2>
          <p>Gmail uses Google OAuth with the Gmail send-only permission. Outreacher never asks for or stores your Gmail password and does not read your inbox. Your encrypted Gmail refresh token is used only to send an email that you choose to send. Disconnecting Gmail deletes the stored token immediately.</p>
          <h2>Files and control</h2>
          <p>Files are stored privately and are limited to PDF, DOCX, or TXT, up to 10 MB. You can turn off AI context for a file, leave it unattached, delete it, or delete your account. Attachments are never added to an email unless you choose them on that draft.</p>
          <h2>Retention and contact</h2>
          <p>Deleting your account removes your account data, drafts, Gmail connection, and associated database records. We do not sell personal information. For a privacy question, contact the developer through the website linked below.</p>
          <p className="small-note">This is an early personal release. Before any paid public launch, the app will move to suitable commercial hosting and complete the relevant Google OAuth verification.</p>
        </article>
      </main>
      <Footer />
    </>
  );
}
