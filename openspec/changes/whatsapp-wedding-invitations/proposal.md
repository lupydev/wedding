# Proposal: WhatsApp Wedding Invitations

**Change**: `whatsapp-wedding-invitations` | **Store**: hybrid | **Data layer**: Supabase (per `rules.proposal`)

## Intent

A couple must invite their guests over WhatsApp from their two **personal** numbers, personalized per household, and know afterwards who was messaged and who confirmed. Sending by hand leaves no record. WhatsApp Cloud API is ruled out: registering a personal number to it destroys that number's consumer account.

Success: every invitation is dispatched once by its owning sender, each guest opens a personalized page behind a phone gate, and every RSVP lands in one queryable place.

## Scope

### In Scope
- Guest data model: household-as-invitation, child guests, `seats_allowed`, `owner_sender_id NOT NULL`, import from an untracked source.
- Opaque slug (>=64 bits) at `/i/[slug]`; rotation supported; invalid slug shows a friendly contact page.
- Per-guest Open Graph card (**names only**) via runtime `next/og`, warmed server-side on invitation creation; `htmlLimitedBots: /.*/` and `metadataBase` set.
- Phone gate: last-8-digit match against **any** guest on the invitation, DB-backed rate limiting, unlock cookie, `wa.me`-back recovery to the owning sender.
- RSVP: attendance, per-guest attendance checkboxes capped at `seats_allowed` (server re-validated), optional dietary restrictions, optional message; append-only, latest row wins.
- Console: Supabase Auth magic link, two-email allowlist mapped to `senders.auth_user_id`; guest list partitioned by owning sender; per-device WhatsApp-account declaration; blocking interstitial on disagreement; `wa.me` link build; append-only `dispatch_events` with `actor_sender_id`.
- Console preview, two surfaces: mock WhatsApp bubble rendering the **real canonical** OG endpoint (labelled approximate), and the invitation body via a **separate admin-only route** sharing one component with the public route.
- Scaffold: Next.js App Router + TypeScript, Vitest, Playwright; `strict_tdd: true` and test commands flipped in `openspec/config.yaml` **in this change**.

### Out of Scope
- WhatsApp Cloud API or any programmatic send.
- Guests without WhatsApp (SMS, email, printed QR).
- Resend/nudge flow (`dispatch_events.kind` reserves `resent`).
- Save-the-date wave; per-guest message editing; over-allowance request flow; unassigned/claim queue; third operator UI; separate "plus one" concept; per-platform preview mocks.
- Seating chart, gifts, photo gallery.

## Capabilities

### New Capabilities
- `project-scaffold`: Next.js + TypeScript + Vitest + Playwright baseline, `next.config.ts` metadata guarantees, strict-TDD enablement.
- `invitation-domain`: pure functions — phone normalization/matching, `wa.me` link building, message template rendering, slug generation.
- `guest-directory`: invitations, guests, seats, sender ownership, import.
- `invitation-page`: `/i/[slug]` server render, OG metadata and image, invalid-slug handling.
- `phone-gate`: unlock matching, rate limiting, unlock cookie, recovery path.
- `rsvp`: form, hard cap, append-only responses, deadline behavior.
- `dispatch-console`: operator auth, sender partition, device declaration, dispatch events, previews.

### Modified Capabilities
- None (greenfield; `openspec/specs/` is empty).

## Approach

Hexagonal: vendor-free, React-free domain in `lib/domain/**` first, because those four functions carry the highest risk and everything depends on them. Supabase RLS default-deny with **zero** anon policies; every read and write goes through server-only code (`import 'server-only'` in the DB module), so guest phone numbers never reach the browser. Streaming metadata is disabled outright rather than trusted to User-Agent matching. The public gated route keeps exactly **one** unlock path; `?preview=1` and every other bypass are rejected.

Sequencing: scaffold + `strict_tdd: true` + pure domain -> schema and migrations -> invitation page, OG, gate -> RSVP -> console and previews.

## Assumptions (adopted defaults — the couple may overturn any of these)

| # | Assumption |
|---|---|
| A1 | The phone gate is an unlock only, not RSVP identity. |
| A2 | RSVP is mutable: append-only `rsvp_responses`, latest row wins. |
| A3 | Guests without WhatsApp are out of scope for v1. |
| A4 | Guest-facing copy is Spanish; all code, comments, docs and artifacts are English. |
| A5 | Console access is the two of them only; `senders` stays a table so a third operator needs no migration, but no UI is built. |
| A6 | No separate "plus one" concept; `seats_allowed` covers it. |
| A7 | RSVP deadline is nullable; after it passes the page shows a contact message instead of the form. |
| A8 | Extra RSVP fields are exactly: optional dietary restrictions, optional message to the couple. |
| A9 | The message is template-only; the operator does not edit per guest. |
| A10 | One dispatch wave. |
| A11 | An invalid or rotated slug shows a friendly contact page, not a raw 404. |
| A12 | The mock bubble is one approximation, not per-platform. |
| A13 | Preview is not required before dispatch; OG warming happens server-side on invitation creation. |
| A14 | Both operators see the full guest list, including phone numbers. |
| A15 | Dispatching a guest you do not own is blocked by interstitial and also recorded (`actor_sender_id` vs `owner_sender_id`). |

