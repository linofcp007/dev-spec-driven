# Mobile Standards

## Platforms
- Minimum versions: iOS [16] · Android [API 26] · the framework: [native | React Native | Flutter] · the devices we test on: [list].

## Releases
- Store review lead time: [N days] · staged rollout: [1% → 10% → 50% → 100%] with halt criteria (crash-free sessions below [99.5%]).
- Forced update when: [a breaking API change] · the oldest app version the API still serves: [version].

## Offline & Sync
- What must work offline: [list] · conflict rule: [last write wins | merge | ask the user] · the queue survives an app restart.

## Permissions
- Asked in context, never at launch · a rationale screen first · every feature has a path for a denied permission.

## Performance & Battery
- Cold start ≤ [2 s] on [a low-end device] · app size ≤ [N MB] · background work at most every [N minutes].

## Push Notifications
- No personal data on the lock screen · every notification deep-links · at most [N] per user per day · an opt-out per category.
