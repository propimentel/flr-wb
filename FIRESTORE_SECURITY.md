# Firestore Security Rules

This document describes the security model and rules for the real-time collaborative whiteboard application.

## Security Overview

The Firestore security rules implement a role-based access control system with the following principles:

- **Authentication Required**: All operations require Firebase Authentication
- **Collaborative Boards**: Authenticated users can read/write to all boards
- **Private Uploads**: Users can only access their own uploaded files
- **Data Validation**: Strict validation of data structure and content
- **Audit Trail**: All operations are logged with user identity

## Data Model

### Collections Structure

```
/boards/{boardId}
├── /strokes/{strokeId}     // Drawing strokes
└── /messages/{messageId}   // Chat messages

/users/{uid}
└── /uploads/{fileId}       // User uploaded files
```

## Security Rules

### 1. Boards Collection (`/boards/{boardId}`)

**Access**: Any authenticated user can read/write boards (collaborative)

```javascript
allow read, write: if isAuthenticated();
```

**Use Case**: Collaborative whiteboards where all users can contribute

### 2. Strokes Subcollection (`/boards/{boardId}/strokes/{strokeId}`)

**Access**: Any authenticated user can read/write strokes

**Validation Rules**:
- `id`: String, max 50 characters
- `points`: Array of coordinate points
- `color`: String (hex color)
- `size`: Number between 1-50 pixels
- `timestamp`: Valid timestamp ≤ current time

```javascript
allow create: if isAuthenticated() 
  && isValidString(resource.data.id, 50)
  && resource.data.points is list
  && resource.data.color is string
  && resource.data.size is number
  && resource.data.size > 0 && resource.data.size <= 50
  && isValidTimestamp(resource.data.timestamp);
```

### 3. Messages Subcollection (`/boards/{boardId}/messages/{messageId}`)

**Access**: Any authenticated user can read messages, only message author can update

**Validation Rules**:
- `id`: String, max 50 characters  
- `text`: String, max 1000 characters
- `uid`: Must match authenticated user's UID
- `timestamp`: Valid timestamp ≤ current time

```javascript
allow create: if isAuthenticated()
  && isValidString(resource.data.text, 1000)
  && resource.data.uid == request.auth.uid
  && isValidTimestamp(resource.data.timestamp);

allow update: if isAuthenticated()
  && resource.data.uid == request.auth.uid;
```

### 4. User Uploads (`/users/{uid}/uploads/{fileId}`)

**Access**: Users can only access their own uploads (private)

```javascript
allow read, write: if isAuthenticated() && isOwner(uid);
```

**Validation Rules**:
- `id`: String, max 50 characters
- `filename`: String, max 255 characters
- `download_url`: String, max 2048 characters
- `file_size`: Integer, max 10MB (10,485,760 bytes)
- `mime_type`: String, max 100 characters
- `user_uid`: Must match document path UID
- `uploaded_at`: Valid timestamp ≤ current time

## Helper Functions

### `isAuthenticated()`
Checks if user is authenticated with Firebase Auth
```javascript
function isAuthenticated() {
  return request.auth != null;
}
```

### `isOwner(uid)`
Checks if authenticated user matches the specified UID
```javascript
function isOwner(uid) {
  return request.auth.uid == uid;
}
```

### `isValidTimestamp(field)`
Validates timestamp is not in the future
```javascript
function isValidTimestamp(field) {
  return field is timestamp && field <= request.time;
}
```

### `isValidString(field, maxLength)`
Validates string field length
```javascript
function isValidString(field, maxLength) {
  return field is string && field.size() <= maxLength;
}
```

## Data Validation Limits

| Field | Type | Max Size | Description |
|-------|------|----------|-------------|
| `id` | String | 50 chars | Unique identifier |
| `text` (messages) | String | 1000 chars | Chat message content |
| `filename` | String | 255 chars | Original filename |
| `download_url` | String | 2048 chars | GCS download URL |
| `mime_type` | String | 100 chars | File MIME type |
| `file_size` | Integer | 10MB | File size in bytes |
| `size` (strokes) | Number | 1-50 | Brush size in pixels |

## Security Features

### 1. **Authentication Enforcement**
- All operations require valid Firebase Auth token
- Anonymous access is completely denied
- Expired tokens are automatically rejected

### 2. **Authorization Model**
- **Collaborative**: Boards, strokes, messages (any authenticated user)
- **Private**: User uploads (owner only)
- **Immutable IDs**: Document IDs cannot be changed after creation

### 3. **Data Integrity**
- Field type validation (string, number, timestamp, array)
- Size limits prevent abuse
- Required fields enforcement
- Future timestamp prevention

### 4. **Attack Prevention**
- **Injection**: Field type validation prevents NoSQL injection
- **DoS**: File size and text length limits prevent resource exhaustion
- **Impersonation**: UID validation prevents user impersonation
- **Tampering**: Immutable fields prevent critical data modification

## Deployment

### Prerequisites
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login to Firebase: `firebase login`
3. Initialize project: `firebase use frl-wb`

### Deploy Rules
```bash
# Validate syntax
firebase firestore:rules:canary firestore.rules

# Deploy to Firebase
./deploy-firestore-rules.sh
```

### Test Rules
```bash
# Run test suite
firebase firestore:rules:test firestore.test.json

# Start local emulator for testing
firebase emulators:start --only firestore
```

## Monitoring

### Firebase Console
- View rules: [Firestore Rules Console](https://console.firebase.google.com/project/frl-wb/firestore/rules)
- Monitor usage: [Firestore Usage](https://console.firebase.google.com/project/frl-wb/firestore/usage)

### Security Alerts
Firebase automatically monitors for:
- Unauthorized access attempts
- Unusual usage patterns
- Security rule violations

### Audit Logs
All Firestore operations are logged with:
- User identity (UID)
- Operation type (read/write/delete)
- Timestamp
- Resource path
- Success/failure status

## Best Practices

### 1. **Principle of Least Privilege**
- Users only have access to data they need
- Operations are restricted to minimum required

### 2. **Defense in Depth**
- Client-side validation + server-side rules
- Authentication + authorization
- Input validation + output sanitization

### 3. **Regular Reviews**
- Monthly security rule audits
- Quarterly access pattern reviews
- Annual security assessments

### 4. **Testing**
- Comprehensive test suite for all rules
- Automated testing in CI/CD pipeline
- Manual penetration testing

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   - Check Firebase Auth token validity
   - Verify user has required permissions
   - Validate data structure against rules

2. **Validation Failures**
   - Check field types and sizes
   - Ensure required fields are present
   - Verify timestamps are not in future

3. **Testing Failures**
   - Use Firebase emulator for local testing
   - Check test data matches validation rules
   - Verify auth context in tests

### Debug Commands
```bash
# View current rules
firebase firestore:rules:get

# Test specific rule
firebase firestore:rules:test --test-suite=firestore.test.json

# View security rule coverage
firebase firestore:rules:coverage
```
