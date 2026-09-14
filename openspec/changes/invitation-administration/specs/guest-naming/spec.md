# Guest Naming Specification

## Purpose

Pure, vendor-free, React-free Spanish name-joining and greeting-name derivation:
the `y`/`e` conjunction rule, the solo-versus-list-member name fallback, and the
resolution between a derived and a custom group name. This is a new capability;
it has no baseline to supersede.

## Requirements

### Requirement: Spanish list joining with the diphthong/hiatus conjunction rule

The system MUST join a list of names into a single Spanish-language phrase using
`,` between all but the last two items and the conjunction `y` or `e` between
the last two, with NO Oxford comma. Spanish does not take a serial comma before
the final conjunction, and this MUST be enforced rather than left to a
contributor's instinct, because an English-speaking contributor reflexively adds
one.

The conjunction before the final item MUST be `e` when that item's first sound
is the vowel /i/ — spelled `i-`, `í-`, `hi-`, or `hí-` — AND that `i` sound forms
a HIATUS with the following letter (a consonant, or nothing: the name ends
there). The conjunction MUST remain `y` whenever that same `i` sound instead
forms a DIPHTHONG with a following vowel, and for every name that does not begin
with the /i/ sound at all, including a `y-` initial name, which begins with the
consonant sound /ʝ/, not /i/.

The discriminator is diphthong versus hiatus, never the surface spelling `hi-`
versus `hie-`. *Hierro* and *hielo* are the SAME case — both begin `hie-`, both
are diphthongs, and both take `y`. The correct hiatus/diphthong contrast pair is
*hija* (hiatus → `e hija`) against *hielo* (diphthong → `y hielo`).

Before testing a name's first sound, the system MUST normalize it to Unicode NFC
and trim leading/trailing whitespace, because a mobile keyboard and a contact
paste can produce NFD-decomposed accented characters that a plain character
comparison would miss.

This function only ever joins proper nouns inside a phrase. It MUST NOT
implement the disjunctive `o → u` rule and MUST NOT implement the
sentence-initial interrogative exception, because this function never produces
a disjunction and is never used at the start of a question.

#### Scenario: Ordinary consonant start takes y

- GIVEN the two-item list `["Lucho", "Luzma"]`
- WHEN the list is joined
- THEN the result MUST be `"Lucho y Luzma"`

#### Scenario: A vowel that is not /i/ takes y

- GIVEN the two-item list `["Lucho", "Ana"]`
- WHEN the list is joined
- THEN the result MUST be `"Lucho y Ana"`

#### Scenario: The hiatus /i/ nucleus takes e

- GIVEN the two-item list `["Lucho", "Inés"]`
- WHEN the list is joined
- THEN the result MUST be `"Lucho e Inés"`, which a naive `" y "` join would fail to produce

#### Scenario: A silent h before the hiatus i still takes e

- GIVEN the two-item list `["Lucho", "Hilda"]`
- WHEN the list is joined
- THEN the result MUST be `"Lucho e Hilda"`, because the silent `h` does not change that `i` is the nucleus

#### Scenario: An accented Í hiatus still takes e

- GIVEN the two-item list `["Lucho", "Íñigo"]`
- WHEN the list is joined
- THEN the result MUST be `"Lucho e Íñigo"`; a comparison against the bare literal `"i"` MUST NOT be relied upon, since it fails on the accented form

#### Scenario: The diphthong hie- takes y, the same as hielo

- GIVEN the two-item list `["Lucho", "Hierro"]`
- WHEN the list is joined
- THEN the result MUST be `"Lucho y Hierro"`, because `hie-` is a diphthong — the identical case to `"frío y hielo"` — never `e Hierro`

#### Scenario: An i followed by a vowel is a diphthong and takes y

- GIVEN the two-item list `["Lucho", "Ian"]`
- WHEN the list is joined
- THEN the result MUST be `"Lucho y Ian"`, because `i` followed by the vowel `a` is a diphthong, not a hiatus, even though the name starts with `i`

#### Scenario: An initial y-sound is not the vowel /i/

- GIVEN the two-item list `["Lucho", "Yolanda"]`
- WHEN the list is joined
- THEN the result MUST be `"Lucho y Yolanda"`, because `Yolanda` begins with the consonant sound /ʝ/, never the vowel /i/, and a rule keyed on the letters "y or i" would wrongly emit `e`

#### Scenario: Case-insensitive matching in both directions

- GIVEN the two-item list `["Lucho", "ÍÑIGO"]` and separately `["Lucho", "íñigo"]`
- WHEN each list is joined
- THEN both results MUST use `e`, matching the mixed-case form

#### Scenario: NFD-decomposed input is normalized before testing

