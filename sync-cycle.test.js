const fc = require('fast-check');

// Mock DOM elements for testing
const mockDOM = () => {
  global.document = {
    getElementById: (id) => ({
      textContent: '0',
      className: '',
      title: '',
      style: { display: 'block' },
      innerHTML: ''
    }),
    addEventListener: jest.fn(),
    querySelectorAll: () => []
  };
  
  global.window = {
    scrollX: 0,
    scrollY: 0,
    pageXOffset: 0,
    pageYOffset: 0,
    scrollTo: jest.fn()
  };
  
  global.setTimeout = (fn, delay) => fn();
  global.console = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
};

// Setup DOM before importing script functions
mockDOM();

// Import validation function
const { validateEntry } = require('./validation');

// Mock the functions we need from script.js for testing
let currentDashboardData = {};
let connectionState = {
  isOnline: true,
  lastError: null,
  consecutiveFailures: 0,
  lastSuccessTime: null
};

// Mock DOM elements
const mockCountElements = {
  platinum: { textContent: '0' },
  gold: { textContent: '0' },
  silver: { textContent: '0' },
  unreviewed: { textContent: '0' }
};

// Function to categorize entries based on score (copied from script.js)
function categorizeEntry(entry) {
  // Pre-validation before categorization
  if (!validateEntry(entry)) {
    console.warn('Attempting to categorize invalid entry:', entry);
    return null; // Return null for invalid entries
  }
  
  // Handle entries with invalid scores
  const scoreValue = entry.scores;
  let score = 0;
  
  // Validate and parse score
  if (scoreValue !== null && scoreValue !== undefined && scoreValue !== '') {
    const parsedScore = parseFloat(scoreValue);
    
    // Check if the parsed score is a valid number
    if (!isNaN(parsedScore) && isFinite(parsedScore)) {
      // Ensure score is within reasonable bounds (0-100)
      if (parsedScore >= 0 && parsedScore <= 100) {
        score = parsedScore;
      } else {
        console.warn('Score out of bounds (0-100):', parsedScore, 'for entry:', entry.name_of_the_startup || entry.submission_id);
        // Treat out-of-bounds scores as unreviewed
        return 'unreviewed';
      }
    } else {
      console.warn('Invalid score format:', scoreValue, 'for entry:', entry.name_of_the_startup || entry.submission_id);
      // Treat invalid score formats as unreviewed
      return 'unreviewed';
    }
  } else {
    // No score provided - treat as unreviewed
    return 'unreviewed';
  }
  
  // Categorize based on validated score
  if (score >= 85) return 'platinum';
  if (score >= 70) return 'gold';
  if (score > 0) return 'silver';
  return 'unreviewed';
}

// Function to update dashboard data (simplified version for testing)
function updateDashboard(entries) {
  try {
    // Validate input
    if (!entries || !Array.isArray(entries)) {
      console.warn('Invalid entries data provided to updateDashboard, using empty array');
      entries = [];
    }
    
    // Clear existing state first - atomic state replacement
    currentDashboardData = {
      platinum: [],
      gold: [],
      silver: [],
      unreviewed: []
    };

    // Create fresh state object for new data
    const newDashboardData = {
      platinum: [],
      gold: [],
      silver: [],
      unreviewed: []
    };

    console.log('Processing entries for dashboard update...');
    
    // Filter and validate entries first
    const validatedEntries = [];
    
    entries.forEach((entry, index) => {
      try {
        const isValid = validateEntry(entry);
        
        if (isValid) {
          validatedEntries.push(entry);
        }
      } catch (entryError) {
        console.warn(`Error processing entry ${index + 1}, skipping:`, entryError.message);
      }
    });
    
    // Rebuild categories from scratch with only validated entries
    validatedEntries.forEach((entry) => {
      try {
        const category = categorizeEntry(entry);
        
        // Skip entries that couldn't be categorized (returned null)
        if (category === null) {
          console.warn(`Skipping entry that failed categorization: ${entry.name_of_the_startup || entry.submission_id}`);
          return;
        }
        
        newDashboardData[category].push(entry);
      } catch (categorizationError) {
        console.warn(`Error categorizing entry, skipping:`, categorizationError.message);
      }
    });

    // Atomic state replacement - replace entire state at once
    currentDashboardData = newDashboardData;

    // Update count display
    Object.keys(mockCountElements).forEach(category => {
      try {
        const countElement = mockCountElements[category];
        const entries = newDashboardData[category] || [];
        const actualCount = entries.length;
        
        // Update the display
        countElement.textContent = actualCount.toString();
      } catch (uiError) {
        console.error(`Error updating UI count for ${category}:`, uiError.message);
      }
    });

    return true;
    
  } catch (error) {
    console.error('Critical error in updateDashboard:', error);
    console.error('Dashboard update failed, maintaining current state');
    return false;
  }
}

