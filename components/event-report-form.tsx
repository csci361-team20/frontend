"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { reportEvent } from "@/lib/operations";
import { useDemo } from "./demo-provider";
import { Notice } from "./primitives";

export function EventReportForm({ eventId }: { eventId: string }) {
  const { user, update } = useDemo();
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = String(new FormData(form).get("reason"));
    try {
      update((state) => reportEvent(state, eventId, reason));
      setFeedback({ message: "Your report was sent to the demo moderation queue.", error: false });
      form.reset();
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "Could not send the report.", error: true });
    }
  }
  return (
    <details className="event-report">
      <summary>Report this event</summary>
      {user ? (
        <form className="stack-form" onSubmit={submit}>
          <label>What should the platform review?<textarea name="reason" required minLength={10} maxLength={1000} rows={3} placeholder="Describe inaccurate information or another concern." /></label>
          <button className="btn btn-secondary">Submit event report</button>
          {feedback && <Notice error={feedback.error}>{feedback.message}</Notice>}
        </form>
      ) : <p className="auth-switch"><Link href={`/sign-in?next=${encodeURIComponent(`/events/${eventId}`)}`}>Open a demo profile to report this event</Link></p>}
    </details>
  );
}
