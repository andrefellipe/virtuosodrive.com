## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-27T03:08:02Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | docs/operations.md > section 5 "Use it" (the sentence "without it, pressing Continue sends nothing of what was typed and does not let you in") | The sentence is true of the password, but the code summary itself lists as unverified that the page's cache behaviour allows only GET and HEAD (infra/modules/edge/main.tf, default_cache_behavior allowed_methods). A plain POST may therefore get CloudFront's own "method not allowed" error page, not the password page. The procedure says nothing of that, and the person would not know what they are looking at. | After the first run at the real edge, record what a plain POST shows and add one sentence to the procedure. Until then say "an error page or the password page again". | New |
| R-02 | Minor | e2e/tests/thin-slice.spec.ts > watchForBlockedContent, console listener (about line 163) | The console filter matches only text containing "content security policy" (also with a hyphen). The securitypolicyviolation listener from the init script is the real catch and covers all three engines, so this is only a second net. A blocked script in an engine whose message words it differently is still caught by the listener. | Optional. Leave as is, or also record console errors whose text names `access-password.js` or `.css`. | New |
| R-03 | Minor | edge/src/gate.ts > handleRequest, the two new path checks (lines 178-184) | The two paths are answered before the cookie check, so anyone can invoke the function for them. The files are about 1 KB and hold nothing secret, like the health check. Each request is still a function invocation billed by the edge. | None needed at this scale. Note it in the cost review if the request count is ever watched. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npx vitest run edge scripts` | PASS, 6 files, 65 tests | The gate's new tests and the build-and-run test all pass. |
| `npx eslint edge scripts e2e` | no output (clean) | No lint errors, including on the removed fingerprint code. |
| `npx prettier --check edge scripts e2e docs/operations.md` | all files formatted | Formatting holds. |
| `npx tsc -p scripts --noEmit`, `npx tsc -p e2e --noEmit` | no errors | The scripts project builds without `edge/src/password-page.ts` in its include list. |
| Built gate `dist/edge/access-gate.js` (present on disk, not rebuilt) | 6377 bytes, limit 10240; contains `access-password.js`; exactly two placeholders, `__VD_GATE_ENABLED__` and `__VD_ACCESS_HASH__` | Within the size limit with room, and the fingerprint placeholders are gone. |
| grep for `SCRIPT_HASH`, `STYLE_HASH`, `scriptHash`, `styleHash` across edge, scripts, infra, e2e, docs, .github | no hits | The fingerprint machinery is fully removed. The `tests/fixtures/access-gate.txt` stand-in lists only the two live placeholders. |

### Answers to the nine questions

1. **Will it work at the real edge? Very likely, with these checks.**
   - Both new paths fall under `default_cache_behavior` (infra/modules/edge/main.tf:378). Only `/v1/*` is ordered ahead of it, and the viewer-request gate is attached to both behaviours, so the gate sees `/access-password.js` and `/access-password.css`.
   - The edge's pages policy (`local.content_security_policy`, main.tf:62) allows `script-src 'self'` and `style-src 'self'`, so it permits both files. The gate's own `REFUSAL_POLICY` also does (gate.ts:607). `form-action 'self'` in the edge's policy matters only if the script fails, and the script calls `preventDefault`.
   - The response headers policy sets `nosniff` with `override = true`. It adds the same header the gate already sets. Neither the content type nor `cache-control` is among its headers.
   - A function-generated 200 with `body: {encoding: "text", data}` is valid for `cloudfront-js-2.0` (main.tf:224). The bodies are about 1 KB, far under the limit on a generated response (documented as 40 KB, not re-checked here).
   - The script is `defer` and the form exists by then. `location.replace(location.pathname)` drops the query and re-requests the same path with the cookie. The cookie `vd_access; Max-Age; Path=/; Secure; SameSite=Strict` is first-party and set over https.
2. **Runtime subset and size.** The gate code stays plain (strings, comparisons, an object literal). esbuild targets es2019 as before. The built file is 6377 bytes against 10240. The page is not inlined any more, so the size margin grew.
3. **Leaks.**
   - Address: the form is `method="post"`, the field has no `name`, and the script ends with `location.replace(location.pathname)`.
   - Request body: a plain POST has an empty body.
   - Logs: the two paths write no log line, and the refusal log holds no query, cookie or header.
   - The two files: unit and end-to-end tests assert neither the password nor its hash is in them.
   - One residue: `document.cookie` holds the plain password for 30 days. That is the existing design and unchanged here.
4. **Do the paths open anything?** No. Matching is exact on `request.uri`, which excludes the query string in CloudFront Functions. Tests refuse `.map`, a prefixed folder, `/v1/...`, upper case and a trailing slash. With the flag off the paths go through `letThrough`, which rewrites a non-file path to the entry document. These two names count as files, so they go to the origin and get 403 or 404. That is harmless and the password page is not shown then. `/v1` is untouched.
5. **End-to-end tests.**
   - The first test would have failed against the old page. With the script blocked under the edge's policy, a plain GET reloaded the 401 page, so `expectAnsweredView` (title "Virtuoso Drive") could not pass. The `securitypolicyviolation` listener would also have recorded the block.
   - The wait for the reload's response in the wrong-password test is sound. `nextDocument` is armed before the click and filters on a main-frame navigation. `location.replace` to a different URL (the query is dropped) or to the same one both produce a navigation in all three engines.
   - The init script plus `exposeFunction` is set up before `goto`. I see no flakiness beyond a deployed site's normal.
   - Pipeline: `.github/actions/deploy/action.yml` reads the parameter after `terraform apply` (lines 101-115), so the tests get the new password. `terraform_data.access_password_version` triggers replacement of the parameter (infra/environment/main.tf:24-40). The gate's hash is computed from the same parameter value (main.tf:126) in the same plan, so the function is updated in the same apply.
6. **Unit tests.** Meaningful. The exact `toEqual` on headers would fail on a wrong content type. The check for one empty script element and no style element would fail on inline content. The paths-and-resemblances test would fail on a missing or loose path. The build test runs the real built gate in a VM and fetches the two files it names.
7. **Fingerprints.** Fully removed; see the grep above. `writeFileSync` is still used elsewhere in build.ts.
8. **docs/operations.md.** Accurate against the code: parameter name, 30-day cookie, `access_password_version`, same-run redeploy. The one gap is the first minor finding.
9. **Project rules.** No new plain JavaScript source file, no `innerHTML`, no CDN, no secrets. Test passwords are made-up placeholders, and the tfvars comment names no person.

### Summary

The change addresses the cause. The two files are served by the gate at paths the existing pages behaviour reaches, under both policies, with exact content types, and nothing typed can reach the address or a log. Unit, lint, type and format checks pass here. READY, with three minor points.

What cannot be known until the pipeline runs at the real edge:

- Whether CloudFront accepts the changed function at publish.
- Whether the response headers policy and compression leave the two generated responses' content type and `cache-control` untouched. The end-to-end test asserts both.
- What a plain POST shows, given the page's behaviour allows only GET and HEAD.
- Whether the three-engine run passes, including cookie flags in WebKit.
- Whether a password manager fills a nameless field.
