# A constellation with company

Interaction storyboard for the existing ACS homepage, 14 October 2026.

## Starting point

The live homepage was visually inspected in the owner's Brave window at http://acs.design-bakery.com/. It renders the indigo sky, rotating constellation, pale/gold/violet stars, thin connections, serif headline and central vortex. The local source connects its selectable stars to 17 problem records. There are no character cards or emoji exchanges in the current implementation.

The sky is already the right stage. The proposed story happens through encounters within it. Visitors choose when to open a character; the exchanges can be enjoyed without opening anything.

## Page composition

Keep the deep indigo background, restrained gold and lavender, serif typography and fine constellation connections. The central vortex remains part of the atmosphere. In the homepage treatment, remove its module explanation and the floating feature-group labels so the agents become the subject.

Headline: **Your repo. A constellation of agents.**

Invitation: **Bring your little idea.**

Primary action: **Activate your constellation.** Link to the existing ACS repository until a verified installation destination is available. Do not invent an activation service.

Small discovery cue near the sky: **Say hello to a star.**

Give the sky most of the space. Keep emoji bubbles out of the headline and action area. The existing MAP and HOW IT WORKS links can carry the explanatory material.

## Interaction storyboard

These are states of a website, with no required timeline or order. Names and dialogue below are proposed creative material, not product capability claims.

| State | What the visitor sees | What happens |
| --- | --- | --- |
| Arrive | Glowing stars around the core. No portraits are open. | One small bubble appears beside Aries: 💡. A connection briefly brightens toward Virgo; Virgo answers 👀. The bubbles fade. |
| Watch | The sky returns to quiet between exchanges. | Aries sends 🔥; Virgo replies 🧯; Libra responds 😂. The timing makes it feel like teasing between familiar colleagues. |
| Approach | A hovered or keyboard-focused star gains a fine halo and reveals its zodiac name. | Its movement pauses enough to make selection easy. Hover reveals an invitation, not the whole card. |
| Open | Clicking Aries opens one portrait card beside its star, in the free part of the sky. | The portrait occupies most of the card. Under **ARIES / ♈**, the character says, **“Tell me the idea before you talk yourself out of it.”** No job title or feature list. |
| Answer | Aries remains open. Virgo's closed star produces 🙄, then ❤️. | Aries adds, **“That means she likes it.”** This is a small response to the visitor's action, not another panel they must read. |
| Meet another | Clicking Virgo closes Aries and opens Virgo's card. | **VIRGO / ♍** says, **“It doesn't have to be perfect to be worth starting.”** Aries's closed star sends 🙌. |
| Close | The visitor uses the close control, Escape, or an empty part of the sky. | The portrait folds back into its original star. The constellation resumes its quiet exchanges. Nothing advances to a new chapter. |
| Leave or act | The invitation remains available throughout. | The visitor can activate, explore another star, rotate the sky, or continue to supporting pages. No requirement to complete the interactions. |

## Card art direction

A collectible celestial portrait: a distinct silhouette, zodiac symbol, delicate border, and a large expressive face. Use the site's indigo, whisper white, gold and violet rather than introducing a rainbow of status colours. Keep the name, one short spoken line, and a visible close control. The character's expression and other stars' reactions carry the personality.

Aries is eager; Virgo is dry but caring; Libra enjoys their exchange. These are a starting cast for reviewing the interaction, not permanent assignments of product responsibilities. Do not force the 17 existing failure records into zodiac identities. Give the homepage a separate character roster; preserve the factual map's records.

## Rhythm and controls

- At most two emoji bubbles are visible at once. Exchanges last a few seconds, followed by a longer quiet interval. Let the site breathe.
- Bubbles belong to a particular star and follow it. A brief light along an existing connection identifies who is being answered.
- Interaction takes priority over ambient motion. Pause drift near a hovered star; hold the selected star while its card is open.
- Only one portrait card is open at a time. Keep it clear of the headline, primary action, and selected star.
- On phones, open the same portrait in a dismissible bottom sheet, keeping part of the sky visible. Use a stable touch target; a tiny point of light alone is insufficient.
- Provide keyboard-selectable stars with names, visible focus, Escape dismissal, and return focus to the originating star. Ambient emoji should not continuously announce through a live region.
- Reduced motion uses a still constellation and immediate state changes. If WebGL fails, render selectable stars and cards in a simple static layout so the invitation and characters remain usable.

## Where this fits in the repository

`src/components/HeroSky.tsx` currently opens `ProblemRecord`. A homepage character surface belongs here. `src/components/Constellation.tsx` already handles stars, framing, gestures and positioned labels; it needs projected character anchors and a way to hold motion during discovery. `src/components/Skies.tsx` should keep the factual problem sky available for the map while exposing a separate homepage cast. Character names, lines and emoji sequences should live in `content/`, following the existing copy checks.

The current homepage also has feature tabs and long explanatory sections below the sky. They compete with this invitation. Decide their destination during homepage implementation, using /map and /prd as the existing supporting pages; do not delete researched content as a side effect of adding cards.

## First reviewable implementation

Build three characters in the existing sky: closed stars exchange emojis; clicking opens a portrait card; clicking another or closing returns them to stars. Verify placement and readability in desktop and phone layouts before commissioning a full zodiac cast or rewriting the rest of the homepage.

This document specifies the proposed interaction. The live star-panel opening was not successfully verified during this inspection because the moving star left the clicked position; its current selection behavior is established from local source. No website code or deployment has been changed.
