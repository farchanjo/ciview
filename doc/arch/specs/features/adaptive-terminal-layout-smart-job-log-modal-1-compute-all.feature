Feature: Adaptive terminal layout and smart job-log modal
  As a developer using ciview in varied terminal sizes
  I want geometry-aware panes and a smart full-viewport job log
  So that short and tall terminals stay readable and failures are easy to find

  Scenario: Board fits a short terminal without overflow
    Given the terminal is 80 columns by 24 rows
    And a project is open with a multi-stage pipeline
    When the stage board paints
    Then the layout budget status, strip, and board rows do not exceed 24
    And stage column widths fit the usable width

  Scenario: Job log opens as overlay without reflowing the board
    Given a project stage board is visible
    When the user opens a job log
    Then the log is shown as a modal overlay sized by the layout budget
    And the underlying board flex layout does not grow past the terminal

  Scenario: Smart mode parks on first hard error
    Given a job trace that contains a hard error line
    And log mode is smart
    When the user LoadTrace completes
    Then the log viewport is parked near the first hard error
    And noise ranges may appear as ellipsis rows

  Scenario: Cycle log mode and jump errors
    Given the job log modal is open with multiple hard errors
    When the user presses e
    Then log mode cycles among smart, errors, and all
    When the user presses n and then N
    Then the active error hit moves forward and then backward

  Scenario: Close log restores board focus
    Given the job log modal is open
    When the user presses Escape
    Then the log modal closes
    And focus returns to the stage board unless a child pipeline is popped first

  Scenario: Resize recomputes content rows
    Given the job log modal is open
    When the terminal is resized
    Then termWidth and termHeight update
    And log contentRows and maxLineCols come from the new layout budget
    And log scroll is clamped to the new view length
