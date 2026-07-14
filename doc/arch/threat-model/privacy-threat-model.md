# Privacy Threat Model (LINDDUN)

Privacy threats for people whose data ciview may display (GitLab users,
commit authors) when a local operator runs the TUI against a GitLab instance.

| ID | Category | Threat | Affected Data | Mitigation |
|----|----------|--------|---------------|------------|
| PT-01 | linking | correlating multiple projects' pipeline actors into a personal activity profile on the operator machine | usernames, pipeline timestamps across projects | no durable cross-project analytics DB in MVP; session memory only; pins store project paths not people graphs |
| PT-02 | identifying | displaying commit author name/email from job/pipeline payloads on screen | commit author name and email | show only what GitLab API returns for authorized viewers; no extra identity enrichment |
| PT-03 | non-repudiation | local logs attributing “who viewed which job log” without purpose | operator actions, job ids | MVP logs avoid personal subject dossiers; no mandatory view audit trail of other users |
| PT-04 | detecting | presence of private projects inferred from sidebar if screen shared | project paths, visibility | operator responsibility for screen sharing; no public export of membership list |
| PT-05 | data-disclosure | job trace may contain secrets accidentally printed in CI logs | job trace text, env leaks in logs | do not upload traces to third parties; no cloud sync; clipboard copy is explicit user action only if implemented |
| PT-06 | unawareness | developers unaware their CI identity appears in a colleague's local TUI | GitLab profile fields on pipeline/job | data already visible to same GitLab authorization; ciview does not expand audience beyond token scope |
| PT-07 | non-compliance | storing PATs or traces in the git repo or shared config | tokens, traces | tokens only via env/glab; `.env` gitignored; never commit traces; document least-privilege `read_api` |
