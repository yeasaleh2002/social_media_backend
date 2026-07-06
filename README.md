# Social Media RESTful API Backend 🚀

A highly scalable, secure, and performant RESTful API backend for a Social Media application. Built with Node.js, Express, PostgreSQL, and Prisma ORM.

## 🛠️ Technology Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL (NeonDB)
- **ORM:** Prisma
- **Security:** Helmet, express-rate-limit, bcryptjs, JSON Web Tokens (JWT)

---

## 🏗️ Step-by-Step Implementation Guide

Here is a breakdown of how this highly-scalable architecture was built from the ground up:

### 1. Database Architecture & Optimization (Prisma Setup)
We designed a robust relational schema tailored for scale:
- Separated `Like` into polymorphic-like tables (`PostLike` and `CommentLike`) to enforce strict referential integrity and avoid sparse columns.
- Introduced `@@index` indexing on all foreign keys (`authorId`, `postId`, `parentId`) and timestamp fields (`createdAt`) for lightning-fast read operations during feed generation.
- Handled cascading deletions natively at the database level (`onDelete: Cascade`).

### 2. Core Server Setup & Hardening
- Scaffolding the `Express.js` app with critical middleware.
- **Helmet**: Secures the application by configuring various HTTP headers (preventing XSS, clickjacking).
- **CORS**: Safely manages Cross-Origin Resource Sharing.
- **Express-Rate-Limit**: Added global rate-limiting (100 reqs / 15 mins per IP) to mitigate brute-force and DDoS attacks.
- **Payload Limits**: Capped `express.json()` at `10kb` to prevent memory exhaustion attacks.
- Refactored all endpoints to return a consistent JSON payload structure: `{ success, data, error }`.

### 3. Secure Authentication (JWT & Bcrypt)
- **Registration**: Hashes passwords with a high salt factor (`bcrypt.genSalt(12)`).
- **Login**: Compares passwords and issues a cryptographically signed JWT with a `7d` expiration. Generic error messages ("Invalid email or password") prevent email enumeration attacks.
- **Middleware**: Built `authenticateToken` to intercept requests, enforce `Bearer` scheme, verify the token signature, and attach the user payload to `req.user`.

### 4. Posts & Highly Scalable Feed API
- **Feed (`GET /api/feed`)**: Engineered for millions of rows. It uses **Cursor-based pagination**, avoiding the heavy performance penalty of SQL `OFFSET`. 
- **Prisma Selection**: Query is heavily optimized by explicitly defining `select` payloads rather than using `include`. This fetches only necessary attributes, embeds aggregate counts (`_count: { likes, comments }`), determines if the requesting user liked the post via sub-selects, and fetches a 2-comment preview without pulling full relational trees.
- Implemented **Privacy Guards** (`PUBLIC` vs `PRIVATE` posts).

### 5. Nested Interactions (Comments & Likes)
- **Nested Comments**: Engineered `POST /api/posts/:postId/comments` to support infinite depth replies using a self-referencing `parentId` relation.
- **Unified Toggle Like**: A smart `POST /api/likes/toggle` endpoint that detects existing likes and intelligently toggles (deletes or creates) them for both Posts and Comments.
- **Access Control (Authorization)**: A `checkPostAccess()` guardian function ensures users cannot comment on or interact with `PRIVATE` posts unless they are the author.

---

## 📡 API Reference

**Standard Response Format (Across all endpoints):**
```json
{
  "success": true, // or false
  "data": { ... }, // null on error
  "error": null    // string on error
}
```

### 1. Auth API

