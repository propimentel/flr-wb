# Product Requirements Document (PRD)  
## Real-Time Collaborative Web Application (Monorepo / Single Deployment)

---

## 1. Overview  
We are building a **real-time collaborative web application** that allows multiple users to draw together on a shared whiteboard, communicate via chat, and share files instantly.  
The application will be implemented as a **monorepo**, with both **FastAPI backend** and **Next.js frontend** deployed together in a **single GCP Cloud Run instance**.  
FastAPI will **serve both API routes and the built frontend static files**.

---

## 2. Goals & Objectives
- Provide a seamless **real-time collaborative experience** with minimal latency.
- Enable **multi-user interaction** on a shared whiteboard using Firestore’s real-time capabilities.
- Support **instant messaging** alongside the drawing area.
- Allow **file uploads** directly in the chat.
- Simplify deployment by **packaging API and frontend in one container**.

---

## 3. Core Features

### 3.1 Whiteboard (Left Panel)
- **Real-time Drawing Synchronization** via **Firestore SDK** (client ↔ Firestore direct).
- **Basic Drawing Tools**:  
  - Pen tool  
  - Color picker (at least 5 pre-defined colors)  
  - Clear canvas button
- **Multi-user Drawing**: Multiple cursors and strokes displayed simultaneously.
- **Data Retention Limit**: Whiteboard sessions retained for **15 days** (cleanup process described in Section 8.2).

### 3.2 Chat Window (Right Panel)
- **Real-time Messaging** via Firestore SDK (client ↔ Firestore direct).
- **User Presence Indicators** stored in Firestore.
- **File Sharing**:  
  - Upload files via FastAPI backend.  
  - Store in **GCP Cloud Storage**.  
  - Metadata saved in Firestore for instant availability in chat.
  - **Anonymous User Limit**: Maximum **5 file uploads** per anonymous account (enforced in backend).

---

## 4. Technology Stack

| Layer          | Technology                                                    |
| -------------- | ------------------------------------------------------------- |
| **Frontend**   | Next.js + TypeScript (exported as static files)               |
| **Backend**    | Python FastAPI (API routes, file uploads, authentication)     |
| **Database**   | Google Cloud Firestore (real-time data sync)                  |
| **Storage**    | Google Cloud Storage (file uploads)                           |
| **Deployment** | GCP Cloud Run (single container for frontend + backend)       |
| **Libraries**  | For the chat window:<br>https://github.com/richardgill/llm-ui |

---

## 5. Non-Functional Requirements
- **Security**:  
  - Authentication for all users using **Firebase Anonymous Auth**.  
  - Firestore Security Rules enforcing per-user and per-session access control.  
  - File type & size validation for uploads.  
  - HTTPS for all communications.
- **Cross-platform**: Fully responsive on desktop, tablet, and mobile.

---

## 6. Deployment Plan
- **Monorepo Structure**:  
  ```
  /frontend   ← Next.js app (built & exported to static files)
  /backend    ← FastAPI app (serves API + static frontend)
  /shared     ← Shared models, types, and config
  Dockerfile  ← Builds both frontend and backend
  ```
- **Build Process**:  
  1. Build Next.js app and export static files.  
  2. Copy static files into backend folder.  
  3. FastAPI serves static files for all non-API routes.  
- **Cloud Run**:  
  - Single container with FastAPI handling all HTTP requests.  
  - `/api/*` handled by API routes.  
  - All other routes serve static frontend.  
- **CI/CD**: GitHub Actions with auto-deployment to Cloud Run on merge to `main`.

---

## 7. Secrets & Authentication Best Practices
- Firebase client config is public by design; access control is enforced via **Security Rules**.
- Store admin credentials (for FastAPI server-side operations) in **environment variables** (future improvement: migrate to GCP Secret Manager).
- Enable **Anonymous Auth** to issue `uid` for tracking uploads and activity.
- Firestore Security Rules will limit actions based on `request.auth.uid`.

