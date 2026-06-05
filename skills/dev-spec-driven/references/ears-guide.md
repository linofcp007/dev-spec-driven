# EARS: Easy Approach to Requirements Syntax

EARS is a structured notation for writing unambiguous, testable requirements. It uses five keyword
patterns that constrain natural language into clear condition-action statements. Originally developed
by Alistair Mavin at Rolls-Royce, EARS is used by organizations including Airbus, Bosch, NASA,
Intel, and Siemens.

The core rule: **if you can't write it in EARS, you don't understand it yet.**

## The Five Patterns

### 1. Ubiquitous (No Keyword)

Requirements that are always active, with no precondition or trigger.

**Format:** The [system] shall [response].

**Examples:**
- The payment system shall encrypt all credit card data using AES-256.
- The API shall respond to all requests within 500 milliseconds.
- The application shall support a minimum of 10,000 concurrent users.
- The system shall log all authentication attempts with timestamp and IP address.

**Use when:** The requirement applies unconditionally, regardless of system state or events.

---

### 2. State-Driven (WHILE)

Requirements that are active only while a specific system state holds true.

**Format:** While [system state], the [system] shall [response].

**Examples:**
- While the user is unauthenticated, the application shall display only public content.
- While the system is in maintenance mode, the API shall return 503 Service Unavailable
  for all requests.
- While the device is in low-power mode, the system shall reduce GPS polling to once per
  minute.
- While offline, the application shall queue data modifications for sync upon reconnection.

**Use when:** Behavior changes depending on a persistent state (not a momentary event).

---

### 3. Event-Driven (WHEN)

Requirements triggered by a specific event.

**Format:** When [trigger event], the [system] shall [response].

**Examples:**
- When a user submits the registration form, the system shall validate all required fields
  and create a new account.
- When a payment is completed, the system shall send a confirmation email to the customer.
- When the application reconnects to the network, the system shall synchronize all pending
  local changes with the server.
- When a file upload exceeds 100MB, the system shall switch to chunked upload with progress
  reporting.

**Use when:** Something happens once and the system must respond to it.

---

### 4. Optional Feature (WHERE)

Requirements that apply only when a specific feature or capability is present.

**Format:** Where [feature is present], the [system] shall [response].

**Examples:**
- Where biometric authentication is available, the application shall offer fingerprint login
  as the default method.
- Where the enterprise analytics module is enabled, the dashboard shall display advanced
  usage metrics.
- Where dual-monitor support is detected, the application shall extend the workspace across
  both displays.
- Where the webhook integration is configured, the system shall POST event payloads to the
  registered endpoint.

**Use when:** The requirement only makes sense if an optional component exists.

---

### 5. Unwanted Behavior (IF...THEN)

Requirements that specify how the system should handle error conditions or undesirable situations.

**Format:** If [unwanted condition], then the [system] shall [response].

**Examples:**
- If the database connection is lost, then the system shall retry with exponential backoff
  up to 3 times, then fail gracefully with a user-friendly error message.
- If the user enters an invalid password 5 consecutive times, then the system shall lock the
  account for 15 minutes and send a security alert email.
- If the payment gateway returns an error, then the system shall preserve the cart contents
  and display alternative payment options.
- If the uploaded file format is not supported, then the system shall reject the upload and
  display a list of accepted formats.

**Use when:** You need to specify recovery or mitigation for things that can go wrong.

---

## Compound Patterns

Complex requirements combine keywords. The order always follows temporal logic:
**WHILE → WHEN → IF**

### WHILE + WHEN (State + Event)
- While the user is authenticated, when they request account deletion, the system shall
  initiate a 30-day grace period and send a confirmation email.
- While the system is processing a batch job, when a new batch is submitted, the system
  shall queue it and display the estimated wait time.

### WHEN + IF (Event + Error Condition)
- When a user submits a form, if required fields are missing, then the system shall highlight
  the empty fields and display specific validation messages.
- When the system attempts a database migration, if schema conflicts are detected, then the
  system shall abort the migration and log the conflict details.

### WHILE + WHEN + IF (State + Event + Error)
- While the system is in production mode, when a critical error occurs, if the automatic
  recovery fails, then the system shall trigger an alert to the on-call team and switch to
  degraded mode.

### WHERE + WHEN (Optional Feature + Event)
- Where the Slack integration is configured, when a deployment completes, the system shall
  post a summary to the configured channel.

---

## Writing Guidelines

### Do This

- **One behavior per requirement.** If you write "AND" between two actions, split them into
  separate requirements.
- **Be specific and measurable.** "Within 500ms" not "quickly". "Up to 3 retries" not "several
  times".
- **Use active voice.** "The system shall validate" not "validation will be performed".
- **Keep preconditions to 3 or fewer.** More than that → use a decision table instead.
- **Use the system name consistently.** Pick one name and stick with it throughout the spec.

### Avoid This

- **Ambiguous adjectives:** "user-friendly", "fast", "appropriate", "reasonable"
- **Passive voice:** "The data will be processed" (by whom?)
- **Implementation details:** "The system shall use PostgreSQL" (that's design, not a requirement)
- **Compound actions with AND:** Split into separate requirements
- **Weak verbs:** "might", "could", "should" — use "shall" for requirements

### Mapping to Acceptance Tests

EARS requirements map naturally to Given-When-Then test scenarios:

| EARS | Test Format |
|------|-------------|
| WHILE (state) | GIVEN [state] |
| WHEN (trigger) | WHEN [event] |
| IF (condition) | AND [condition] |
| System response | THEN [expected outcome] |

**Example:**
- EARS: "While the user is logged in, when they click 'Export', if the dataset exceeds 10,000
  rows, then the system shall generate the export asynchronously and email the download link."
- Test:
  ```
  GIVEN the user is logged in
  AND the dataset has more than 10,000 rows
  WHEN the user clicks 'Export'
  THEN the system generates the export asynchronously
  AND the system emails the download link to the user
  ```
