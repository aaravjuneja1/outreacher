"use client";

import { FormEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { DISCIPLINE_GROUPS } from "@/lib/disciplines";

type DocumentItem = {
  id: string;
  name: string;
  mimeType: string;
  byteSize: number;
  useForContext: boolean;
};

type Work = {
  title: string;
  date: string;
  url: string;
  citedBy: number;
};

type Draft = {
  id: string;
  subject: string;
  body: string;
  attachmentDocumentIds: string[];
  validationNotes: string[];
  prospect: {
    id: string;
    fullName: string;
    role: string | null;
    institution: string;
    publicEmail: string | null;
    emailVerified: boolean;
    emailSourceUrl: string | null;
    openAlexAuthorUrl: string;
    officialProfileUrl: string | null;
    sourceUrls: string[];
    works: Work[];
    researchSummary: string;
    whyMatch: string;
    collectedAt: string;
  };
};

type AppData = {
  email: string;
  profile: {
    fullName: string;
    institution: string;
    currentRole: string;
    disciplines: string[];
    specialisation: string;
    purpose: string;
    background: string;
    links: string[];
    liveSending: boolean;
    onboardingComplete: boolean;
  };
  documents: DocumentItem[];
  usage: { used: number; remaining: number };
  gmail: { connected: boolean; accountEmail: string | null };
  drafts: Draft[];
  latestResearch: {
    profiles_checked: number;
    papers_reviewed: number;
    candidates_found: number;
    status: string;
    stage: string;
  } | null;
  sentCount: number;
};

async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    cache: "no-store",
    ...options,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Please try again.");
  return data;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function ProfileEditor({ profile, onSaved, showMessage }: {
  profile: AppData["profile"];
  onSaved: () => Promise<void>;
  showMessage: (message: string) => void;
}) {
  const [form, setForm] = useState(profile);
  const [linksText, setLinksText] = useState(profile.links.join("\n"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(profile);
    setLinksText(profile.links.join("\n"));
  }, [profile]);

  function toggleDiscipline(value: string) {
    setForm((current) => ({
      ...current,
      disciplines: current.disciplines.includes(value)
        ? current.disciplines.filter((discipline) => discipline !== value)
        : current.disciplines.length < 5
          ? [...current.disciplines, value]
          : current.disciplines
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          links: linksText.split("\n").map((link) => link.trim()).filter(Boolean)
        })
      });
      await onSaved();
      showMessage("Your professor matching profile is saved.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel profile-panel" aria-labelledby="profile-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">01 · Your direction</p>
          <h2 id="profile-heading">Give professor matching a clear brief.</h2>
        </div>
        {profile.onboardingComplete && <span className="status-mark">Saved</span>}
      </div>
      <form onSubmit={submit} className="form-grid">
        <label>
          Your name
          <input value={form.fullName} maxLength={100} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
        </label>
        <label>
          Your institution
          <input value={form.institution} maxLength={180} onChange={(event) => setForm({ ...form, institution: event.target.value })} required />
        </label>
        <label>
          Your role
          <input placeholder="For example, undergraduate researcher" value={form.currentRole} maxLength={180} onChange={(event) => setForm({ ...form, currentRole: event.target.value })} required />
        </label>
        <label>
          Niche specialisation
          <input placeholder="For example, causal inference in health policy" value={form.specialisation} maxLength={300} onChange={(event) => setForm({ ...form, specialisation: event.target.value })} required />
        </label>
        <fieldset className="discipline-field">
          <legend>Fields, up to five</legend>
          <p className="field-help">Choose the disciplines that should guide the shortlist.</p>
          <div className="discipline-groups">
            {DISCIPLINE_GROUPS.map((group) => (
              <div className="discipline-group" key={group.label}>
                <span>{group.label}</span>
                <div className="chip-list">
                  {group.options.map((option) => (
                    <label className="chip-check" key={option}>
                      <input type="checkbox" checked={form.disciplines.includes(option)} onChange={() => toggleDiscipline(option)} />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
        <label className="wide-label">
          What are you hoping to do?
          <textarea rows={6} minLength={30} maxLength={2500} value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} required />
          <span className="field-help">The more in depth you explain your purpose, the better the results.</span>
        </label>
        <label className="wide-label">
          Background that helps the email sound like you
          <textarea rows={5} minLength={20} maxLength={5000} value={form.background} onChange={(event) => setForm({ ...form, background: event.target.value })} required />
        </label>
        <label className="wide-label">
          Optional links, one per line
          <textarea rows={3} maxLength={2500} placeholder="https://your-portfolio.example" value={linksText} onChange={(event) => setLinksText(event.target.value)} />
        </label>
        <div className="form-actions wide-label">
          <button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving" : "Save outreach profile"}</button>
          <span className="field-help">{form.disciplines.length}/5 fields selected</span>
        </div>
      </form>
    </section>
  );
}

function DocumentPanel({ documents, onRefresh, showMessage }: {
  documents: DocumentItem[];
  onRefresh: () => Promise<void>;
  showMessage: (message: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement | null;
    if (!input?.files?.[0]) return;
    setUploading(true);
    try {
      const file = input.files[0];
      const upload = await api("/api/documents/presign", {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type,
          byteSize: file.size,
          useForContext: true
        })
      });
      const storageResponse = await fetch(upload.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file
      });
      if (!storageResponse.ok) throw new Error("Your private upload did not finish. Please try again.");
      await api("/api/documents/finalize", {
        method: "POST",
        body: JSON.stringify({ documentId: upload.documentId })
      });
      form.reset();
      await onRefresh();
      showMessage("Your file is private and ready for email context.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function setContext(document: DocumentItem, useForContext: boolean) {
    try {
      await api("/api/documents/" + document.id, { method: "PATCH", body: JSON.stringify({ useForContext }) });
      await onRefresh();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function remove(document: DocumentItem) {
    if (!window.confirm("Delete " + document.name + "? This cannot be undone.")) return;
    try {
      await api("/api/documents/" + document.id, { method: "DELETE" });
      await onRefresh();
      showMessage("The file was deleted.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Please try again.");
    }
  }

  return (
    <section className="panel" aria-labelledby="files-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">02 · Supporting files</p>
          <h2 id="files-heading">Useful context, under your control.</h2>
        </div>
      </div>
      <p className="muted">Upload PDF, DOCX, or TXT files up to 10 MB. The app reads up to 12,000 characters total from files marked for context. Attachments remain off until you select them on an email.</p>
      <form className="upload-row" onSubmit={upload}>
        <input name="file" type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
        <button className="button button-quiet" type="submit" disabled={uploading}>{uploading ? "Uploading" : "Add file"}</button>
      </form>
      <div className="document-list">
        {documents.length === 0 && <p className="empty-note">No files added. You can still find professors and draft without one.</p>}
        {documents.map((document) => (
          <article className="document-row" key={document.id}>
            <div>
              <strong>{document.name}</strong>
              <span>{formatBytes(document.byteSize)}</span>
            </div>
            <label className="toggle-label">
              <input type="checkbox" checked={document.useForContext} onChange={(event) => setContext(document, event.target.checked)} />
              <span>Use for email context</span>
            </label>
            <button className="text-button" onClick={() => remove(document)} type="button">Delete</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResearchPanel({ data, onResearch, researching }: {
  data: AppData;
  onResearch: () => Promise<void>;
  researching: boolean;
}) {
  const [stage, setStage] = useState(0);
  const stages = ["Finding relevant professors", "Reading recent work", "Checking university profiles", "Preparing your matches"];

  useEffect(() => {
    if (!researching) {
      setStage(0);
      return;
    }
    const timer = window.setInterval(() => setStage((current) => Math.min(current + 1, stages.length - 1)), 1800);
    return () => window.clearInterval(timer);
  }, [researching]);

  return (
    <section className="panel research-panel" aria-labelledby="research-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">03 · Find professors</p>
          <h2 id="research-heading">Meet professors whose work fits your goal.</h2>
        </div>
        {data.latestResearch?.status === "complete" && <span className="status-mark">Last search complete</span>}
      </div>
      {researching ? (
        <div className="research-progress" aria-live="polite">
          {stages.map((item, index) => <p className={index <= stage ? "active-stage" : ""} key={item}><span>{index + 1}</span>{item}</p>)}
          <small>Only actual matching totals will be shown when this search finishes.</small>
        </div>
      ) : (
        <>
          <p className="muted">The first pass checks a maximum of 12 professors. Weak matches, unnamed institutions, and people without enough relevant work are left out.</p>
          <button className="button button-primary" type="button" disabled={!data.profile.onboardingComplete} onClick={() => void onResearch()}>
            {data.profile.onboardingComplete ? "Find professors" : "Save your outreach profile first"}
          </button>
          {data.latestResearch?.status === "complete" && (
            <div className="real-counts" aria-label="Latest verified professor matching counts">
              <span>{data.latestResearch.profiles_checked} profiles checked</span>
              <span>{data.latestResearch.papers_reviewed} papers reviewed</span>
              <span>{data.latestResearch.candidates_found} strong candidates found</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function DraftCard({ draft, documents, gmail, liveSending, onRefresh, onNeedMore, showMessage }: {
  draft: Draft;
  documents: DocumentItem[];
  gmail: AppData["gmail"];
  liveSending: boolean;
  onRefresh: () => Promise<void>;
  onNeedMore: () => void;
  showMessage: (message: string) => void;
}) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [email, setEmail] = useState(draft.prospect.publicEmail || "");
  const [sourceUrl, setSourceUrl] = useState(draft.prospect.emailSourceUrl || "");
  const [attachments, setAttachments] = useState<string[]>(draft.attachmentDocumentIds);
  const [working, setWorking] = useState(false);
  const pointerStart = useRef<number | null>(null);

  useEffect(() => {
    setSubject(draft.subject);
    setBody(draft.body);
    setEmail(draft.prospect.publicEmail || "");
    setSourceUrl(draft.prospect.emailSourceUrl || "");
    setAttachments(draft.attachmentDocumentIds);
  }, [draft]);

  async function save() {
    setWorking(true);
    try {
      await api("/api/drafts/" + draft.id, {
        method: "PATCH",
        body: JSON.stringify({
          subject,
          body,
          recipientEmail: email,
          emailSourceUrl: sourceUrl,
          attachmentDocumentIds: attachments
        })
      });
      await onRefresh();
      showMessage("Your draft changes are saved.");
      return true;
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Please try again.");
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function skip() {
    setWorking(true);
    try {
      await api("/api/drafts/" + draft.id + "/skip", { method: "POST" });
      await onRefresh();
      onNeedMore();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setWorking(false);
    }
  }

  async function send() {
    setWorking(true);
    try {
      const saved = await save();
      if (!saved) return;
      await api("/api/drafts/" + draft.id + "/send", { method: "POST" });
      await onRefresh();
      onNeedMore();
      showMessage("Email sent through your connected Gmail account.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setWorking(false);
    }
  }

  function pointerDown(event: PointerEvent<HTMLElement>) {
    pointerStart.current = event.clientX;
  }

  function pointerUp(event: PointerEvent<HTMLElement>) {
    if (pointerStart.current === null || working) return;
    const movement = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (movement > 110) void send();
    if (movement < -110) void skip();
  }

  function setAttachment(documentId: string, checked: boolean) {
    setAttachments((current) => checked ? [...current, documentId] : current.filter((id) => id !== documentId));
  }

  return (
    <article className="swipe-card" onPointerDown={pointerDown} onPointerUp={pointerUp} aria-label={"Draft for " + draft.prospect.fullName}>
      <div className="card-topline">
        <span>Candidate card</span>
        <span>Collected {new Date(draft.prospect.collectedAt).toLocaleDateString()}</span>
      </div>
      <header className="candidate-heading">
        <div>
          <h3>{draft.prospect.fullName}</h3>
          <p>{draft.prospect.role || "Academic researcher"} · {draft.prospect.institution}</p>
        </div>
        <a className="source-link" href={draft.prospect.openAlexAuthorUrl} target="_blank" rel="noreferrer">OpenAlex record</a>
      </header>
      <p className="match-note"><strong>Why this is a match:</strong> {draft.prospect.whyMatch}</p>
      <div className="work-list">
        <h4>Relevant work</h4>
        <ul>
          {draft.prospect.works.slice(0, 5).map((work) => <li key={work.url}><a href={work.url} target="_blank" rel="noreferrer">{work.title}</a><span>{work.date}</span></li>)}
        </ul>
      </div>
      <div className="source-row">
        {draft.prospect.officialProfileUrl && <a href={draft.prospect.officialProfileUrl} target="_blank" rel="noreferrer">University site</a>}
        {draft.prospect.sourceUrls.slice(0, 3).map((url) => <a href={url} target="_blank" rel="noreferrer" key={url}>Source</a>)}
      </div>

      <div className="contact-grid">
        <label>
          Public email
          <input type="email" placeholder="Paste an email from an official page" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Official source page
          <input type="url" placeholder="https://university.example/profile" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
        </label>
      </div>
      <p className="field-help">This app never guesses addresses. Save both fields after copying a public email from its official source.</p>

      <div className="editor-area">
        <label>
          Subject
          <input value={subject} maxLength={120} onChange={(event) => setSubject(event.target.value)} />
        </label>
        <label>
          Email
          <textarea rows={10} value={body} maxLength={6000} onChange={(event) => setBody(event.target.value)} />
        </label>
      </div>

      <section className="attachment-area" aria-label="Attachments">
        <div className="attachment-heading">
          <h4>Attachments</h4>
          <span>Off by default</span>
        </div>
        {documents.length === 0 && <p className="empty-note">No private files available to attach.</p>}
        {documents.map((document) => (
          <div className="attachment-row" key={document.id}>
            <label className="check-row">
              <input type="checkbox" checked={attachments.includes(document.id)} onChange={(event) => setAttachment(document.id, event.target.checked)} />
              <span>Attach {document.name}</span>
            </label>
            {attachments.includes(document.id) && <button className="text-button" type="button" onClick={() => setAttachment(document.id, false)}>Remove attachment</button>}
          </div>
        ))}
      </section>

      {!gmail.connected && <p className="send-warning">Connect Gmail to enable sending. This app only requests permission to send, never to read your inbox.</p>}
      {gmail.connected && !liveSending && <p className="send-warning">Turn on Live sending once before a right swipe can send an email immediately.</p>}
      <div className="card-actions">
        <button className="button button-quiet" type="button" onClick={() => void skip()} disabled={working}>Skip</button>
        <button className="button button-quiet" type="button" onClick={() => void save()} disabled={working}>Save edits</button>
        <button className="button button-send" type="button" onClick={() => void send()} disabled={working || !gmail.connected || !liveSending}>Send</button>
      </div>
      <p className="swipe-hint">Swipe left to skip. Swipe right to send after Live sending is on.</p>
    </article>
  );
}

function GmailPanel({ data, onRefresh, showMessage }: {
  data: AppData;
  onRefresh: () => Promise<void>;
  showMessage: (message: string) => void;
}) {
  async function setLiveSending() {
    if (!window.confirm("Right swipe sends an email immediately. Turn on Live sending?")) return;
    try {
      await api("/api/profile/live-sending", {
        method: "POST",
        body: JSON.stringify({ enabled: true, acknowledgement: true })
      });
      await onRefresh();
      showMessage("Live sending is on. Right swipe now sends immediately.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Gmail? This deletes the stored connection and turns off Live sending.")) return;
    try {
      await api("/api/gmail/disconnect", { method: "POST" });
      await onRefresh();
      showMessage("Gmail was disconnected and its stored token was deleted.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Please try again.");
    }
  }

  return (
    <section className="panel gmail-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Sending control</p>
          <h2>Gmail stays in your hands.</h2>
        </div>
        <span className={data.gmail.connected ? "status-mark" : "status-muted"}>{data.gmail.connected ? "Connected" : "Not connected"}</span>
      </div>
      {!data.gmail.connected ? (
        <>
          <p className="muted">Google will ask only for permission to send emails on your behalf. It cannot read your inbox and never receives your password.</p>
          <a className="button button-quiet" href="/api/gmail/connect">Connect Gmail</a>
        </>
      ) : data.profile.liveSending ? (
        <>
          <p className="muted">Live sending is on. A right swipe or Send button immediately sends the final saved draft through Gmail.</p>
          <button className="text-button" type="button" onClick={() => void disconnect()}>Disconnect Gmail</button>
        </>
      ) : (
        <>
          <p className="send-warning"><strong>Right swipe sends an email immediately.</strong> Turn on Live sending once when you are ready. You will not see repetitive confirmations after that.</p>
          <div className="button-row">
            <button className="button button-send" type="button" onClick={() => void setLiveSending()}>Turn on Live sending</button>
            <button className="text-button" type="button" onClick={() => void disconnect()}>Disconnect Gmail</button>
          </div>
        </>
      )}
    </section>
  );
}

export function DashboardClient() {
  const [data, setData] = useState<AppData | null>(null);
  const [message, setMessage] = useState("");
  const [researching, setResearching] = useState(false);
  const fillRunning = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await api("/api/me");
      setData(next as AppData);
    } catch (error) {
      if (error instanceof Error && error.message.includes("sign in")) {
        window.location.assign("/sign-in");
        return;
      }
      setMessage(error instanceof Error ? error.message : "Please refresh the page.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") setMessage("Gmail is connected. Turn on Live sending once when you are ready.");
    if (params.get("gmail") === "not-connected") setMessage("Gmail was not connected. You can try again whenever you are ready.");
  }, [refresh]);

  const fillQueue = useCallback(async () => {
    if (fillRunning.current) return;
    fillRunning.current = true;
    try {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const result = await api("/api/queue/fill", { method: "POST" });
        if (!result.generated) break;
        await refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Drafting paused. Your unused credits are safe.");
    } finally {
      fillRunning.current = false;
    }
  }, [refresh]);

  async function startResearch() {
    setResearching(true);
    setMessage("");
    try {
      const result = await api("/api/research", { method: "POST" });
      await refresh();
      setMessage(result.candidatesFound + " strong candidates were found. Preparing personalised drafts now.");
      void fillQueue();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Professor matching could not start.");
    } finally {
      setResearching(false);
    }
  }

  async function signOut() {
    try {
      await api("/api/auth/sign-out", { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  }

  async function deleteAccount() {
    if (!window.confirm("Delete your account, files, drafts, and Gmail connection? This cannot be undone.")) return;
    try {
      await api("/api/account", { method: "DELETE" });
      window.location.assign("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Please try again.");
    }
  }

  if (!data) {
    return <main className="app-shell"><div className="loading-page">Loading your private workspace.</div></main>;
  }

  const card = data.drafts[0];
  const exhausted = data.usage.remaining === 0;

  return (
    <main className="app-shell">
      <header className="app-header">
        <a href="/" className="wordmark">Outreacher</a>
        <div className="account-nav">
          <span>{data.email}</span>
          <button className="text-button" onClick={() => void signOut()} type="button">Sign out</button>
        </div>
      </header>

      {message && <div className="notice" role="status"><span>{message}</span><button className="text-button" type="button" onClick={() => setMessage("")}>Dismiss</button></div>}

      <section className="usage-strip" aria-label="Draft usage">
        <div>
          <p className="eyebrow">Free launch allowance</p>
          <strong>{data.usage.remaining} of 10 drafts remaining</strong>
        </div>
        <p>Free for the first 20 accounts only. Your first 10 personalised emails are free. Each email has research and AI processing fees that cost the developer money to cover.</p>
      </section>

      <div className="workspace-grid">
        <div className="setup-column">
          <ProfileEditor profile={data.profile} onSaved={refresh} showMessage={setMessage} />
          <DocumentPanel documents={data.documents} onRefresh={refresh} showMessage={setMessage} />
          <ResearchPanel data={data} onResearch={startResearch} researching={researching} />
          <GmailPanel data={data} onRefresh={refresh} showMessage={setMessage} />
        </div>

        <aside className="queue-column" aria-labelledby="queue-heading">
          <div className="queue-heading">
            <div>
              <p className="eyebrow">Your review queue</p>
              <h2 id="queue-heading">Read before you reach out.</h2>
            </div>
            <span>{data.drafts.length} ready</span>
          </div>
          {exhausted ? (
            <section className="limit-card">
              <p className="eyebrow">Free allowance used</p>
              <h3>Thank you for testing this.</h3>
              <p>You have used your 10 free personalised emails. Each email has research and AI processing fees that cost the developer money to run. I am working on paid plans, stronger professor matching, more advanced personalisation, and better outreach tools.</p>
            </section>
          ) : card ? (
            <DraftCard draft={card} documents={data.documents} gmail={data.gmail} liveSending={data.profile.liveSending} onRefresh={refresh} onNeedMore={() => void fillQueue()} showMessage={setMessage} />
          ) : (
            <section className="empty-queue">
              <p className="eyebrow">Nothing ready yet</p>
              <h3>Start with your outreach profile.</h3>
              <p>Once Outreacher finds a strong professor match, a checked, editable draft will appear here. No credit is used if the AI request or its checks fail.</p>
              {data.latestResearch?.status === "complete" && <button className="button button-quiet" type="button" onClick={() => void fillQueue()}>Continue preparing drafts</button>}
            </section>
          )}
          {data.sentCount > 0 && <p className="sent-summary">{data.sentCount} email{data.sentCount === 1 ? "" : "s"} sent through your own Gmail connection.</p>}
        </aside>
      </div>

      <section className="account-danger">
        <p>Need to leave?</p>
        <button className="text-button" onClick={() => void deleteAccount()} type="button">Delete my account and stored data</button>
      </section>
    </main>
  );
}