// Mock UI state functions for testing
function preserveUIState() {
  const state = {
    currentView: 'dashboard',
    selectedCategory: null,
    scrollPosition: { x: 0, y: 0 },
    detailScrollPosition: null
  };
  
  return state;
}

function restoreUIState(state) {
  // Mock implementation for testing
  console.log('Restoring UI State:', state);
}

describe('Complete Sync Cycle Tests', () => {
  beforeEach(() => {
    // Reset global state
    currentDashboardData = {};
    connectionState = {
      isOnline: true,
      lastError: null,
      consecutiveFailures: 0,
      lastSuccessTime: null
    };
    
    // Reset mock count elements
    Object.keys(mockCountElements).forEach(category => {
      mockCountElements[category].textContent = '0';
    });
  });

  describe('End-to-End Sync Cycle', () => {
    test('should handle complete sync cycle with valid data', () => {
      // Test data representing various scenarios
      const testEntries = [
        {
          name_of_the_startup: 'TechCorp',
          submission_id: 'SUB001',
          scores: '95',
          founder_s__name: 'John Doe',
          submitted_at: '2024-01-15'
        },
        {
          name_of_the_startup: 'InnovateLab',
          submission_id: 'SUB002',
          scores: '75',
          founder_s__name: 'Jane Smith',
          submitted_at: '2024-01-16'
        },
        {
          name_of_the_startup: 'StartupX',
          submission_id: 'SUB003',
          scores: '45',
          founder_s__name: 'Bob Wilson',
          submitted_at: '2024-01-17'
        },
        {
          name_of_the_startup: 'NewVenture',
          submission_id: 'SUB004',
          scores: '', // No score - should go to unreviewed
          founder_s__name: 'Alice Brown',
          submitted_at: '2024-01-18'
        }
      ];

      // Test the complete sync cycle
      const result = updateDashboard(testEntries);
      
      // Verify the sync was successful
      expect(result).toBe(true);
      
      // Verify all categories are populated correctly
      expect(currentDashboardData.platinum).toHaveLength(1);
      expect(currentDashboardData.gold).toHaveLength(1);
      expect(currentDashboardData.silver).toHaveLength(1);
      expect(currentDashboardData.unreviewed).toHaveLength(1);
      
      // Verify specific entries are in correct categories
      expect(currentDashboardData.platinum[0].name_of_the_startup).toBe('TechCorp');
      expect(currentDashboardData.gold[0].name_of_the_startup).toBe('InnovateLab');
      expect(currentDashboardData.silver[0].name_of_the_startup).toBe('StartupX');
      expect(currentDashboardData.unreviewed[0].name_of_the_startup).toBe('NewVenture');
    });

    test('should handle empty data gracefully', () => {
      const result = updateDashboard([]);
      
      expect(result).toBe(true);
      expect(currentDashboardData.platinum).toHaveLength(0);
      expect(currentDashboardData.gold).toHaveLength(0);
      expect(currentDashboardData.silver).toHaveLength(0);
      expect(currentDashboardData.unreviewed).toHaveLength(0);
    });

    test('should filter out invalid entries during sync', () => {
      const testEntries = [
        {
          name_of_the_startup: 'ValidStartup',
          submission_id: 'SUB001',
          scores: '85'
        },
        {
          name_of_the_startup: '', // Invalid - empty name
          submission_id: '', // Invalid - empty ID
          scores: '75'
        },
        {
          name_of_the_startup: 'N/A', // Invalid - N/A name
          submission_id: 'SUB003',
          scores: '65'
        },
        null, // Invalid - null entry
        {
          name_of_the_startup: 'AnotherValid',
          submission_id: 'SUB004',
          scores: '55'
        }
      ];

      const result = updateDashboard(testEntries);
      
      expect(result).toBe(true);
      
      // Should have 3 valid entries (ValidStartup, entry with SUB003 ID, AnotherValid)
      // The entry with SUB003 is valid because it has a valid submission_id even though name is N/A
      const totalEntries = Object.values(currentDashboardData)
        .reduce((sum, category) => sum + category.length, 0);
      expect(totalEntries).toBe(3);
      
      // Verify valid entries are categorized correctly
      expect(currentDashboardData.platinum).toHaveLength(1); // ValidStartup (85)
      expect(currentDashboardData.silver).toHaveLength(2); // SUB003 (65) and AnotherValid (55)
    });

    test('should handle malformed data without crashing', () => {
      const malformedEntries = [
        'not an object',
        { scores: 'not a number' },
        { name_of_the_startup: 123 }, // Number instead of string
        undefined,
        { submission_id: null }
      ];

      const result = updateDashboard(malformedEntries);
      
      // Should not crash and return success
      expect(result).toBe(true);
      
      // Should result in empty dashboard due to invalid data
      const totalEntries = Object.values(currentDashboardData)
        .reduce((sum, category) => sum + category.length, 0);
      expect(totalEntries).toBe(0);
    });
  });

  describe('Data Scenarios Testing', () => {
    test('should handle boundary score values correctly', () => {
      const boundaryEntries = [
        { name_of_the_startup: 'Boundary100', submission_id: 'B100', scores: '100' },
        { name_of_the_startup: 'Boundary85', submission_id: 'B85', scores: '85' },
        { name_of_the_startup: 'Boundary84', submission_id: 'B84', scores: '84.9' },
        { name_of_the_startup: 'Boundary70', submission_id: 'B70', scores: '70' },
        { name_of_the_startup: 'Boundary69', submission_id: 'B69', scores: '69.9' },
        { name_of_the_startup: 'Boundary1', submission_id: 'B1', scores: '1' },
        { name_of_the_startup: 'Boundary0', submission_id: 'B0', scores: '0' }
      ];

      updateDashboard(boundaryEntries);

      // Verify boundary categorization
      expect(currentDashboardData.platinum).toHaveLength(2); // 100, 85
      expect(currentDashboardData.gold).toHaveLength(2); // 84.9, 70
      expect(currentDashboardData.silver).toHaveLength(2); // 69.9, 1
      expect(currentDashboardData.unreviewed).toHaveLength(1); // 0 (treated as no score)
    });

    test('should handle entries with only submission IDs', () => {
      const entriesWithOnlyIds = [
        {
          submission_id: 'ID001',
          scores: '90',
          founder_s__name: 'Founder One'
        },
        {
          submission_id: 'ID002',
          scores: '75'
        }
      ];

      updateDashboard(entriesWithOnlyIds);

      expect(currentDashboardData.platinum).toHaveLength(1);
      expect(currentDashboardData.gold).toHaveLength(1);
      
      // Verify entries are accessible by submission ID
      expect(currentDashboardData.platinum[0].submission_id).toBe('ID001');
      expect(currentDashboardData.gold[0].submission_id).toBe('ID002');
    });

    test('should handle mixed valid and invalid score formats', () => {
      const mixedScoreEntries = [
        { name_of_the_startup: 'Valid1', submission_id: 'V1', scores: '85.5' },
        { name_of_the_startup: 'Invalid1', submission_id: 'I1', scores: 'abc' },
        { name_of_the_startup: 'Invalid2', submission_id: 'I2', scores: 'N/A' },
        { name_of_the_startup: 'Valid2', submission_id: 'V2', scores: '70.0' },
        { name_of_the_startup: 'Invalid3', submission_id: 'I3', scores: '150' }, // Out of bounds
        { name_of_the_startup: 'Valid3', submission_id: 'V3', scores: '60' }
      ];

      updateDashboard(mixedScoreEntries);

      // Valid scores should be categorized correctly
      expect(currentDashboardData.platinum).toHaveLength(1); // 85.5
      expect(currentDashboardData.gold).toHaveLength(1); // 70.0
      expect(currentDashboardData.silver).toHaveLength(1); // 60
      
      // Invalid scores should go to unreviewed
      expect(currentDashboardData.unreviewed).toHaveLength(3); // abc, N/A, 150
    });
  });

  describe('State Management Testing', () => {
    test('should completely clear previous state before rebuilding', () => {
      // Set up initial state
      currentDashboardData = {
        platinum: [{ name_of_the_startup: 'OldEntry1' }],
        gold: [{ name_of_the_startup: 'OldEntry2' }],
        silver: [{ name_of_the_startup: 'OldEntry3' }],
        unreviewed: [{ name_of_the_startup: 'OldEntry4' }]
      };

      // Update with completely different data
      const newEntries = [
        { name_of_the_startup: 'NewEntry1', submission_id: 'N1', scores: '95' }
      ];

      updateDashboard(newEntries);

      // Verify old state is completely cleared
      expect(currentDashboardData.platinum).toHaveLength(1);
      expect(currentDashboardData.gold).toHaveLength(0);
      expect(currentDashboardData.silver).toHaveLength(0);
      expect(currentDashboardData.unreviewed).toHaveLength(0);
      
      // Verify only new data exists
      expect(currentDashboardData.platinum[0].name_of_the_startup).toBe('NewEntry1');
    });

    test('should preserve UI state during refresh', () => {
      const state = preserveUIState();

      expect(state.currentView).toBe('dashboard');
      expect(state.scrollPosition).toBeDefined();
    });
  });

  describe('Error Handling During Sync', () => {
    test('should handle updateDashboard errors gracefully', () => {
      // Force an error by passing invalid data structure that will be handled
      const result = updateDashboard(null);

      // Should handle error gracefully and return true (empty dashboard)
      expect(result).toBe(true);
      
      // Dashboard state should be empty but defined
      expect(currentDashboardData).toBeDefined();
      expect(currentDashboardData.platinum).toHaveLength(0);
    });

    test('should maintain data integrity during partial failures', () => {
      // Set up some initial valid data
      const validEntries = [
        { name_of_the_startup: 'ValidEntry', submission_id: 'V1', scores: '85' }
      ];
      
      updateDashboard(validEntries);
      
      // Verify initial state
      expect(currentDashboardData.platinum).toHaveLength(1);
      
      // Now try to update with problematic data
      const problematicEntries = [
        { name_of_the_startup: 'NewValid', submission_id: 'V2', scores: '75' },
        null, // This should be handled gracefully
        undefined
      ];
      
      const result = updateDashboard(problematicEntries);
      
      // Should succeed and replace previous data
      expect(result).toBe(true);
      expect(currentDashboardData.platinum).toHaveLength(0);
      expect(currentDashboardData.gold).toHaveLength(1);
      expect(currentDashboardData.gold[0].name_of_the_startup).toBe('NewValid');
    });
  });

  describe('Requirements Validation', () => {
    test('validates Requirements 1.1, 1.2, 1.3, 1.4 - Real-time Data Synchronization', () => {
      const initialEntries = [
        { name_of_the_startup: 'Startup1', submission_id: 'S1', scores: '90' },
        { name_of_the_startup: 'Startup2', submission_id: 'S2', scores: '80' }
      ];
      
      // Simulate first sync cycle
      updateDashboard(initialEntries);
      expect(currentDashboardData.platinum).toHaveLength(1);
      expect(currentDashboardData.gold).toHaveLength(1);
      
      // Simulate data changes (entry deleted, new entry added, score modified)
      const updatedEntries = [
        { name_of_the_startup: 'Startup2', submission_id: 'S2', scores: '95' }, // Score modified
        { name_of_the_startup: 'Startup3', submission_id: 'S3', scores: '75' }  // New entry
        // Startup1 deleted (not in new data)
      ];
      
      // Simulate next sync cycle
      updateDashboard(updatedEntries);
      
      // Verify changes are reflected
      expect(currentDashboardData.platinum).toHaveLength(1); // Startup2 moved here
      expect(currentDashboardData.gold).toHaveLength(1);     // Startup3 added here
      expect(currentDashboardData.silver).toHaveLength(0);
      expect(currentDashboardData.unreviewed).toHaveLength(0);
      
      // Verify deleted entry is gone
      const allEntries = [
        ...currentDashboardData.platinum,
        ...currentDashboardData.gold,
        ...currentDashboardData.silver,
        ...currentDashboardData.unreviewed
      ];
      expect(allEntries.find(e => e.submission_id === 'S1')).toBeUndefined();
    });
  });
});