#!/bin/bash

# Deploy Firestore security rules
# This script deploys the security rules to Firebase/Firestore

set -e  # Exit on any error

# Configuration
PROJECT_ID="frl-wb"
RULES_FILE="firestore.rules"

echo "🔐 Deploying Firestore security rules..."
echo "   Project: $PROJECT_ID"
echo "   Rules file: $RULES_FILE"
echo ""

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Please install it:"
    echo "   npm install -g firebase-tools"
    echo "   Then run: firebase login"
    exit 1
fi

# Check if rules file exists
if [ ! -f "$RULES_FILE" ]; then
    echo "❌ Firestore rules file not found: $RULES_FILE"
    exit 1
fi

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase. Please run:"
    echo "   firebase login"
    exit 1
fi

# Set the Firebase project
echo "🔧 Setting Firebase project..."
firebase use $PROJECT_ID

# Validate the rules syntax
echo "✅ Validating Firestore rules syntax..."
firebase firestore:rules:canary $RULES_FILE

# Deploy the rules
echo "🚀 Deploying Firestore rules..."
firebase deploy --only firestore:rules

echo ""
echo "✅ Firestore security rules deployed successfully!"
echo ""
echo "📋 Rules Summary:"
echo "   - Boards: Collaborative access for authenticated users"
echo "   - Strokes: Authenticated users can read/write drawing data"
echo "   - Messages: Users can create/update their own messages"
echo "   - Uploads: Users can only access their own uploaded files"
echo "   - Validation: Data structure and size limits enforced"
echo ""
echo "🔍 To test the rules:"
echo "   firebase firestore:rules:test $RULES_FILE"
echo ""
echo "📊 To view rules in Firebase Console:"
echo "   https://console.firebase.google.com/project/$PROJECT_ID/firestore/rules"
