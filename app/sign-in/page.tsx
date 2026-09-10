import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { Footer } from "@/components/Footer";

export default function SignInPage() {
  return (
    <>
      <main className="auth-page">
        <Link href="/" className="wordmark">Outreacher</Link>
        <AuthForm mode="sign-in" />
      </main>
      <Footer />
    </>
  );
}
