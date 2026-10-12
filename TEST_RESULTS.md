# Test Execution Results

**Project:** Restful-Booker API Quality Engineering  
**Assessment:** Senior Engineer – Technology Quality Assurance  
**Framework:** TypeScript + Playwright Test  
**Target API:** https://restful-booker.herokuapp.com
**Date:** October 12, 2026  
---

## Executive Summary

This report documents API quality scenarios covering authentication resilience, booking validation, update semantics, concurrent writes, and recovery from missing data in a shared sandbox.

The suite combines contract-oriented assertions with persisted-state checks. It distinguishes intended API behavior from observed sandbox behavior so that validation gaps remain visible rather than being hidden by weakened assertions.

> **Final reported run:** `npm test` completed with **17 passed** in 27.2 seconds, and `npm run typecheck` completed successfully. The two validation scenarios are annotated with `test.fail()` and are expected failures; Playwright marks them with a failure symbol in the detailed output while counting the expected outcomes as passed in the final summary.

## Execution Summary

| Metric                                            | Latest evidence available |
| ------------------------------------------------- | ------------------------- |
| Tests executed                                    | 17                        |
| Final Playwright summary                          | 17 passed                 |
| Ordinary passing tests                            | 15                        |
| Expected-failure validation tests (`test.fail()`) | 2                         |
| Test duration                                     | 27.2 seconds              |
| TypeScript check (`npm run typecheck`)            | Passed                    |
| Environment                                       | Public shared API sandbox |

### Reproduce the results

Run from the project root:

```bash
npm test
npm run typecheck
```

The counts above reflect the latest output provided for the submitted test annotations. Rerun both commands after any further code changes.

---

## Coverage Summary

| Area                     | Scenarios                                                        | Verification focus                                                                      |
| ------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Authentication lifecycle | Token reuse, concurrent token generation, refresh, bounded retry | Deduplicated token requests, recovery after rejected authentication, no unbounded retry |
| Authentication failure   | Invalid or missing authentication during an update               | Rejection and unchanged booking state                                                   |
| Booking creation         | Create and retrieve a booking; response structure                | Expected response and booking representation                                            |
| Booking validation       | Date invariants, negative price, missing first name              | Payload invariants and API handling of invalid inputs                                   |
| Duplicate requests       | Identical booking payloads through independent API contexts      | Actual responses and returned booking IDs                                               |
| Overlapping dates        | Booking requests with overlapping date ranges                    | Observed sandbox behavior                                                               |
| PUT idempotency          | Same PUT payload submitted three times                           | Consistent response and persisted state                                                 |
| PATCH integrity          | Single-field update                                              | Intended field changes; unrelated fields remain unchanged                               |
| Concurrent updates       | Conflicting PUT requests submitted with `Promise.all()`          | Final state matches one complete submitted payload                                      |
| Shared-sandbox recovery  | Missing prerequisite booking                                     | Recreation and use of replacement booking ID                                            |
| Cleanup                  | Deletion and post-delete verification                            | Missing resources tolerated; unexpected outcomes surfaced                               |

---

## Detailed Findings

### 1. Negative booking price

**Intended contract:** A booking with a negative `totalprice` should be rejected with an appropriate client-error response, such as HTTP `400` or `422`.

**Observed response:** The diagnostic `Expected value: 200; Received array: [400, 422]` indicates that the API returned HTTP `200`, while the test expected the status to be one of the allowed client-error codes. This suggests that the API accepted the request at the HTTP-response level despite the invalid price.

**Important qualification:** A `200` response alone does not prove that the negative value was persisted. Confirm the resulting booking state before making that stronger claim.

**Test treatment:** The test has been annotated with `test.fail()` to retain the intended contract assertion while documenting the current behavior as an expected failure. Review the annotation if the test begins passing unexpectedly.

### 2. Missing first name

**Intended contract:** A booking missing the required first name should be rejected with an appropriate client-error response, such as HTTP `400` or `422`.

**Observed response:** The diagnostic `Expected value: 500; Received array: [400, 422]` indicates that the API returned HTTP `500`, while the test expected one of the allowed client-error codes. This suggests the API responds with a server error for this invalid input rather than a controlled validation response.

