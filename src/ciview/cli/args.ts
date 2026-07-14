export interface CliArgs {
  help: boolean;
  project: string | null;
  fromGit: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  let help = false;
  let project: string | null = null;
  let fromGit = false;

  for (const a of args) {
    if (a === "-h" || a === "--help") help = true;
    else if (a === ".") fromGit = true;
    else if (!a.startsWith("-")) project = a;
  }

  return { help, project, fromGit };
}

export const HELP_TEXT = `ciview — GitLab CI cockpit (terminal)

Usage:
  ciview                 Open dashboard (membership projects)
  ciview .               Focus project from git remote origin
  ciview group/project   Focus path/with/namespace

Auth (glab only):
  ciview always reads credentials from glab.
  If glab is missing or not logged in you will get fix steps:

    1) Install:   brew install glab
    2) Login:     glab auth login
                  glab auth status

Keys (press ? in the app for full help):
  ?:help  H:host (multi)  s:sidebar  Tab:pane  j/k  Enter  r:refresh  R:live  o:open  q:quit

Multi-host (glab):
  1 authenticated host  → opens on that host (no picker)
  2+ hosts              → picker on first run; prefs remember choice; H to switch
`;
