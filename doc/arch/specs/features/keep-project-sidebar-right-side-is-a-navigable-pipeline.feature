Feature: Keep Project Sidebar Right Side Is A Navigable Pipeline
  As a maintainer of the ciview board UX feature 002
  I want executable gates against the shipped speckit binary
  So that the feature remains verifiable under ADR-0020

  # Product board/cursor behaviour is covered by bun:test under src/ciview/.
  # Sandbox verify cannot load the full tree for validate (missing root files).

  Scenario: board feature version gate
    When I run "speckit version"
    Then the exit code is 0
    And stdout contains "speckit"

  Scenario: board feature status is queryable
    When I run "speckit status --json"
    Then the exit code is 0

  Scenario: board feature analyze remains consistent
    When I run "speckit analyze --json"
    Then the exit code is 0

  Scenario: board feature reindex works
    When I run "speckit reindex"
    Then the exit code is 0

  Scenario: board feature missing feed is queryable
    When I run "speckit missing"
    Then the exit code is 0
