# Tic-tac-toe game (single player)

## Purpose

A simple single-player reference game — human vs. random computer — proving a bundle can carry interactive behavior the operator model cannot express. No server state, no roster, no sessions.

## ADDED Requirements

### Requirement: Playable solo game
The bundle SHALL render a 3×3 board where the human (X, first move) taps an empty cell and the computer (O) replies with a uniform random empty cell. Win and draw SHALL be detected against the 8 lines after every move and announced in a status line. New Game SHALL reset to an empty board.

#### Scenario: Full game completes
- **WHEN** a human plays any legal sequence to termination
- **THEN** each human move is followed by a computer reply, and the game ends with a correct win/draw announcement.

#### Scenario: Illegal moves fail soft
- **WHEN** the human taps a taken cell or taps after game over
- **THEN** the board is unchanged and the status line says why.