---

## 8. Anonymous User Limitations & Cleanup Engineering

### 8.1 File Upload Limit (5 files)
- **Enforcement point**:  
  - When an anonymous user uploads a file, FastAPI queries Firestore (or a cached count) to see how many uploads they have made.
  - If the count is ≥ 5, FastAPI responds with HTTP 403 **and** a structured JSON payload:
    ```json
    {
      "error": "upload_limit_reached",
      "message": "Upload limit reached. Sign in with Google to continue sharing files."
    }
    ```
- **Frontend behavior**:
  - Detects `error: "upload_limit_reached"` from the API response.
  - Shows the **tooltip component** at the bottom of the whiteboard area with the error message:
    - **"Upload limit reached. Sign in with Google to continue sharing files."**
  - Tooltip fades out automatically after a few seconds.
- **Tracking**:
  - Store file metadata with `uploadedBy` = `uid` in Firestore.
  - Count documents where `uploadedBy` = current `uid`.

### 8.2 Whiteboard Retention (15 days)
- **Data Structure**:
  - Each whiteboard stroke stored with `createdAt` timestamp in Firestore.
- **Cleanup Process**:
  - Implement a cleanup endpoint in FastAPI, e.g., `DELETE /maintenance/cleanup`.
  - Configure **Cloud Scheduler** to call this endpoint daily via HTTP (secured with an auth token).
  - Endpoint queries Firestore for strokes older than 15 days and deletes them.
  - Optional: Also delete related Cloud Storage files if whiteboard snapshots are stored.

---

## 9. Future Enhancements

### 9.1 Features
The following features are **out of scope for MVP**, but planned for future releases:

1. **Google Login** via Firebase Auth (option alongside anonymous login).  
2. **User Profiles** for persistent identities across sessions.  
3. **Whiteboard Version History** to restore previous states.  
4. **Multiple Rooms/Sessions** allowing users to create private collaboration spaces.  
5. **Role-based Permissions** (e.g., viewer vs editor).  
6. **File Previews for PDFs and Docs** directly in chat.  
7. **Custom Drawing Tools** such as shapes, arrows, and text boxes.  
8. **Export Whiteboard as Image or PDF**.  
9. **Integration with Google Drive** for saving uploaded files.  
10. **Real-Time Cursor Presence Indicators** with user colors.  

---

### 9.2 Engineering
Planned engineering improvements and architectural changes:

1. **Decouple Backend from Frontend**  
   - **Current Approach (Monorepo)**:  
     - Using a monorepo and a single Cloud Run deployment allows:  
       - **Simpler deployments**: One container, one CI/CD pipeline.  
       - **Shared configuration**: Environment variables and settings are centralized.  
       - **Lower initial costs**: Only one Cloud Run service to maintain.  
       - **Faster initial development**: Backend can serve frontend directly without extra infrastructure.  
   - **When to Split**:  
     - High traffic or scaling needs where frontend and backend require different scaling rules.  
     - Backend needing to process high-frequency tasks independent from frontend traffic.  
     - Different release cadences between frontend and backend teams.  
   - **Future Architecture**:  
     - Host frontend as static files in **Firebase Hosting** or **GCP Cloud Storage + Cloud CDN**.  
     - Deploy backend separately on Cloud Run with its own scaling policy.  
     - Use API Gateway or direct HTTPS calls from frontend to backend API.  

2. **Configurable Limits**  
   - Move current hardcoded limits (file upload limit, whiteboard retention days) to backend-controlled configuration.  
   - Frontend fetches limits on load so tooltip displays **dynamic values**.  

3. **Automated Cleanup Enhancements**  
   - Add monitoring for cleanup jobs (Cloud Scheduler calling cleanup endpoint) to ensure retention rules are consistently enforced.  

4. **Observability Improvements**  
   - Add structured logging (Stackdriver), performance metrics, and error tracking for both frontend and backend.  

