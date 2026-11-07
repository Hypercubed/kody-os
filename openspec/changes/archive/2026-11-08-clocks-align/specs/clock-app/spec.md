# clock-app Specification

## ADDED Requirements

### Requirement: Clock app shows local time and date, ticking on the minute boundary

The Clock catalog app SHALL show the device-local time in 12-hour format with an AM/PM suffix and the current date, and SHALL update its display exactly at each wall-clock minute boundary.

#### Scenario: Clock shows 12-hour local time and date
- **WHEN** the Clock app renders
- **THEN** the time reads as 12-hour local time with an AM/PM suffix (for example "3:05 PM") and the date reads as the weekday, month, and day (for example "Saturday, November 7")

#### Scenario: Clock flips exactly at the minute boundary
- **WHEN** a wall-clock minute boundary passes while the Clock app is open
- **THEN** the Clock app shows the new minute immediately, matching the shell header clock (which ticks every second in local time)

#### Scenario: Clock keeps the 60-second cadence
- **WHEN** the Clock app is open
- **THEN** it re-renders at most once per minute (a 60-second interval), not every second, keeping the battery-friendly cadence for e-ink
