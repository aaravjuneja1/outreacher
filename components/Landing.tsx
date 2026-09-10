"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function Landing() {
  const [seats, setSeats] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/availability", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setSeats(typeof data.seatsRemaining === "number" ? data.seatsRemaining : null))
      .catch(() => setSeats(null));
  }, []);

  return (
    <main className="landing">
      <nav className="site-nav">
        <Link href="/" className="wordmark">Outreacher</Link>
        <div className="nav-actions">
          <Link href="/privacy">Privacy</Link>
          <Link className="button button-quiet" href="/sign-in">Sign in</Link>
        </div>
      </nav>

      <section className="hero">
        <p className="eyebrow">Free for the first 20 accounts only</p>
        <h1>Find a professor worth writing to.<br />Start a meaningful conversation.</h1>
        <p className="hero-copy">
          Outreacher helps you find professors whose work fits your goals, understand why they are a strong match, and send a thoughtful first email in your own voice.
        </p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/sign-up">Start free</Link>
          <span className="seat-note">{seats === null ? "Free for the first 20 accounts only." : seats > 0 ? seats + " of 20 free places remain." : "The first 20 free accounts have been claimed."}</span>
        </div>
        <p className="cost-note">Your first 10 personalised emails are free. Each email has research and AI processing fees that cost the developer money to cover.</p>
      </section>

      <section className="principles" aria-label="How it works">
        <article>
          <span className="principle-number">01</span>
          <h2>Share what matters</h2>
          <p>Choose your field, explain what you hope to do, and add background or supporting documents.</p>
        </article>
        <article>
          <span className="principle-number">02</span>
          <h2>Meet professors who fit</h2>
          <p>Every professor card keeps its source links, recent papers, match reason, and collection date visible.</p>
        </article>
        <article>
          <span className="principle-number">03</span>
          <h2>Make the first message count</h2>
          <p>Emails are editable. Attachments stay off until you select them. Sending needs your Gmail connection and one Live sending choice.</p>
        </article>
      </section>

      <section className="landing-note">
        <p className="eyebrow">Built for meaningful first contact</p>
        <p>There are no made-up response rates, guessed email addresses, or inflated professor information here.</p>
      </section>
    </main>
  );
}
