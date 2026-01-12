# Implementation Plan: Data Sync Fix

## Overview

This implementation plan converts the data sync fix design into discrete coding tasks that will eliminate the "Unnamed Startup" issue by implementing complete data refresh every 30 seconds.

## Tasks

- [x] 1. Implement entry validation system
  - Create `validateEntry()` function to check for required fields
  - Add validation rules for startup name and submission ID
  - Handle edge cases for empty/null values
  - _Requirements: 2.2, 2.3_

- [ ] 1.1 Write property test for entry validation

  - **Property 3: Data Validation Consistency**
  - **Validates: Requirements 2.2, 2.3**

- [x] 2. Refactor dashboard state management
  - [x] 2.1 Modify `updateDashboard()` to clear existing state first
    - Clear all category arrays before processing new data
    - Implement atomic state replacement
    - _Requirements: 3.1, 3.2_

  - [x] 2.2 Add complete data rebuild logic
    - Process only validated entries
    - Rebuild categories from scratch each cycle
    - _Requirements: 3.2_

- [ ]* 2.3 Write property test for state independence
  - **Property 5: State Independence**
  - **Validates: Requirements 3.2**

- [ ]* 2.4 Write property test for data source consistency
  - **Property 1: Data Source Consistency**
  - **Validates: Requirements 1.2, 2.1**

- [x] 3. Enhance categorization logic
  - [x] 3.1 Update `categorizeEntry()` with validation
    - Add pre-validation before categorization
    - Handle entries with invalid scores
    - _Requirements: 1.3, 1.4_

  - [x] 3.2 Implement accurate count tracking
    - Ensure counts match actual entry arrays
    - Update count display after each refresh
    - _Requirements: 3.3_

- [ ]* 3.3 Write property test for category assignment
  - **Property 2: Category Assignment Correctness**
  - **Validates: Requirements 1.3, 1.4**

- [ ]* 3.4 Write property test for count accuracy
  - **Property 4: Count Accuracy**
  - **Validates: Requirements 3.3**

- [x] 4. Checkpoint - Ensure core logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Improve entry display rendering
  - [x] 5.1 Update `createEntryCard()` function
    - Skip rendering fields with no valid data
    - Remove "N/A" placeholders for missing optional fields
    - Show only actual field values
    - _Requirements: 2.4_

  - [x] 5.2 Add graceful handling for missing data
    - Handle entries without startup names properly
    - Use submission ID as fallback identifier
    - _Requirements: 2.2_

- [ ]* 5.3 Write property test for entry display
  - **Property 6: Entry Display Completeness**
  - **Validates: Requirements 2.4**

- [x] 6. Add UI state preservation
  - [x] 6.1 Implement state preservation functions
    - Create `preserveUIState()` and `restoreUIState()` functions
    - Store current category view and scroll position
    - _Requirements: 3.4_

  - [x] 6.2 Integrate state preservation with refresh cycle
    - Preserve state before data refresh
    - Restore state after successful update
    - _Requirements: 3.4_   

- [ ]* 6.3 Write unit tests for UI state preservation
  - Test state save and restore functionality
  - _Requirements: 3.4_

- [x] 7. Enhance error handling
  - [x] 7.1 Improve network error handling
    - Add better connection status indicators
    - Implement graceful fallback to previous data
    - _Requirements: 4.1, 4.3_

  - [x] 7.2 Add data parsing error handling
    - Handle malformed CSV data gracefully
    - Log errors without breaking the dashboard
    - _Requirements: 4.2_

- [ ]* 7.3 Write unit tests for error scenarios
  - Test network failures and parsing errors
  - Test connection status updates
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 8. Integration and testing
  - [x] 8.1 Update main refresh cycle
    - Integrate all new functions into `loadDashboard()`
    - Ensure 30-second refresh works with new logic
    - _Requirements: 1.1_

  - [x] 8.2 Test complete sync cycle
    - Verify end-to-end functionality
    - Test with various data scenarios
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ]* 8.3 Write integration tests
  - Test complete refresh cycle with mock data
  - Test data changes and UI updates
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation focuses on eliminating stale data by rebuilding state completely every refresh cycle