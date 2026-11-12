"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { reportEvent } from "@/lib/operations";
import { useDemo } from "./demo-provider";
import { Notice } from "./primitives";
import { useI18n } from "@/lib/i18n";

export function EventReportForm({ eventId }: { eventId: string }) {
  const { t } = useI18n();
  const { user, update } = useDemo();
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = String(new FormData(form).get("reason"));
    try {
      update((state) => reportEvent(state, eventId, reason));
      setFeedback({ message: t("Your report was sent to the demo moderation queue."), error: false });
      form.reset();
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : t("Could not send the report."), error: true });
    }
  }
  return (
    <details className="event-report">
      <summary>{t("Report this event")}</summary>
      {user ? (
        <form className="stack-form" onSubmit={submit}>
          <label>{t("What should the platform review?")}<textarea name="reason" required minLength={10} maxLength={1000} rows={3} placeholder={t("Describe inaccurate information or another concern.")} /></label>
          <button className="btn btn-secondary">{t("Submit event report")}</button>
          {feedback && <Notice error={feedback.error}>{feedback.message}</Notice>}
        </form>
      ) : <p className="auth-switch"><Link href={`/sign-in?next=${encodeURIComponent(`/events/${eventId}`)}`}>{t("Open a demo profile to report this event")}</Link></p>}
    </details>
  );
}
