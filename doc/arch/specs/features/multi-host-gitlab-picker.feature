Feature: Multi-host GitLab picker
  As a developer with one or more glab-authenticated GitLab instances
  I want ciview to bind the right host automatically or via a picker
  So that I see the correct membership projects without re-authenticating

  Scenario: Single authenticated host skips the picker
    Given glab config has exactly one host with a token
    When the user starts ciview
    Then auth resolves to that host
    And the host picker modal is not shown
    And projects load for that host

  Scenario: Multiple hosts without saved preference open required picker
    Given glab config has two or more hosts with tokens
    And prefs gitlabHost is unset or invalid
    When the user starts ciview
    Then the host picker modal is open and required
    And projects are not loaded until the operator confirms a host

  Scenario: Multiple hosts with saved preference skip the picker
    Given glab config has two or more hosts with tokens
    And prefs gitlabHost matches one authenticated host
    When the user starts ciview
    Then auth resolves to the saved host without showing the picker
    And projects load for that host

  Scenario: Switch host mid-session with H
    Given a multi-host session is already bound to host A
    When the user presses H
    And selects host B and presses Enter
    Then session host becomes host B
    And prefs gitlabHost is saved as host B
    And project and pipeline state is cleared
    And projects reload for host B

  Scenario: macOS Application Support glab config is discovered
    Given glab config.yml exists under Library Application Support glab-cli
    And ~/.config/glab-cli/config.yml is missing
    When ciview resolves glab auth
    Then hosts from Application Support are used

  Scenario: No token hosts exits with auth failure
    Given glab is installed but no host has a token
    When the user starts ciview
    Then the process exits with code 2
    And authenticate fix steps are printed
