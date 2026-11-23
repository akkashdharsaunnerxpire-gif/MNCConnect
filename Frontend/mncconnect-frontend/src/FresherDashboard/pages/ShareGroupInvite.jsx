import { useMemo, useState } from "react";
import { Share2, Copy, Check, Mail, MessageCircle, X, Users } from "lucide-react";

// ⚠️ Un app la friend join page route enna nu check pannu. Ithu mattum maathina pothum.
const joinLink = (code) => `${window.location.origin}/Home/join/${code}`;

export default function ShareGroupInvite({ booking }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const members = booking?.members || [];
  const spotsLeft = Math.max(0, (booking?.maxMembers || 0) - members.length);
  const canShare =
    booking?.mode === "group" &&
    booking?.inviteCode &&
    ["pending", "accepted"].includes(booking?.status) &&
    spotsLeft > 0;

  const link = booking?.inviteCode ? joinLink(booking.inviteCode) : "";
  const hostName =
    members.find((m) => m.id === booking?.hostId)?.name || "Your friend";

  const message = useMemo(
    () =>
      `Hi,\n\n` +
      `I've scheduled a group mentoring session on MNCConnect and would like you to join.\n\n` +
      `Topic: ${booking?.sessionType}\n` +
      `Company: ${booking?.companyName}\n` +
      `Date & Time: ${booking?.date} at ${booking?.time} (IST)\n` +
      `Duration: ${booking?.durationMinutes} minutes\n` +
      `Your share: ₹${booking?.perPersonAmount}\n\n` +
      `Join here: ${link}\n\n` +
      `Spots are limited (${spotsLeft} left), so please join before the session starts.\n\n` +
      `Regards,\n${hostName}`,
    [booking, link, spotsLeft, hostName],
  );

  if (!canShare) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({
        title: "Join my MNCConnect group session",
        text: message,
      });
    } catch {
      /* user cancelled */
    }
  };

  const optionCls =
    "flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
      >
        <Share2 size={14} /> Invite friends ({spotsLeft} spot
        {spotsLeft > 1 ? "s" : ""} left)
      </button>

      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Users size={20} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Invite your friends
                  </h3>
                  <p className="text-xs text-slate-500">
                    {members.length}/{booking.maxMembers} joined · each pays ₹
                    {booking.perPersonAmount}
                  </p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <pre className="mt-4 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              {message}
            </pre>

            <div className="mt-4 space-y-2">
              <a
                className={optionCls}
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              >
                <MessageCircle size={18} className="text-emerald-600" />
                Share on WhatsApp
              </a>
              <a
                className={optionCls}
                href={`mailto:?subject=${encodeURIComponent(
                  "Invitation: Group mentoring session on MNCConnect",
                )}&body=${encodeURIComponent(message)}`}
              >
                <Mail size={18} className="text-blue-600" />
                Share via Email
              </a>
              {navigator.share && (
                <button
                  type="button"
                  onClick={nativeShare}
                  className={`${optionCls} w-full`}
                >
                  <Share2 size={18} className="text-indigo-600" />
                  More apps…
                </button>
              )}
              <button
                type="button"
                onClick={copy}
                className={`${optionCls} w-full`}
              >
                {copied ? (
                  <Check size={18} className="text-emerald-600" />
                ) : (
                  <Copy size={18} className="text-slate-500" />
                )}
                {copied ? "Copied!" : "Copy invitation message"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}