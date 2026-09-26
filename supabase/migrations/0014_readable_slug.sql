-- 0014_readable_slug.sql — an invitation's address becomes readable.
--
-- WHY
--
-- `slug` was sixteen base32 characters: `/i/k22eth3lvkzptcco`. That is a link
-- two people send to their families over WhatsApp, and it reads as a mistake.
-- It becomes `/i/familia-guzman-pena`, derived from the household's own name
-- when the invitation is created and frozen from then on. `lib/domain/slug-from-name.ts`
-- holds the derivation and `rotateSlug` remains the way to change an address on
-- purpose.
--
-- NOTHING IS REWRITTEN. Every slug already stored is sixteen characters of
-- [a-z2-7], which the new pattern accepts unchanged — so this is one constraint
-- swap and no data migration. `rotateSlug` also keeps issuing random base32,
-- which is what an address should be once it has had to be changed.
--
-- WHAT THIS COSTS, AND IT IS A REAL COST
--
-- A random slug is unguessable; a name is not. `app/robots.ts` states the
-- model: "an invitation URL is an unlisted capability… the slug is the only
-- thing standing between a stranger and a household's page." An unknown slug
-- renders "we could not find this invitation" while a real one renders the
-- phone gate, so from now on anybody can probe a name and learn WHETHER that
-- family is invited.
--
-- What they still cannot do is read the invitation: that has always required a
-- member's phone number through the gate in `lib/server/gate.ts`, and that has
-- not changed. The couple were shown this trade and chose the readable link.
--
-- THE BOUNDS
--
-- Lowercase letters, digits and single hyphens, never leading or trailing. 1 to
-- 48 characters: long enough for "familia-aristizabal-restrepo-valencia", short
-- enough to survive a paste into a chat without wrapping. The derivation caps
-- at the same 48 and shortens the base rather than the counter, so a fourth
-- household of the same name still produces a legal address.

alter table invitations
  drop constraint if exists invitations_slug_check;

alter table invitations
  add constraint invitations_slug_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 1 and 48);

comment on column invitations.slug is
  'The invitation''s address. Derived from the household name when the '
  'invitation is created and then FROZEN: recomputing it on a rename would '
  'silently kill links already sent. Rotating it is a deliberate act.';
