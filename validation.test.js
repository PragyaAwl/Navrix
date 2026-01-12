const fc = require('fast-check');
const { validateEntry } = require('./validation');

describe('Entry Validation Property Tests', () => {
  
  /**
   * Feature: data-sync-fix, Property 3: Data Validation Consistency
   * For any entry that passes validation, it should have at least one non-empty identifier field (startup name or submission ID)
   * Validates: Requirements 2.2, 2.3
   */
  test('Property 3: Data Validation Consistency - valid entries must have identifiers', () => {
    fc.assert(
      fc.property(
        // Generate entries with at least one valid identifier
        fc.record({
          name_of_the_startup: fc.oneof(
            fc.string({ minLength: 1 }).filter(s => s.trim() !== '' && s.trim().toLowerCase() !== 'n/a'),
            fc.constant(undefined),
            fc.constant(null),
            fc.constant('')
          ),
          submission_id: fc.oneof(
            fc.string({ minLength: 1 }).filter(s => s.trim() !== '' && s.trim().toLowerCase() !== 'n/a'),
            fc.constant(undefined),
            fc.constant(null),
            fc.constant('')
          ),
          // Add some additional fields to ensure the entry has meaningful data
          scores: fc.oneof(fc.float(), fc.string(), fc.constant(null), fc.constant(undefined)),
          founder_s__name: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)),
          submitted_at: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)),
          // Add random additional fields
          extra_field1: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)),
          extra_field2: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined))
        }),
        (entry) => {
          const isValid = validateEntry(entry);
          
          if (isValid) {
            // If entry is valid, it must have at least one valid identifier
            const hasValidStartupName = entry.name_of_the_startup && 
              typeof entry.name_of_the_startup === 'string' && 
              entry.name_of_the_startup.trim() !== '' && 
              entry.name_of_the_startup.trim().toLowerCase() !== 'n/a';
            
            const hasValidSubmissionId = (entry.submission_id || entry.submission__id) && 
              typeof (entry.submission_id || entry.submission__id) === 'string' && 
              (entry.submission_id || entry.submission__id).trim() !== '' && 
              (entry.submission_id || entry.submission__id).trim().toLowerCase() !== 'n/a';
            
            // Valid entries must have at least one identifier
            return hasValidStartupName || hasValidSubmissionId;
          }
          
          // If entry is invalid, the property is trivially satisfied
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Invalid entries should be rejected consistently
   * Tests the inverse - entries without valid identifiers should be rejected
   */
  test('Property 3b: Invalid entries without identifiers are rejected', () => {
    fc.assert(
      fc.property(
        // Generate entries that definitely lack valid identifiers
        fc.record({
          name_of_the_startup: fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.constant('   '),
            fc.constant('n/a'),
            fc.constant('N/A')
          ),
          submission_id: fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.constant('   '),
            fc.constant('n/a'),
            fc.constant('N/A')
          ),
          // Add some fields that might have data
          scores: fc.oneof(fc.float(), fc.string(), fc.constant(null)),
          founder_s__name: fc.oneof(fc.string(), fc.constant(null))
        }),
        (entry) => {
          const isValid = validateEntry(entry);
          // Entries without valid identifiers should be invalid
          return !isValid;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property test: Entries with only empty/null values should be rejected
   */
  test('Property 3c: Entries with insufficient meaningful data are rejected', () => {
    fc.assert(
      fc.property(
        // Generate entries with valid identifiers but insufficient other data
        fc.record({
          name_of_the_startup: fc.string({ minLength: 1 }).filter(s => s.trim() !== '' && s.trim().toLowerCase() !== 'n/a'),
          // All other fields are empty/null
          submission_id: fc.constant(null),
          scores: fc.constant(null),
          founder_s__name: fc.constant(''),
          submitted_at: fc.constant(undefined),
          extra_field: fc.constant('n/a')
        }),
        (entry) => {
          const isValid = validateEntry(entry);
          
          // Count non-empty fields
          const allFields = Object.values(entry);
          const nonEmptyFields = allFields.filter(value => 
            value !== null && 
            value !== undefined && 
            value !== '' && 
            String(value).trim() !== '' &&
            String(value).trim().toLowerCase() !== 'n/a'
          );
          
          // If there are fewer than 2 non-empty fields, entry should be invalid
          if (nonEmptyFields.length < 2) {
            return !isValid;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

});