## Data still needed from the couple

None of these may be invented. Carry as placeholders until supplied:

| Placeholder | Needed for |
|---|---|
| `{{COUPLE_NAMES}}` | OG card, invitation body, message template |
| `{{WEDDING_DATE}}` | Invitation body, RSVP deadline default |
| `{{VENUE_NAME}}`, `{{VENUE_ADDRESS}}` | Invitation body (never the OG card) |
| `{{APPROX_GUEST_COUNT}}` | Capacity sizing, rate-limit tuning, seat totals |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json`, `tsconfig.json`, `next.config.ts` | New | Scaffold; `htmlLimitedBots: /.*/` |
| `vitest.config.mts`, `playwright.config.ts` | New | Unit and E2E harnesses |
| `openspec/config.yaml` | Modified | `strict_tdd: true`, test commands, replace stale Vite guidance |
| `app/layout.tsx` | New | `metadataBase` |
| `app/i/[slug]/page.tsx` + gate client child | New | Server render, `generateMetadata`, gate |
| `app/i/[slug]/opengraph-image.tsx` | New | Per-guest card, names only |
| `app/console/**` | New | Auth, list, dispatch, previews |
| `app/console/preview/[invitationId]/page.tsx` | New | Admin-only body preview |
| `lib/domain/**` | New | `phone.ts`, `wa-link.ts`, `message-template.ts`, `slug.ts` |
| `lib/server/db.ts` | New | `import 'server-only'` |
| `supabase/migrations/**` | New | Schema, RLS default-deny |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Streaming metadata puts OG tags outside `<head>` -> blank card, no error | Med | `htmlLimitedBots: /.*/`; E2E asserting `og:*` in raw `<head>` under a WhatsApp UA |
| OG cold start exceeds WhatsApp's undocumented crawler timeout | Med | Server-side warm of the canonical OG URL on invitation creation; preview re-warms |
| Phone gate locks out a real guest | Med | Last-8 any-guest match; recall over precision; `wa.me` recovery to the owning sender |
| Post-dispatch edits cannot be recalled (cached cards, delivered URLs) | Med | Treat OG as immutable after dispatch; changes require slug rotation and resend |
| Wrong-sender dispatch (unpreventable at protocol level) | Med | Partition by owner, no send affordance for non-owned, device declaration interstitial, record `actor_sender_id` |
| Publishable key exposure | Low | RLS on every table with zero anon policies; browser holds no Supabase client for guest data |
| Real phone numbers leak into the repo | Low | Untracked import source; fabricated fixtures only; never logged |
| Stale `openspec/config.yaml` and `sdd/wedding/testing-capabilities` still say Vite | High | Superseded by the scaffold work unit in this change |
| `strict_tdd: false` until scaffold lands | High | Scaffold is work unit 1; no RED-GREEN claims before it |

## Rollback Plan

- **Before first dispatch**: fully reversible. Revert the branch, delete the Vercel deployment, drop the Supabase schema. Nothing is published.
- **After first dispatch**: delivered `wa.me` messages and their URLs cannot be recalled, and Meta caches previews per URL. Rollback is forward-only — keep `/i/[slug]` serving, rotate slugs and resend for any invitation whose content must change, and restore prior behavior by redeploying the previous Vercel build (data changes revert via migration down-scripts).
- Each work unit is an independently revertable slice; the scaffold slice also reverts `openspec/config.yaml`.

## Dependencies

- Supabase project with new-format keys (`sb_publishable_` / `sb_secret_`); legacy JWT keys deprecated end of 2026.
- Vercel project with `metadataBase` origin and a non-`NEXT_PUBLIC_` secret key env var.
- Two operator email addresses for the auth allowlist.
- Guest list source (untracked CSV or equivalent) with phone numbers.
- The four missing data points above before guest-facing copy can be finalized.

## Success Criteria

- [ ] `npm test` runs and `strict_tdd: true` is set in `openspec/config.yaml`.
- [ ] `normalizePhone`, `matchesInvitation`, `buildWaMeLink`, `renderMessageTemplate` and `generateSlug` are covered at 100% for phone and link building.
- [ ] Fetching `/i/<slug>` with a WhatsApp User-Agent returns `og:title` and `og:image` inside `<head>` of the raw HTML.
- [ ] The OG card renders names containing accented vowels and enye, and contains no date, venue or phone number.
- [ ] A correct last-8 phone for any guest on the invitation unlocks; a wrong one exposes no invitation content and no stored digits in the page source.
- [ ] No query parameter or token bypasses the gate on the public route.
- [ ] The RSVP form never offers more than `seats_allowed` and the server rejects an over-cap submission.
- [ ] Dispatching from a device whose declared WhatsApp account differs from the authenticated operator is blocked by an interstitial.
- [ ] Every dispatch produces a `dispatch_events` row carrying `actor_sender_id`.
- [ ] No real phone number appears anywhere in the repository.
