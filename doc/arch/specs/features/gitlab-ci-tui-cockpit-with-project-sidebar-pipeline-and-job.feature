Feature: GitLab CI TUI cockpit
  As a developer or operator
  I want a terminal multi-pane GitLab CI navigator
  So that I can browse projects, pipelines, jobs, and logs with live status

  Background:
    Given GitLab credentials can be resolved from the environment or glab config
    And the GitLab REST API v4 is reachable at the resolved host

  Scenario: Bootstrap with existing glab auth
    Given valid glab authentication for the configured host
    When the user launches ciview
    Then the project sidebar lists membership projects
    And no authentication error is shown

  Scenario: Reject missing credentials
    Given no GITLAB_TOKEN and no glab token for the host
    When the user launches ciview
    Then ciview reports a clear authentication error
    And it does not enter a tight empty API poll loop

  Scenario: Navigate project to pipelines
    Given the project sidebar shows at least one project with pipelines
    When the user selects that project
    Then the pipelines pane lists pipelines for that project
    And each visible pipeline row includes status and ref

  Scenario: Navigate pipeline to jobs by stage
    Given a pipeline is selected
    When the user opens its jobs
    Then jobs are displayed grouped by stage
    And each job shows a status indicator and name

  Scenario: View job log
    Given a job is selected
    When the detail pane loads the job trace
    Then the log content for that job is visible
    And control characters are sanitized for safe terminal display

  Scenario: Live refresh while running
    Given a selected pipeline or job is in a running state
    When live polling is active
    Then ciview refreshes CI state on the configured interval
    And the UI updates when job status changes from the API

  Scenario: Open resource in browser
    Given a pipeline or job with a web_url is focused
    When the user triggers open-in-browser
    Then the system opens that web_url with the OS default handler

  Scenario: MVP remains read-only
    Given the user navigates projects pipelines and jobs
    When network traffic to GitLab is observed
    Then only read operations required for the CI view are used
    And no job retry cancel or play mutations are issued

  Scenario: Pin project for sidebar priority
    Given the user pins a project
    When ciview restarts
    Then the pinned project appears in the pin section of the sidebar

  Scenario: UI does not block on GitLab I/O
    Given the async job queue and workers are running
    When the user navigates between projects while a load job is in flight
    Then key handling remains responsive
    And GitLab HTTP is performed only inside queue job handlers

  Scenario: Stale job results do not clobber newer selection
    Given a slow LoadPipelines job for project A is in flight
    When the user selects project B and LoadPipelines for B completes first
    Then the pipelines pane shows project B data
    And a late result for project A is discarded

  Scenario: Screen updates via store observers
    Given a job handler finishes LoadJobs successfully
    When the store applies the job result
    Then observers notify the TUI
    And the jobs pane reflects the new data without the handler painting the terminal
