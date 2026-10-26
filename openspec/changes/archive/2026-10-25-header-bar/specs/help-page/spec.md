## Purpose

A static in-OS reference so a human holding the device (or an agent describing it) can answer "what is this, what's installed, how do apps get here" without leaving the shell.

## ADDED Requirements

### Requirement: Static Help page in full chrome

The shell SHALL serve a static Help page at `GET /help` in the full shell chrome explaining what the OS is, listing installed apps with links, and documenting how agents add apps via MCP `add_app`. The header SHALL link it as Help immediately after Apps.

#### Scenario: Help lists apps and explains adding
- **WHEN** `/help` is opened with apps installed
- **THEN** it responds 200, lists each installed app with a working link, and describes the agent add flow.
