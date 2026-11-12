# Home and Gallery QA

## Approved scope

- Home uses the same logo asset as the loading screen.
- Random Play and Play with Friends use matching outlined cards and a staggered
  shine. The shine stops when Home is unfocused, the app is backgrounded, or
  the system requests reduced motion.
- Rules are accessed through a scrollable How to Play panel instead of the three
  Home statistics. Its approved copy explains sharing one drawing, one minute per
  player per round over three rounds, live watching, and saving the final artwork.
- The “Let's Go!” button dismisses the panel; it does not start matchmaking.
- Gallery distinguishes an empty successful response from a failed request.
  Reads, including body parsing, time out after ten seconds and can be retried.

## Local verification

- TypeScript passed.
- Lint: zero errors; ten existing warnings.
- Tests: 186 passed in the full run; the Game Center certificate fixture exceeded
  the ten-second setup limit under parallel load. Its 16 tests passed separately
  with a thirty-second hook limit. The 202 passing tests across those runs include
  13 new checks for Gallery reads, URL selection, timeout, cancellation, invalid
  responses, and successful retry.
- Mobile-sized browser screenshots confirmed Home, populated Gallery, and the
  rules panel at a 320 × 568 viewport. The rules content scrolls on short screens.
- The preview Gallery API returned HTTP 200 with actual drawing records.
- No records were deleted or changed during verification.

## Native follow-up

These changes are newer than TestFlight build 6. No new EAS build, submission,
backend publication, or signing change was performed for this QA round.

A separately approved native build is needed to verify the Gallery request
behavior on iPhone, the shine with Reduce Motion on/off, the rules panel at large
text sizes, and unchanged Random Play and friend-invite behavior.
