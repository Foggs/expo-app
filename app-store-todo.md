# App Store Publication Prep

This checklist tracks the major steps needed to publish the app to the App Store.

- [ ] Confirm app metadata (name, description, keywords, support URL, marketing URL)
- [ ] Assemble localized app screenshots for all supported devices
- [ ] Verify app icon meets Apple's size and format requirements
- [ ] Review and bump version/build numbers, then update changelog
- [ ] Run tests (unit, UI, integration) and document results
- [ ] Archive the app via Xcode and validate the archive
- [ ] Upload the build to App Store Connect and resolve any validation issues
- [ ] Complete App Store Connect listing (pricing, availability, categories)
- [ ] Configure TestFlight and invite reviewers for a final sanity check
- [ ] Double-check compliance pieces (privacy policy link, export compliance, data use)
- [ ] Enable Game Center for the app in App Store Connect and test sign-in on a physical iPhone (see `docs/game-center.md`)
- [ ] Update the privacy policy and App Store privacy labels for Game Center sign-in: User ID, Device ID and Other User Content are now linked to the user (see `docs/security-privacy-audit.md` §6)
- [ ] Decide on in-app deletion of the Game Center–linked player record (App Store Guideline 5.1.1(v))
- [ ] Prepare marketing materials (promo video, preview clips, release notes)

Add more steps as needed for your release process.
