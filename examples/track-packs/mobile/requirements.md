<!-- The criteria every +mobile feature starts with — one top-level item = one EARS criterion; the engine numbers them
     after the feature's US-1 criteria under "#### [MOBILE] Mobile App — Acceptance Criteria (EARS)". Bracketed text is a
     slot the feature fills in. -->
- WHEN the device is offline THE SYSTEM SHALL keep [the core actions] available and queue the user's changes for sync
- WHEN the device reconnects THE SYSTEM SHALL sync the queued changes and resolve a conflict by [the conflict rule] without losing the user's data
- IF the installed app version is below [the minimum supported version] THEN THE SYSTEM SHALL block the feature and prompt the user to update
- IF the user denies or revokes [a permission] THEN THE SYSTEM SHALL explain what is unavailable and keep the rest of the feature working
- WHEN [the event] happens THE SYSTEM SHALL send a push notification that opens [the target screen] and shows no personal data on the lock screen
