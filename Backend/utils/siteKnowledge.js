// Backend/utils/siteKnowledge.js
// Edit this file whenever the site changes. The AI answers ONLY from this text.
const SITE_KNOWLEDGE = `
ABOUT MNCConnect
MNCConnect lets freshers book paid mentoring sessions with employees (mentors) working in MNC companies
(interview prep, career guidance, resume doubts, etc.).

HOW A FRESHER BOOKS A SESSION
1. Go to Home and browse companies, pick a company.
2. Choose a session type, date and time slot, duration, and write a short reason.
3. Pay the session amount (Razorpay). The amount is held until the session is done.
4. The request goes to employees of that company. When one accepts, the booking becomes "Confirmed".
5. If nobody accepts before the auto-cancel time shown on the booking card, the request expires
   and the money is refunded to the fresher's wallet automatically.
6. A fresher can also book a specific mentor directly ("Book again" on a past session keeps the same mentor).

JOINING THE SESSION
- Go to My Bookings > Upcoming. The meeting room opens a few minutes before the start time
  (the card shows "Room opens in mm:ss"). Then click "Join meeting".
- A live timer shows the time left. A warning appears in the final 5 minutes.
- If you leave, use "Rejoin meeting" while the timer is still running.

CHAT
- After an employee accepts, a "Message" button appears on the booking so the fresher and mentor can chat.

GROUP SESSIONS
- The person who books is the host. The host gets an invite link ("Copy invite link") and can share it
  with friends. Friends join with the link. Each person pays their own share (shown as "/ person").
- Only the host writes the review. Group chat is shared with the group.

AFTER THE SESSION
- Host / single bookings must write a review ("Review required" -> "Write review").
- Completed sessions appear in My Bookings > Past.

MISSED / CANCELLED / EXPIRED / DISPUTED
- Money is refunded (to wallet for expired/disputed). Status shows "Refunded".
- Missed or cancelled bookings can be rebooked within 24 hours, after that they are removed automatically.

BOOKING STATUS MEANINGS
Pending = waiting for an employee | Confirmed = accepted, room not open yet | Meeting open / In progress |
Meeting ended = confirming | Review required | Completed | Refunded.

FOR MENTORS (employees)
- Mentors receive booking requests live, can accept them, join the meeting room at the session time,
  chat with the fresher, and earn into their wallet. (TODO: add withdrawal steps, mentor verification, payout timing.)

TODO (fill these in): pricing per session type, wallet top-up steps, how to become a mentor,
support email/phone, detailed cancellation policy.
`;

module.exports = { SITE_KNOWLEDGE };