**Important qualification:** The `500` response does not by itself establish whether a booking was created or persisted.

**Test treatment:** The test has been annotated with `test.fail()` to preserve the intended validation contract and make the discrepancy visible. Review the annotation if the test begins passing unexpectedly.

### 3. Duplicate booking payloads

The duplicate-booking scenario submits identical booking data through independent API contexts. The earlier test run characterized the sandbox behavior and returned distinct booking IDs for the duplicate payloads.

This does **not** establish that two reservations were made for the same physical room. The scenario does not identify a room or establish room-level reservation semantics.

### 4. Reversed and overlapping dates

The suite exercises reversed check-in/check-out dates and overlapping date ranges. The intended business invariant is:

`checkout > checkin`

The local payload-validation helper checks date format, calendar validity, and ordering. These checks validate generated test data; they do not prove that the server enforces the same invariant. Describe server-side date validation only to the extent demonstrated by the API assertions and recorded responses.

### 5. PUT idempotency

The test submits the same complete PUT payload three times, checks each response, and retrieves the booking to verify persisted state.

The objective is to verify that repeated identical updates do not introduce unintended changes. The test does not assume the API exposes a resource version or revision counter.

### 6. PATCH partial-update integrity

The PATCH test updates `totalprice` and retrieves the complete booking afterward. It checks that the requested field changes while unrelated fields remain unchanged, helping detect accidental full-resource overwrites during partial updates.

### 7. Concurrent updates

Two conflicting PUT payloads are submitted to the same booking using `Promise.all()`. The final booking is asserted to match one of the complete submitted payloads.

This checks for an unintended partial merge of conflicting values. The requests overlap in client execution, but the test does not guarantee that they reach the server in the exact same millisecond or prove a particular server-side locking strategy.

### 8. Shared-sandbox recovery

The recovery test simulates a prerequisite booking disappearing, verifies the missing-resource response, recreates the booking, and checks the replacement resource.

This addresses one source of test instability in a shared sandbox. It does not provide server-side test isolation; external users or other test runs may still modify shared data.

---

## Expected Failures: Interpretation and Review

Playwright's `test.fail()` marks a test as expected to fail.

- If the test fails as expected, Playwright reports an expected failure.
- If the test passes despite the annotation, Playwright reports an unexpected pass, which requires reviewing the annotation.
- An unrelated test or infrastructure failure should not be classified as an expected contract gap.

For the negative-price and missing-first-name scenarios, the reported diagnostics indicate HTTP `200` and `500`, respectively, against an expected set of `[400, 422]`. Keep the strict contract assertions and review the annotations as the API behavior changes.

---

## TypeScript Validation

**Command:**

```bash
npm run typecheck
```

**Final reported result:** Passed. The command exited successfully with no TypeScript errors reported.

---

## Limitations and Follow-up Opportunities

The results apply to the scenarios executed against the public sandbox. They do not establish guarantees beyond the assertions and evidence collected.

Recommended follow-up work:

1. Confirm whether the negative price and missing first name are persisted after their responses.
2. Add response-schema validation against a formal API contract if one is available.
3. Test room-level booking conflicts only if the API exposes room or reservation semantics.
4. Investigate ETags, version identifiers, or documented optimistic-locking behavior before asserting a particular concurrency strategy.
5. Consider stronger test-data isolation in a dedicated environment.
6. Review expected-failure annotations whenever API behavior or test assertions change.

---

## Overall Assessment

The suite covers several high-risk quality concerns beyond happy-path API calls: token lifecycle coordination, bounded authentication retries, invalid-input validation, persisted-state verification, update idempotency, partial-update integrity, concurrent writes, and recovery from missing shared test data.

The approach preserves the intended API contract rather than changing assertions merely to obtain passing tests. Findings distinguish verified responses from broader conclusions that require further evidence.

**Final verification recorded:** `npm test` — 17 passed (including two expected failures managed by `test.fail()`); `npm run typecheck` — passed. If the code changes after this run, rerun both commands and refresh this report.