#### `POST /api/auth/register`
Creates a new user account.
**Payload:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "securepassword"
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "message": "User registered successfully.",
    "user": { "id": "uuid", "firstName": "John", "lastName": "Doe", "email": "john.doe@example.com" }
  },
  "error": null
}
```

#### `POST /api/auth/login`
Authenticates a user and returns a JWT.
**Payload:**
```json
{
  "email": "john.doe@example.com",
  "password": "securepassword"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Login successful.",
    "token": "eyJhbGciOiJIUzI1NiIsInR5c...",
    "user": { "id": "uuid", "firstName": "John", "lastName": "Doe", "email": "john.doe@example.com" }
  },
  "error": null
}
```

#### `POST /api/auth/logout`
Logs out the current user. Since this is a stateless JWT implementation, the client is responsible for deleting the token.
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Logout successful."
  },
  "error": null
}
```

#### `GET /api/auth/me`
*(Requires Authorization: Bearer <token>)*
Fetches details of the currently authenticated user.
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "createdAt": "2023-10-01T12:00:00Z",
      "updatedAt": "2023-10-01T12:00:00Z"
    }
  },
  "error": null
}
```

#### `PUT /api/auth/me`
*(Requires Authorization: Bearer <token>)*
Updates details of the currently authenticated user. All fields are optional.
**Payload:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@example.com"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "User information updated successfully.",
    "user": {
      "id": "uuid",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane.smith@example.com",
      "createdAt": "2023-10-01T12:00:00Z",
      "updatedAt": "2023-10-02T15:30:00Z"
    }
  },
  "error": null
}
```

---

### 2. Posts & Feed API
*(Requires Authorization: Bearer <token>)*

#### `POST /api/posts`
Create a new text/image post.
**Payload:**
```json
{
  "content": "Hello world! My first post.",
  "privacy": "PUBLIC" // Optional. Defaults to PUBLIC. Options: PUBLIC, PRIVATE.
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "message": "Post created successfully",
    "post": { "id": "uuid", "content": "Hello world!", "privacy": "PUBLIC", "authorId": "uuid", ... }
  },
  "error": null
}
```

#### `GET /api/feed`
Fetch a scalable, cursor-paginated timeline of posts.
**Query Parameters:**
- `limit`: Number of posts to fetch (default: 10)
- `cursor`: UUID of the last post received (used for next page)
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": "uuid",
        "content": "Hello world!",
        "privacy": "PUBLIC",
        "createdAt": "2023-10-01T12:00:00Z",
        "author": { "id": "uuid", "firstName": "John", "lastName": "Doe" },
        "likeCount": 5,
        "commentCount": 2,
        "hasLiked": false,
        "comments": [ /* Preview of top 2 comments */ ]
      }
    ],
    "nextCursor": "uuid" // Pass this in the query parameter for the next page
  },
  "error": null
}
```

---

### 3. Interactions API
*(Requires Authorization: Bearer <token>)*

#### `POST /api/posts/:postId/comments`
Add a comment or nested reply to a post.
**URL Parameter:** `:postId` - The target post ID.
**Payload:**
```json
{
  "content": "This is an awesome post!",
  "parentId": "uuid" // Optional. Include this if it's a nested reply to another comment.
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "message": "Comment added successfully",
    "comment": { "id": "uuid", "content": "This is an awesome post!", "postId": "uuid", "parentId": null }
  },
  "error": null
}
```

#### `POST /api/likes/toggle`
Toggle (add/remove) a like dynamically.
**Payload:** (Provide exactly ONE of the following)
```json
{
  "postId": "uuid"
}
```
*OR*
```json
{
  "commentId": "uuid"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Post liked successfully",
    "liked": true // true if liked, false if unliked
  },
  "error": null
}
```

#### `GET /api/posts/:postId/likes`
Get cursor-paginated users who liked a post.
**Query Parameters:** `?limit=10&cursor=uuid`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "users": [
      { "id": "uuid", "firstName": "John", "lastName": "Doe" }
    ],
    "nextCursor": null
  },
  "error": null
}
```

#### `GET /api/comments/:commentId/likes`
Get cursor-paginated users who liked a comment.
**Query Parameters:** `?limit=10&cursor=uuid`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "users": [
      { "id": "uuid", "firstName": "Alice", "lastName": "Smith" }
    ],
    "nextCursor": null
  },
  "error": null
}
```
