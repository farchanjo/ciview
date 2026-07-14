Feature: Gitlab Ci Tui Cockpit With Project Sidebar Pipeline And Job
  As a maintainer of the ciview SDD corpus for feature 001
  I want executable gates against the shipped speckit binary
  So that the feature remains verifiable under ADR-0020

  # Product behaviour (UI/API) is covered by bun:test under src/ciview/.
  # These scenarios bind to the native verify grammar (dogfood steps).

  Scenario: speckit version is callable
    When I run "speckit version"
    Then the exit code is 0
    And stdout contains "speckit"

  Scenario: status reports the feature system
    When I run "speckit status"
    Then the exit code is 0

  Scenario: analyze is consistent
    When I run "speckit analyze"
    Then the exit code is 0

  Scenario: feature list is available
    When I run "speckit feature list"
    Then the exit code is 0

  Scenario: reindex rebuilds the control-plane mirror
    When I run "speckit reindex"
    Then the exit code is 0