- GIVEN a second name equal to `"Íñigo"` encoded as NFD (a base `I` codepoint followed by a combining acute accent, as a mobile keyboard or a Contacts paste may produce)
- WHEN the list is joined
- THEN the result MUST still be `"Lucho e Íñigo"`, identical to the NFC-encoded input

#### Scenario: Leading whitespace from a paste does not change the result

- GIVEN a second name equal to `"  Inés"` with leading whitespace
- WHEN the list is joined
- THEN the result MUST be `"Lucho e Inés"`, with the whitespace trimmed before the sound test and absent from the output

#### Scenario: No Oxford comma before the final conjunction

- GIVEN the four-item list `["Lucho", "Luzma", "Fer", "Ana"]`
- WHEN the list is joined
- THEN the result MUST be `"Lucho, Luzma, Fer y Ana"`, with no comma immediately before `y Ana`

#### Scenario: Arity of one returns the bare name

- GIVEN the one-item list `["Lucho"]`
- WHEN the list is joined
- THEN the result MUST be `"Lucho"`, with no conjunction

#### Scenario: Arity of three uses one comma and one conjunction

- GIVEN the three-item list `["Lucho", "Luzma", "Fer"]`
- WHEN the list is joined
- THEN the result MUST be `"Lucho, Luzma y Fer"`

#### Scenario: An empty list throws

- GIVEN an empty list
- WHEN the join function is called
- THEN it MUST throw rather than return an empty string or a placeholder

### Requirement: Solo address and list-member naming are distinct fallbacks

A guest addressed ALONE (a solo invitation, or a direct salutation) MUST resolve
to their nickname if one is set, otherwise their full name. A guest named as ONE
MEMBER of a joined list MUST resolve to their nickname if one is set, otherwise
their FIRST name only, never their full name. These are two different fallbacks
over the same two stored fields (`nickname`, `full_name`), and MUST be
implemented as two distinct functions rather than one function branching on a
mode flag, so that a future edit to one fallback cannot silently change the
other.

#### Scenario: The same guest resolves differently solo versus in a list

- GIVEN a guest with `full_name = "Luis Guzmán"` and `nickname = null`
- WHEN that guest is named as a solo invitation
- THEN the result MUST be `"Luis Guzmán"`
- WHEN the same guest is named as one member of a list alongside others
- THEN the result MUST be `"Luis"`, the first name only, never the full name

#### Scenario: A nickname wins in both fallbacks

- GIVEN a guest with `full_name = "Luis Guzmán"` and `nickname = "Luigi"`
- WHEN that guest is named solo and separately as a list member
- THEN both results MUST be `"Luigi"`

### Requirement: Greeting-name derivation from members

The system MUST derive a household's greeting name from its current list of
members: a single member derives via the solo-address fallback; two or more
members each contribute their list-member name and are joined with the Spanish
conjunction rule. Deriving a greeting name from an EMPTY member list MUST throw
rather than return an empty string or a placeholder, because an invitation with
zero members is already an invalid state that member-management refuses to
create or produce (see the invitation-administration capability), and a
derivation function that tolerated it would hide that a caller reached an
impossible state instead of surfacing it.

#### Scenario: A single member derives via the solo fallback

- GIVEN one member with `full_name = "Ana López"` and `nickname = null`
- WHEN the greeting name is derived
- THEN the result MUST be `"Ana López"`

#### Scenario: Multiple members derive via the list fallback and the conjunction rule

- GIVEN three members whose list-member names are `"Lucho"`, `"Luzma"`, and `"Fer"`
- WHEN the greeting name is derived
- THEN the result MUST be `"Lucho, Luzma y Fer"`

#### Scenario: Deriving from zero members throws

- GIVEN an empty member list
- WHEN the greeting name is derived
- THEN it MUST throw rather than returning any string

### Requirement: Resolving between a derived and a custom greeting name

The system MUST resolve a household's displayed greeting name according to a
stored `source`: at `'custom'`, it MUST return the stored string UNCHANGED,
without re-deriving it from members; at `'derived'`, it MUST return the value
freshly computed from the current member list, not a previously stored string.
A test asserting only the `'custom'` behaviour is insufficient on its own,
because a function that always returns the stored string regardless of source
would pass it; both cases MUST be asserted together.

#### Scenario: A custom source returns the stored string untouched

- GIVEN `source = 'custom'`, a stored greeting name of `"Familia Restrepo"`, and a current member list that would derive to something else
- WHEN the greeting name is resolved
- THEN the result MUST be `"Familia Restrepo"`, exactly as stored

#### Scenario: A derived source recomputes from current members

- GIVEN `source = 'derived'`, a stale stored greeting name from before a membership change, and a current member list of `"Lucho"` and `"Inés"`
- WHEN the greeting name is resolved
- THEN the result MUST be `"Lucho e Inés"`, computed fresh, not the stale stored value
