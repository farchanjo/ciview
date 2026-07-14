# Tasks: Feature 004 — Multi-host GitLab picker

## Task Breakdown

### Spec / gates

- [x] T001 Author feature 004 `spec.md` (FR-60…FR-72), ADR-0006, CUE, Gherkin, keybindings, plan.
- [x] T002 `speckit analyze` + `speckit validate` green before calling implement complete.

### Auth discovery (glab paths + list)

- [x] T003 `resolve.ts`: multi-path `glabConfigCandidates` (GLAB_CONFIG_DIR, XDG, ~/.config, darwin Application Support).
- [x] T004 `listAuthenticatedHosts`, `findHostOption`, `hostKey`, `resolveAuth(preferredHost)`.
- [x] T005 Unit tests for candidates order + list/find via `GLAB_CONFIG_DIR` temp fixture (tokens redacted in asserts).

### Prefs + client

- [x] T006 `Prefs.gitlabHost` load/save (hostname only, no token).
- [x] T007 `GitLabClient.setAuth` for mid-session switch.
- [x] T008 `SavePrefs` handler includes `gitlabHost`.
- [x] T009 Update test `basePrefs` fixtures with `gitlabHost: null`.

### State + switch helper

- [x] T010 Chrome: `hostPickerOpen`, `hostPickerCursor`, `hostPickerRequired`.
- [x] T011 Helper `applyGitlabHost` / `switchHost`: setAuth, session, clear entities, SavePrefs, LoadProjects.

### UI + bootstrap

- [x] T012 `HostPickerOverlay.tsx` absolute modal (j/k, Enter, 1–9, Esc if not required).
- [x] T013 `main.tsx`: list hosts → 0 error / 1 silent / ≥2 saved or required picker; LoadProjects only when bound.
- [x] T014 `App.tsx`: picker key capture; `H` opens when hosts.length ≥ 2; wire confirm/cancel.
- [x] T015 `keys.ts` + STATUS_HINT: document `H` host switch (multi-host).

### Integration / polish

- [x] T016 Auto-save `gitlabHost` when single host or first confirm.
- [x] T017 `bun test`, `bun run typecheck`, `speckit validate` green.
- [ ] T018 Manual smoke: single-host skip; multi-host first pick; relaunch restore; `H` switch (operator).

## Order

T001 → T002 → T003–T005 → T006–T009 → T010–T011 → T012–T016 → T017 → T018.

## Dependencies

- Features 001–003 implemented (glab auth, prefs, overlays).
- OpenTUI absolute positioning for HostPickerOverlay.
