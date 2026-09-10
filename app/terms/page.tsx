import Link from "next/link";
import { Footer } from "@/components/Footer";

export default function TermsPage() {
  return (
    <>
      <main className="legal-page">
        <nav className="site-nav">
          <Link href="/" className="wordmark">Outreacher</Link>
          <Link href="/sign-up">Get started</Link>
        </nav>
        <article className="legal-copy">
          <p className="eyebrow">Terms of Service</p>
          <h1>Use Outreacher thoughtfully.</h1>
          <p>Outreacher helps you discover relevant professors and prepare a first outreach email. It does not guarantee a reply, meeting, opportunity, or any outcome from an email.</p>
          <h2>Your account and content</h2>
          <p>Keep your account secure and provide accurate information. You are responsible for the purpose, profile details, and files you add, and for checking every email before you send it. Do not upload confidential material that you do not have permission to share.</p>
          <h2>Sending email</h2>
          <p>Outreacher sends an email only when you connect your own Gmail account, enable Live sending, and choose Send or swipe right. You must use the service lawfully, respectfully, and without spam, harassment, impersonation, or misleading claims.</p>
          <h2>Research and drafts</h2>
          <p>Professor details are collected from public sources and drafts are generated from the information you provide and the sources shown on each card. Review sources, names, institutions, attachments, subject lines, and email text before sending. We may limit or remove a draft that is unsafe, inaccurate, or unsuitable for outreach.</p>
          <h2>Free access</h2>
          <p>The first 20 accounts can use the service and each account can save up to 10 personalised email drafts. These drafts have research and AI processing fees that cost the developer money to cover. Future features or plans may be offered differently.</p>
          <h2>Changes and contact</h2>
          <p>We may update the service or these terms as the app develops. If you do not agree with a change, stop using the service and delete your account. For a question about these terms, contact the developer through the website linked below.</p>
        </article>
      </main>
      <Footer />
    </>
  );
}
