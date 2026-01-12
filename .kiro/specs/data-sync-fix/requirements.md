# Requirements Document

## Introduction

Fix the data synchronization issue in the Navrix Startup Dashboard where deleted entries from Google Sheets continue to appear as "Unnamed Startup" with "N/A" data instead of being properly removed from the dashboard display.

## Glossary

- **Dashboard**: The main web interface displaying startup submission categories
- **Google_Sheets**: The external data source containing startup submissions
- **Entry**: A single startup submission record
- **Category**: One of four classification groups (Platinum, Gold, Silver, Unreviewed)
- **Sync_Cycle**: The 30-second interval for data refresh
- **Stale_Data**: Outdated information that no longer exists in the source

## Requirements

### Requirement 1: Real-time Data Synchronization

**User Story:** As a dashboard user, I want the display to always reflect the current state of Google Sheets, so that I don't see outdated or deleted entries.

#### Acceptance Criteria

1. WHEN the sync cycle runs every 30 seconds, THE Dashboard SHALL fetch fresh data from Google_Sheets
2. WHEN entries are deleted from Google_Sheets, THE Dashboard SHALL remove them from all categories immediately on next sync
3. WHEN new entries are added to Google_Sheets, THE Dashboard SHALL display them in the appropriate category on next sync
4. WHEN entry scores are modified in Google_Sheets, THE Dashboard SHALL move entries between categories as needed on next sync

### Requirement 2: Clean Data Display

**User Story:** As a dashboard user, I want to see only valid entries with proper data, so that I don't encounter "Unnamed Startup" or "N/A" placeholders for deleted records.

#### Acceptance Criteria

1. THE Dashboard SHALL display only entries that currently exist in Google_Sheets
2. WHEN an entry lacks required data fields, THE Dashboard SHALL handle it gracefully without showing "Unnamed Startup"
3. THE Dashboard SHALL validate entry data before displaying it in any category
4. WHEN displaying entry cards, THE Dashboard SHALL show actual field values or skip missing optional fields

### Requirement 3: Complete Data Refresh

**User Story:** As a dashboard administrator, I want the system to completely rebuild the category data every sync cycle, so that no stale data persists between refreshes.

#### Acceptance Criteria

1. WHEN each sync cycle begins, THE Dashboard SHALL clear all existing category data
2. WHEN processing fresh Google_Sheets data, THE Dashboard SHALL rebuild all categories from scratch
3. WHEN the rebuild is complete, THE Dashboard SHALL update all category counts accurately
4. THE Dashboard SHALL maintain UI state (current view, selected category) during data refresh

### Requirement 4: Error Handling and Fallback

**User Story:** As a dashboard user, I want the system to handle data fetch errors gracefully, so that the dashboard remains functional even when Google Sheets is temporarily unavailable.

#### Acceptance Criteria

1. WHEN Google_Sheets is unavailable, THE Dashboard SHALL retain the last successfully fetched data
2. WHEN data parsing fails, THE Dashboard SHALL log the error and continue with existing data
3. WHEN network errors occur, THE Dashboard SHALL indicate connection status to users
4. THE Dashboard SHALL retry failed requests on the next sync cycle