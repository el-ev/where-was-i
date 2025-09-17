// Example API usage demonstrating the time range feature

// Creating a token with time range restrictions
const createTokenWithTimeRange = {
    "expires": true,
    "expires_in_days": 30,
    "permissions": {
        "read": true,
        "write": false,
        "create_token": false
    },
    "comment": "Limited time range token",
    "available_start_time": "2023-01-01T00:00:00Z",
    "available_end_time": "2023-06-30T23:59:59Z"
};

// Expected behavior:
// 1. Token creation should accept the time range parameters
// 2. When using this token to query locations, only data between 
//    2023-01-01 and 2023-06-30 should be accessible
// 3. Even if the user requests data outside this range, 
//    the token's time restrictions take precedence

console.log('Token creation payload:', JSON.stringify(createTokenWithTimeRange, null, 2));
console.log('\nExpected behavior:');
console.log('- Token can only access location data from 2023-01-01 to 2023-06-30');
console.log('- User queries for broader date ranges will be limited by token restrictions');
console.log('- User queries for narrower date ranges will work as normal');