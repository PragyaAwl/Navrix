// Function to validate entry data before processing
function validateEntry(entry) {
    // Check if entry exists and is an object
    if (!entry || typeof entry !== 'object') {
        return false;
    }
    
    // Get potential identifier fields
    const startupName = entry.name_of_the_startup;
    const submissionId = entry.submission_id || entry.submission__id;
    
    // Check for valid startup name - be very strict
    const hasValidStartupName = startupName && 
        typeof startupName === 'string' && 
        startupName.trim() !== '' && 
        startupName.trim().toLowerCase() !== 'n/a' &&
        startupName.trim().toLowerCase() !== 'no name' &&
        startupName.trim().toLowerCase() !== 'unnamed startup' &&
        !startupName.includes('and eldercare') &&
        !startupName.includes('and guided explanations') &&
        !startupName.includes('and we are focused') &&
        !startupName.includes('In the future') &&
        !startupName.includes('Alongside student learning') &&
        !startupName.includes('Our platform works') &&
        startupName.length > 2 && // Must be more than 2 characters
        startupName.length < 100; // But not too long
    
    // Check for valid submission ID (should be short alphanumeric codes)
    const hasValidSubmissionId = submissionId && 
        typeof submissionId === 'string' && 
        submissionId.trim() !== '' && 
        submissionId.trim().toLowerCase() !== 'n/a' &&
        /^[A-Za-z0-9]{5,15}$/.test(submissionId.trim()); // Must be 5-15 alphanumeric characters
    
    // Entry is valid ONLY if it has a valid startup name
    // We're being strict here to eliminate "Unnamed Startup" entries
    if (!hasValidStartupName) {
        return false;
    }
    
    // Additional validation: check if entry has any meaningful data beyond the name
    const allFields = Object.values(entry);
    const nonEmptyFields = allFields.filter(value => 
        value !== null && 
        value !== undefined && 
        value !== '' && 
        String(value).trim() !== '' &&
        String(value).trim().toLowerCase() !== 'n/a'
    );
    
    // Entry must have at least 2 non-empty fields (name + at least one other field)
    return nonEmptyFields.length >= 2;
}

module.exports = { validateEntry };