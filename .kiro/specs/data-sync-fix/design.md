# Design Document: Data Sync Fix

## Overview

This design addresses the data synchronization issue in the Navrix Dashboard where deleted Google Sheets entries persist as "Unnamed Startup" records. The solution implements a complete data refresh strategy that rebuilds all categories from scratch every 30 seconds, ensuring the dashboard always reflects the current state of Google Sheets.

## Architecture

The current architecture fetches data and updates existing dashboard state incrementally. The new approach will:

1. **Complete State Reset**: Clear all category data before processing new data
2. **Fresh Data Processing**: Parse and categorize only current Google Sheets entries  
3. **Atomic Updates**: Update the entire dashboard state in one operation
4. **State Preservation**: Maintain UI state (current view) during refresh

## Components and Interfaces

### Modified Components

#### 1. Data Fetching Layer (`fetchSheetData`)
- **Current**: Returns parsed entries, relies on existing state management
- **New**: Returns complete dataset for full state replacement
- **Interface**: `Promise<Entry[]>` - clean array of current entries only

#### 2. Dashboard State Manager (`updateDashboard`)
- **Current**: Merges new data with existing state
- **New**: Completely replaces dashboard state with fresh data
- **Interface**: 
  ```javascript
  updateDashboard(entries: Entry[]): {
    platinum: Entry[],
    gold: Entry[],
    silver: Entry[],
    unreviewed: Entry[]
  }
  ```

#### 3. Data Validation Layer (New)
- **Purpose**: Validate entries before categorization
- **Interface**: `validateEntry(entry: Entry): boolean`
- **Rules**: 
  - Must have startup name or submission ID
  - Must have valid data structure
  - Skip entries with all empty/null required fields

#### 4. UI State Preservation (New)
- **Purpose**: Maintain current view during refresh
- **Interface**: `preserveUIState(): UIState` and `restoreUIState(state: UIState)`
- **State**: Current category view, scroll position, selected entry

### Data Flow

```
Every 30 seconds:
1. Preserve current UI state
2. Fetch fresh data from Google Sheets
3. Validate each entry
4. Clear existing dashboard data
5. Categorize valid entries into new state
6. Update UI with new data
7. Restore UI state if still valid
```

## Data Models

### Entry Validation Rules
```javascript
interface ValidEntry {
  // Required: At least one identifier
  name_of_the_startup?: string;
  submission_id?: string;
  
  // Optional but validated if present
  scores?: number;
  founder_s__name?: string;
  submitted_at?: string;
  
  // Must not be all empty/null
  hasValidData: boolean;
}
```

### Dashboard State
```javascript
interface DashboardState {
  platinum: ValidEntry[];
  gold: ValidEntry[];
  silver: ValidEntry[];
  unreviewed: ValidEntry[];
  lastUpdated: Date;
  isLoading: boolean;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Now I need to analyze the acceptance criteria to determine which ones can be tested as properties:

### Converting EARS to Properties

Based on the prework analysis, I'll focus on the most critical properties that ensure data consistency and correct categorization:

**Property 1: Data Source Consistency**
*For any* dataset from Google Sheets, the dashboard should display exactly those entries and no others - no stale entries, no missing entries
**Validates: Requirements 1.2, 2.1**

**Property 2: Category Assignment Correctness**
*For any* entry with a valid score, it should appear in exactly one category based on its score value (Platinum: 85-100, Gold: 70-84, Silver: 0-69, Unreviewed: no score)
**Validates: Requirements 1.3, 1.4**

**Property 3: Data Validation Consistency**
*For any* entry that passes validation, it should have at least one non-empty identifier field (startup name or submission ID)
**Validates: Requirements 2.2, 2.3**

**Property 4: Count Accuracy**
*For any* dashboard state, the sum of displayed counts should equal the total number of valid entries, and each category count should match its actual entry list length
**Validates: Requirements 3.3**

**Property 5: State Independence**
*For any* two identical datasets processed at different times, the resulting dashboard state should be identical regardless of previous state
**Validates: Requirements 3.2**

**Property 6: Entry Display Completeness**
*For any* entry displayed in a category, all its non-empty fields should be rendered correctly without "N/A" placeholders for existing data
**Validates: Requirements 2.4**

## Error Handling

### Network Failures
- **Fetch Timeout**: 10-second timeout for Google Sheets requests
- **Retry Strategy**: Continue with existing data, retry on next cycle
- **User Feedback**: Update connection status indicator

### Data Parsing Errors
- **Malformed CSV**: Log error, use previous successful data
- **Invalid Entries**: Skip invalid entries, process valid ones
- **Empty Response**: Treat as empty dataset, clear all categories

### Validation Failures
- **Missing Required Fields**: Skip entry, log warning
- **Invalid Score Values**: Treat as unreviewed category
- **Corrupted Data**: Skip entry, continue processing

## Testing Strategy

### Unit Tests
- Test entry validation logic with various data combinations
- Test categorization function with edge cases (boundary scores)
- Test CSV parsing with malformed data
- Test error handling scenarios

### Property-Based Tests
- Generate random datasets and verify consistency properties
- Test categorization with random score values
- Verify count accuracy with random entry distributions
- Test state independence with identical datasets

**Property Test Configuration:**
- Use fast-check library for JavaScript property testing
- Run minimum 100 iterations per property test
- Each test tagged with: **Feature: data-sync-fix, Property {number}: {property_text}**

### Integration Tests
- Test complete sync cycle with mock Google Sheets data
- Test UI state preservation during refresh
- Test error scenarios with network failures
- Test real-time updates with changing data

The testing approach ensures both specific edge cases (unit tests) and general correctness across all possible inputs (property tests) are validated.