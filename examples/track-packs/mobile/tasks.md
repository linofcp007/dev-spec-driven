<!-- The task block of a +mobile feature ("## Story US-1 — [MOBILE] Mobile App"), numbered after the feature's last task.
     {{ac1}}… are the pack's criteria as the feature numbers them, {{t1}}… their planned tests (a +tdd feature only — the
     line is left out otherwise). A task without _Requirements:_ cites every criterion of the pack. -->
- [ ] Offline store and sync queue for {{name}} — changes replayed on reconnect, conflicts resolved as designed
  - _Requirements: {{ac1}}, {{ac2}}_
  - _Makes green: {{t1}}, {{t2}}_
- [ ] Minimum-version gate and the update prompt; the staged store rollout with its halt criteria
  - _Requirements: {{ac3}}_
  - _Makes green: {{t3}}_
- [ ] Permission flows — the rationale first, the denied and revoked paths
  - _Requirements: {{ac4}}_
  - _Makes green: {{t4}}_
- [ ] Push notifications — the deep link, opt-out, no personal data on the lock screen
  - _Requirements: {{ac5}}_
  - _Makes green: {{t5}}_
- [ ] Device matrix run — the oldest supported iOS and a low-end Android: cold start, memory and battery measured against the budget
