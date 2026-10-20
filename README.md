# Restful Booker API Quality Engineering

[![API Tests](https://github.com/marinadantis/restful-booker-qa/actions/workflows/playwright.yml/badge.svg)](https://github.com/marinadantis/restful-booker-qa/actions/workflows/playwright.yml)

**TypeScript · Playwright Test · API Testing · Authentication Resilience · Concurrency · Contract Validation**

A TypeScript-based API quality engineering framework built with Playwright Test to evaluate authentication lifecycle management, booking business rules, update semantics, concurrency behavior, and resilience against shared-environment instability.

The project goes beyond happy-path API testing. It combines contract-driven assertions, state-based verification, negative testing, concurrency scenarios, and characterization of observed API behavior to distinguish implementation defects from test defects and environmental failures.

Developed as part of a Senior Engineer – Technology Quality Assurance take-home assessment.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Engineering Objectives](#engineering-objectives)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Test Coverage](#test-coverage)
- [Technical Deep Dive](#technical-deep-dive)
- [Test Strategy and API Findings](#test-strategy-and-api-findings)
- [Reliability and Test Isolation](#reliability-and-test-isolation)
- [Execution and Reporting](#execution-and-reporting)
- [Design Decisions and Trade-offs](#design-decisions-and-trade-offs)
- [Limitations and Future Improvements](#limitations-and-future-improvements)

---

## Project Overview

**Target API:** [Restful-Booker](https://restful-booker.herokuapp.com)

**API documentation:** [Restful-Booker API documentation](https://restful-booker.herokuapp.com/apidoc/index.html)

The framework tests a public REST API using Playwright's API testing capabilities, without requiring browser-based UI automation.

The focus is on risks that frequently emerge in distributed applications and production-facing APIs:

- Concurrent requests racing to obtain or refresh authentication tokens.
- Expired or rejected credentials disrupting authenticated operations.
- APIs accepting structurally valid but semantically invalid business data.
- Repeated updates producing unintended changes.
- Concurrent writes leaving inconsistent resource state.
- Shared test environments changing or deleting data independently of the test suite.
- Tests passing on HTTP status codes without verifying the actual persisted state.

The framework addresses these risks through reusable API abstractions, typed payloads, centralized validation, authentication fixtures, explicit recovery behavior, and state-oriented assertions.

### Engineering highlights

| Area                   | Engineering approach                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Authentication         | Cached tokens, concurrent request deduplication, coordinated refresh, bounded retries |
| API abstraction        | Reusable booking API client separated from test scenarios                             |
| Type safety            | TypeScript models for booking payloads and responses                                  |
| Test data              | Dynamic dates and reusable booking-data factories                                     |
| Contract validation    | Explicit assertions for expected response codes and business invariants               |
| Idempotency            | Repeated PUT requests with persisted-state verification                               |
| Partial updates        | PATCH verification to detect unintended changes to unrelated fields                   |
| Concurrency            | Conflicting writes with assertions against partial or corrupted state                 |
| Environment resilience | Recovery of missing prerequisites and defensive cleanup                               |
| Reporting              | Playwright list and HTML reporters, with traces retained on failure                   |

The objective is not simply to maximize the number of tests. It is to produce meaningful evidence about correctness, reliability, and known gaps in the API contract.

---

## Engineering Objectives

The framework is designed around five quality objectives.

### 1. Correctness

Verify that API operations produce the expected response and persisted resource state, including rejection of invalid requests.

### 2. Reliability

Prevent authentication races, bound retries, and recover from missing prerequisites without masking unrelated failures.

### 3. Consistency

Verify that repeated updates are stable, partial updates preserve unrelated fields, and concurrent writes do not produce unintended combinations of state.

### 4. Maintainability

Keep API communication, authentication, data generation, validation, and test scenarios separate so that changes remain localized.

### 5. Observability

Make failures actionable through descriptive assertions, execution reports, and explicit documentation of known API behavior.

---

## Technology Stack

| Technology                   | Role                                             |
| ---------------------------- | ------------------------------------------------ |
| TypeScript                   | Strongly typed test code and API contracts       |
| Playwright Test              | Test runner, fixtures, assertions, and reporting |
| Playwright APIRequestContext | HTTP communication with the target API           |
| Node.js                      | Runtime environment                              |
| npm                          | Dependency and script management                 |
| dotenv                       | Environment-variable configuration               |

### Why Playwright for API testing?

Playwright provides an integrated API testing layer, a test runner, reusable fixtures, assertion utilities, parallel execution controls, and HTML reporting.

Using a single framework for API requests and test orchestration avoids unnecessary infrastructure while retaining the flexibility needed for concurrency and authentication scenarios.

---

## Architecture

The framework follows a layered architecture that separates test intent from implementation details.

```text
                  ┌────────────────────────┐
                  │   Playwright Test      │
                  │       Suites           │
                  └────────────┬───────────┘
                               │
                               ▼
                  ┌────────────────────────┐
                  │     API Fixtures       │
                  │  Dependency Injection  │
                  └────────────┬───────────┘
                               │
                  ┌────────────┴────────────┐
                  │                         │
                  ▼                         ▼
       ┌────────────────────┐   ┌────────────────────┐
       │   Token Manager    │◄──│     Booking API    │
       │                    │   │                    │
       │ • Token caching    │   │ • CRUD operations  │
       │ • Request dedupe   │   │ • HTTP handling    │
       │ • Token refresh    │   │ • Bounded retries  │
       └─────────┬──────────┘   └─────────┬──────────┘
                 │                        │
                 │                        │
                 ▼                        ▼
       ┌────────────────────┐   ┌────────────────────┐
       │  Authentication    │   │  Restful-Booker    │
       │      Endpoint      │   │  Booking Endpoint  │
       └────────────────────┘   └────────────────────┘
```

Supporting components provide typed data models, payload validation, resource recovery, and cleanup.

### Architectural responsibilities

**Authentication layer**

Manages token acquisition, caching, invalidation, concurrent refresh, and retry coordination.

**API client layer**

Encapsulates booking endpoints and authentication-aware request behavior.

**Fixture layer**

Provides reusable dependencies to tests, avoiding repeated setup and promoting consistent configuration.

**Test data layer**

Generates booking payloads and dynamic dates with support for scenario-specific overrides.

**Validation layer**

Checks booking data structure, date validity, and business invariants.

**Lifecycle helpers**

Recover missing prerequisites and remove test-created resources where possible.

### Design principles

- Separation of concerns.
- Dependency injection through Playwright fixtures.
- Reusable API operations.
- Explicit contract assertions.
- State-based verification after mutations.
- Bounded retries and recovery.
- Clear distinction between expected behavior and observed behavior.

---

## Project Structure

```text
.
├── src/
│   ├── auth/
│   │   └── token-manager.ts
│   ├── api/
│   │   └── booking-api.ts
│   └── types/
│       └── booking.ts
├── tests/
│   ├── auth/
│   │   └── auth.spec.ts
│   ├── booking/
│   │   ├── booking-create.spec.ts
│   │   ├── booking-update.spec.ts
│   │   ├── booking-concurrency.spec.ts
│   │   └── booking-recovery.spec.ts
│   ├── fixtures/
│   │   ├── api-fixtures.ts
│   │   └── booking-data.ts
│   └── helpers/
│       ├── booking-validation.ts
│       ├── booking-cleanup.ts
│       └── booking-recovery.ts
├── playwright.config.ts
├── tsconfig.json
├── package.json
├── package-lock.json
├── .gitignore
├── .env
└── README.md
```

### Component responsibilities

| Component               | Responsibility                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `token-manager.ts`      | Token caching, concurrent token generation, invalidation, and refresh coordination              |
| `booking-api.ts`        | Booking creation, retrieval, update, partial update, deletion, and bounded authentication retry |
| `booking.ts`            | Booking payload, booking-date, and response types                                               |
| `api-fixtures.ts`       | Shared authentication manager, booking API, and token fixtures                                  |
| `booking-data.ts`       | Dynamic booking payload generation                                                              |
| `booking-validation.ts` | Booking payload and date-invariant validation                                                   |
| `booking-cleanup.ts`    | Resource deletion and cleanup verification                                                      |
| `booking-recovery.ts`   | Recovery of missing prerequisite bookings                                                       |
| `playwright.config.ts`  | Test discovery, execution settings, timeouts, retries, and reporters                            |

---

## Getting Started

### Prerequisites

- Node.js and npm.
- Access to the Restful-Booker API.
- Valid credentials for the target API environment.

### 1. Clone the repository

```bash
git clone <repository-url>
cd <repository-directory>
```

Replace the placeholders with the actual repository URL and directory.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local `.env` file in the project root:

```dotenv
API_USERNAME=admin
API_PASSWORD=password123
```

Use the credentials supplied for the assessment environment if they differ.

The configuration is loaded through `dotenv/config`.

**Security considerations**

- Keep `.env` in `.gitignore`.
- Do not commit credentials, tokens, or other secrets.
- Do not include authentication tokens in test reports or debug logs.
- Use environment-specific credentials when integrating the framework into CI.

### 4. Run the TypeScript check

```bash
npm run typecheck
```

### 5. Execute the test suite

```bash
npm test
```

---

## Configuration

Playwright configuration is centralized in `playwright.config.ts`.

The current configuration includes:

| Setting           | Value                                  |
| ----------------- | -------------------------------------- |
| Base URL          | `https://restful-booker.herokuapp.com` |
| Test directory    | `./tests`                              |
| Test timeout      | 30 seconds                             |
| Assertion timeout | 5 seconds                              |
| Local workers     | 1                                      |
| CI workers        | 2                                      |
| Local retries     | 0                                      |
| CI retries        | 1                                      |
| Reporters         | List and HTML                          |
| Trace collection  | Retain on failure                      |

### Execution strategy

A single local worker makes failures easier to reproduce and limits unnecessary contention against the shared sandbox.

CI uses a small worker count and one retry to balance execution speed with reliability.

Retries are an execution-level safeguard, not a substitute for correct test design. Persistent failures must still be investigated.

Tests that share or mutate resources require particular attention when parallel execution is enabled.

---

## Test Coverage

The test suite is organized around high-risk API behavior rather than only endpoint-level happy paths.

### 1. Authentication and token lifecycle

**File:** `tests/auth/auth.spec.ts`

Scenarios include:

- Reusing a valid cached token.
- Deduplicating concurrent token-generation requests.
- Refreshing a rejected token.
- Retrying a booking update after authentication failure.
- Sharing a token refresh across concurrent failed requests.
- Preventing unbounded authentication retries.
- Verifying that invalid authentication does not modify a booking.

**Primary quality objective:** Authentication failures should be handled predictably without creating request storms, stale-token races, or unintended resource mutations.

### 2. Booking creation and validation

**File:** `tests/booking/booking-create.spec.ts`

Scenarios include:

- Creating and retrieving a booking.
- Validating the returned booking structure.
- Checking booking-date formats and business invariants.
- Characterizing duplicate booking behavior through independent API contexts.
- Characterizing reversed check-in and check-out dates.
- Characterizing overlapping date behavior.
- Testing negative prices and missing required fields.

**Primary quality objective:** Distinguish valid booking creation from acceptance of data that violates the intended business contract.

### 3. PUT idempotency

**File:** `tests/booking/booking-update.spec.ts`

The same complete booking payload is submitted three times.

Assertions verify that:

- Requests return the expected success status.
- Responses reflect the submitted representation.
- The persisted resource matches the expected state after each request.
- Repeating the same update does not introduce unintended changes.

**Primary quality objective:** Repeated execution of the same PUT operation should preserve the intended resource state.

### 4. PATCH partial-update integrity

**File:** `tests/booking/booking-update.spec.ts`

The PATCH scenario updates a single field, such as `totalprice`, then retrieves the entire booking.

Assertions compare the resulting resource against the original booking with only the requested field changed.

**Primary quality objective:** Partial updates must not unintentionally overwrite unrelated fields.

### 5. Concurrent resource updates

**File:** `tests/booking/booking-concurrency.spec.ts`

Two conflicting PUT requests are submitted to the same booking using `Promise.all()`.

Assertions verify that:

- Both requests return the expected response status.
- The final resource matches one of the complete submitted payloads.
- The final state is not an unintended mixture of the conflicting payloads.

**Primary quality objective:** Concurrent writes should not leave an internally inconsistent resource.

The test exercises overlapping requests but does not guarantee arrival at the server in the exact same millisecond.

### 6. Shared-environment recovery

**File:** `tests/booking/booking-recovery.spec.ts`

The recovery scenario simulates a prerequisite booking disappearing before it is needed.

Assertions verify that:

- The missing booking is detected.
- The prerequisite is recreated.
- The returned booking ID is valid.
- The replacement can be retrieved.
- Its data matches the expected booking payload.

**Primary quality objective:** Tests should recover from missing prerequisites where recovery is safe and possible, without continuing to use stale resource identifiers.

### 7. Resource cleanup

**Helper:** `tests/helpers/booking-cleanup.ts`

The cleanup helper:

- Checks whether the booking still exists.
- Treats an already-missing booking as absent.
- Deletes an existing booking.
- Verifies that the booking is no longer available.
- Surfaces unexpected responses and cleanup-verification failures.

**Primary quality objective:** Minimize test-data pollution and reduce interference between runs.

---

## Technical Deep Dive

### Authentication as a concurrency problem

Token acquisition is not treated as a simple utility call. It is a shared lifecycle concern that must remain correct when multiple operations execute concurrently.

The `TokenManager` maintains a cached token and coordinates in-progress token-generation or refresh operations.

When several callers need a token simultaneously, they can share the same pending promise rather than initiating independent authentication requests.

This reduces redundant requests and helps prevent concurrent initialization races.

#### Authentication retry flow

```text
Authenticated Request
        |
        v
   API Response
        |
        +---- Success ----> Return Response
        |
        +---- 401 / 403
                  |
                  v
          Refresh or Reuse
          Current Valid Token
                  |
                  v
             Retry Once
                  |
                  v
            Return Result
```

The retry is bounded to one additional attempt.

This prevents an authentication failure from becoming an infinite loop.

The manager also considers the token associated with the failed request when invalidating cached credentials, reducing the risk that a delayed failure will invalidate a newer token.

### Business invariants versus payload shape

A payload can be structurally valid while violating business rules.

For example, both booking dates may use the correct `YYYY-MM-DD` format, yet the checkout date may precede the check-in date.

The validation helper checks:

- Valid calendar dates.
- Expected date representation.
- Checkout occurring after check-in.
- A finite, non-negative price.
- A boolean deposit flag.
- Required nested booking-date fields.

These checks validate test data. They do not, by themselves, prove that the server enforces the same rules.

Server-side enforcement must be verified through negative API tests.

### State-based assertions

A successful HTTP response is not sufficient evidence that a mutation was correct.

The update tests retrieve the resource after mutation and compare the persisted representation with the expected state.

This is particularly important for:

- PUT idempotency.
- PATCH field preservation.
- Conflicting concurrent updates.
- Authentication failures.
- Resource recovery and cleanup.

### Idempotency and resource consistency

For PUT, the suite repeats the same complete update and verifies stable state.

For PATCH, the suite verifies that only the intended field changes.

For concurrent PUT requests, the suite checks that the final representation corresponds to one complete submitted payload rather than a partial merge.

These tests validate observable resource consistency without assuming the API exposes version numbers or optimistic-locking metadata.

---

## Test Strategy and API Findings

The framework distinguishes three different testing objectives.

### Contract testing

Contract tests assert the behavior the API is expected to guarantee.

For example, invalid booking data should be rejected with an appropriate client-error response.

These tests should remain strict even when the current implementation fails to meet the expected contract.

### Characterization testing

Characterization tests document the behavior currently observed from the sandbox when the contract is unclear or the implementation behaves differently from expectations.

They are useful for recording behavior without misrepresenting it as correct or desirable.

### State-based testing

State-based tests retrieve resources after mutations and verify their resulting state.

This provides stronger evidence than checking a status code alone.

### Known validation gaps

The negative-price and missing-first-name tests express the expected contract and use Playwright's `test.fail()` annotation to identify known failures.

The assertions are deliberately not weakened to accept the observed behavior.

With Playwright's expected-failure mechanism:

- A failing assertion is reported as an expected failure.
- A test that unexpectedly passes is reported as an unexpected pass, prompting review of the annotation.

The actual response status and persisted behavior should be verified from execution output before documenting the precise failure mechanism.

### Duplicate booking behavior

The duplicate-booking scenario submits identical booking data through independent API contexts.

The current observation is that the API accepts the duplicate payloads and returns distinct booking IDs.

This is a characterization of the public API, not proof that two reservations have been created for the same physical room. The tested API scenario does not identify a specific room.

### Overlapping date ranges

The overlapping-date scenario examines how the sandbox responds to bookings with overlapping date ranges.

Its result should be interpreted according to the assertions implemented in the test. It should not be treated as proof of room-level reservation conflicts or guarantees that the API does not provide.

### Why expected failures are retained

Marking a confirmed contract violation with `test.fail()` keeps the intended assertion active and makes the known discrepancy visible.

By contrast, changing the assertion to accept the observed response would hide the contract gap.

Expected-failure annotations should be reviewed when API behavior changes and should not be used to conceal test defects, infrastructure failures, or unexplained errors.

---

## Reliability and Test Isolation

The target API is a shared sandbox. Its data may be changed or removed independently of a test's execution.

This introduces a distinction between **client-side isolation** and **server-side data isolation**.

### Independent API contexts

Separate API contexts are used when a test needs independent client contexts.

This helps isolate client-side state but does not isolate the underlying server or database.

### Missing-resource recovery

The recovery helper checks whether a required booking still exists.

If it receives `404`, it creates a replacement and returns the replacement ID.

Callers must use the returned ID rather than continuing to reference the original missing resource.

Unexpected responses are surfaced as errors instead of being treated as recoverable conditions.

### Defensive cleanup

Cleanup tolerates a booking that has already disappeared.

Other unexpected statuses and failed verification remain visible, allowing genuine problems to be investigated.

### Avoiding false confidence

A test passing after recovery does not mean the sandbox was isolated or stable. It means the test successfully handled the particular missing-prerequisite scenario it was designed to address.

Similarly, using one worker reduces local contention but cannot prevent interference from external users or other independent test runs.

---

## Execution and Reporting

### Run the complete suite

```bash
npm test
```

### Run TypeScript validation

```bash
npm run typecheck
```

### Run authentication tests

```bash
npx playwright test tests/auth/auth.spec.ts
```

### Run booking creation and validation tests

```bash
npx playwright test tests/booking/booking-create.spec.ts
```

### Run update and idempotency tests

```bash
npx playwright test tests/booking/booking-update.spec.ts
```

### Run concurrency tests

```bash
npx playwright test tests/booking/booking-concurrency.spec.ts
```

### Run recovery tests

```bash
npx playwright test tests/booking/booking-recovery.spec.ts
```

### Run a specific test by title

```bash
npx playwright test -g "PUT should be idempotent"
```

### Run with a single worker

```bash
npx playwright test --workers=1
```

### Run with detailed console output

```bash
npx playwright test --reporter=list
```

### View the HTML report

```bash
npx playwright show-report
```

### Failure investigation workflow

When a test fails:

1. Identify the failed assertion and the actual response.
2. Inspect the HTTP status and response body.
3. Determine whether the failure represents a contract violation, test defect, authentication issue, or environment problem.
4. Retrieve the resource to inspect persisted state where applicable.
5. Check whether shared-sandbox activity could explain the result.
6. Review any expected-failure annotation.
7. Fix the underlying issue or document the verified API discrepancy.

Retries should not replace this investigation.

---

## Design Decisions and Trade-offs

### 1. Centralized authentication management

**Decision:** Use a dedicated token manager rather than duplicating authentication logic in tests.

**Rationale:** Token lifecycle behavior is shared across authenticated operations. Centralization makes caching, refresh coordination, and retry limits easier to reason about and test.

**Trade-off:** The token manager introduces additional state and concurrency logic. It therefore requires dedicated tests for simultaneous requests and refresh failures.

### 2. API client abstraction

**Decision:** Encapsulate booking operations in a reusable API client.

**Rationale:** Tests focus on business scenarios rather than repetitive HTTP request construction.

**Trade-off:** The client must remain a thin transport abstraction. Business-specific assertions belong in test scenarios or validation helpers unless they are genuinely reusable API contracts.

### 3. Dynamic test data

**Decision:** Generate booking data and dates rather than relying exclusively on static records.

**Rationale:** Dynamic data reduces dependence on pre-existing records and helps keep tests repeatable.

**Trade-off:** Dynamic generation alone does not guarantee uniqueness or eliminate collisions in a shared environment.

### 4. Strict contract assertions

**Decision:** Retain assertions for expected rejection of invalid data and mark confirmed known failures as expected failures.

**Rationale:** A test suite should preserve the intended contract rather than adapt its expectations to make an implementation appear correct.

**Trade-off:** Expected failures require documentation and ongoing review to ensure they remain justified.

### 5. Persisted-state verification

**Decision:** Retrieve resources after updates and validate the complete resulting representation.

**Rationale:** Status codes alone cannot prove that an update preserved the correct data.

**Trade-off:** Additional HTTP requests increase execution time and introduce potential shared-environment race conditions.

### 6. Bounded authentication retries

**Decision:** Retry an authenticated operation at most once after refreshing or obtaining a current token.

**Rationale:** This provides limited resilience without risking an infinite retry loop.

**Trade-off:** A bounded retry cannot guarantee success when credentials are invalid or the service remains unavailable.

### 7. Recovery in a shared sandbox

**Decision:** Recreate a missing prerequisite when the helper determines that the resource has disappeared.

**Rationale:** This addresses an environmental failure mode that can otherwise make tests unnecessarily brittle.

**Trade-off:** Recovery creates a new resource ID and may not be appropriate for every scenario. Callers must use the replacement ID, and recovery must not conceal unrelated errors.

---

## Limitations and Future Improvements

The current framework focuses on the assessment's highest-risk scenarios. The following improvements would extend its coverage and production readiness.

### API contract and validation

- Validate responses against a formal OpenAPI specification or JSON Schema.
- Expand negative testing for missing, null, empty, malformed, and out-of-range fields.
- Add explicit response-body assertions for invalid requests.
- Verify consistent error response structures.
- Extend boundary-value testing for dates and prices.

### Concurrency and distributed-state behavior

- Investigate support for ETags, version identifiers, or optimistic-locking semantics.
- Add deterministic synchronization or server-side instrumentation if exact race timing must be tested.
- Define expected conflict behavior before asserting a specific concurrency-control strategy.
- Add tests for concurrent creation and updates where the API contract supports meaningful invariants.

### Test-data isolation

- Use a dedicated test environment with resettable data when available.
- Add correlation identifiers to test-created resources where the API supports them.
- Improve isolation between tests that modify shared resources.
- Record cleanup failures as actionable test or infrastructure issues.

### Observability and CI

- Add CI execution with report artifact retention.
- Introduce structured request and response diagnostics with credentials redacted.
- Add linting and code-quality checks.
- Add execution summaries that distinguish passed tests, unexpected failures, and expected failures.
- Track known API discrepancies separately from framework defects.

### Security

- Expand authorization tests across supported endpoints.
- Verify that invalid credentials never result in unintended mutations.
- Add boundary and malformed-input tests where appropriate.
- Ensure logs and reports do not expose secrets.

These are potential extensions, not claims about functionality already implemented.

---

## Conclusion

This project demonstrates a risk-oriented approach to API quality engineering using TypeScript and Playwright.

Its core focus is on authentication lifecycle correctness, business-rule validation, update semantics, concurrent resource consistency, and resilience against shared-environment instability.

The framework separates API implementation from test intent, validates persisted state rather than relying solely on status codes, and documents discrepancies between expected and observed behavior without weakening the intended contract.

The result is a maintainable foundation for investigating API correctness and reliability—not merely a collection of happy-path automation scripts.

---

## Author

**Marina Dantis**  
Senior Quality Engineer | SDET | Test Automation | Quality Engineering

This project was developed as part of a Senior Engineer – Technology Quality Assurance take-home assessment, demonstrating a risk-based approach to API testing, authentication resilience, concurrency, and test automation architecture.

- **LinkedIn:** [Marina Dantis](https://www.linkedin.com/in/marina-dantis/)
- **Focus areas:** API Quality Engineering, Test Automation, TypeScript, Playwright, CI/CD, and Software Quality.

---
