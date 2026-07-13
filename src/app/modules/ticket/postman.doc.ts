/**
 * POSTMAN API Documentation - Ticket Support Module
 * 
 * Base URL: /api/v1/tickets
 */

// ============================================================
// ENDPOINTS OVERVIEW
// ============================================================

/**
 * 1. POST /api/v1/tickets
 *    - Create a new support ticket
 *    - Auth: USER, ORGINIZER, CLINIC
 *    - Body:
 *      {
 *        "subject": "Booking issue with time slot",
 *        "description": "I cannot book the time slot that shows available",
 *        "category": "BOOKING_ISSUE", // optional: OTHER, ACCOUNT_ISSUE, etc.
 *        "priority": "MEDIUM", // optional: LOW, MEDIUM, HIGH, URGENT
 *        "relatedBookingId": "booking_123" // optional
 *      }
 *    - Response: Created ticket with ticketNumber (e.g., TKT-00001)
 *    - Note: Booking validation is atomic (inside transaction) to prevent race conditions
 */

/**
 * 2. GET /api/v1/tickets
 *    - List tickets (filtered by role)
 *    - Auth: USER, ORGINIZER, CLINIC, ADMIN, SUPERADMIN
 *    - Query params:
 *      - page, limit (pagination)
 *      - searchTerm (search in subject, description, ticketNumber, creator name, creator email)
 *      - status (OPEN, IN_PROGRESS, PENDING_CUSTOMER, RESOLVED, CLOSED, REOPENED)
 *      - category (BOOKING_ISSUE, PAYMENT_ISSUE, etc.)
 *      - priority (LOW, MEDIUM, HIGH, URGENT)
 *      - assignedToId (filter by assigned admin)
 *      - createdById (filter by creator)
 *      - bookingId (filter by related booking)
 *      - period (daily, weekly, monthly) - date filter
 *      - rangeStartDay, rangeEndDay (custom date range: YYYY-MM-DD)
 *    - Response: Paginated list with meta
 *    - Note: Cross-entity search now works — searching by creator name/email/ticket number
 */

/**
 * 3. GET /api/v1/tickets/:id
 *    - Get ticket details with messages
 *    - Auth: Ticket owner or ADMIN/SUPERADMIN
 *    - Query params (message pagination):
 *      - messagePage (default: 1)
 *      - messageLimit (default: 50, max: 100)
 *    - Response: Full ticket with paginated messages and messagePagination meta
 *      - Internal notes filtered out for non-staff users
 *      - messagePagination: { total, page, limit, totalPages }
 *    - Note: Messages are now paginated to prevent OOM on tickets with 10K+ replies
 */

/**
 * 4. PATCH /api/v1/tickets/:id/assign
 *    - Assign ticket to admin/staff
 *    - Auth: ADMIN, SUPERADMIN only
 *    - Body:
 *      {
 *        "assignedToId": "admin_user_id"
 *      }
 *    - Response: Updated ticket
 *    - Note: Assignee + ticket lookups are parallelized for 2x faster response
 */

/**
 * 5. PATCH /api/v1/tickets/:id/status
 *    - Update ticket status
 *    - Auth: ADMIN/SUPERADMIN (any status) or USER/ORGINIZER/CLINIC (reopen only)
 *    - Body:
 *      {
 *        "status": "IN_PROGRESS",
 *        "note": "Working on this issue" // optional
 *      }
 *    - Valid transitions:
 *      - OPEN -> IN_PROGRESS, CLOSED
 *      - IN_PROGRESS -> PENDING_CUSTOMER, RESOLVED, CLOSED
 *      - PENDING_CUSTOMER -> IN_PROGRESS, RESOLVED, CLOSED
 *      - RESOLVED -> CLOSED, REOPENED
 *      - Customer: RESOLVED/PENDING_CUSTOMER -> REOPENED (only)
 *    - Note: Status change + log are atomic in a single transaction
 */

/**
 * 6. POST /api/v1/tickets/:id/messages
 *    - Add reply to ticket
 *    - Auth: Ticket owner or ADMIN/SUPERADMIN
 *    - Body:
 *      {
 *        "message": "Additional details about the issue",
 *        "attachments": ["https://url/to/file1.pdf"], // optional array of URLs
 *        "isInternalNote": false // optional, staff only
 *      }
 *    - Note: Customer replies on RESOLVED ticket auto-reopens to REOPENED
 */

/**
 * 7. POST /api/v1/tickets/:id/rating
 *    - Add satisfaction rating (once only)
 *    - Auth: Ticket creator only, RESOLVED/CLOSED tickets only
 *    - Body:
 *      {
 *        "rating": 4, // 1-5
 *        "feedback": "Quick response, issue resolved" // optional
 *      }
 */

/**
 * 8. GET /api/v1/tickets/analytics
 *    - Get ticket analytics dashboard
 *    - Auth: ADMIN, SUPERADMIN only
 *    - Query params:
 *      - period (daily, weekly, monthly)
 *      - rangeStartDay, rangeEndDay (custom date range: YYYY-MM-DD)
 *    - Response:
 *      {
 *        "period": "weekly",
 *        "dateRange": { "rangeStart": "...", "rangeEnd": "..." },
 *        "statusDistribution": { "OPEN": 10, "IN_PROGRESS": 5, ... },
 *        "categoryDistribution": { "BOOKING_ISSUE": 8, ... },
 *        "priorityDistribution": { "HIGH": 3, ... },
 *        "topAgents": [{ "agentId": "...", "agentName": "...", "resolvedCount": 5 }],
 *        "avgResolutionTimeHours": 24.5,
 *        "avgCSAT": 4.2
 *      }
 *    - Note: Resolution time uses DB aggregation (O(1) memory) instead of loading all rows
 */

// ============================================================
// EXAMPLE REQUESTS
// ============================================================

// Create Ticket
/*
curl -X POST http://localhost:5000/api/v1/tickets \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Cannot upload medical record",
    "description": "The upload button is not working for my medical documents",
    "category": "MEDICAL_RECORD_ISSUE",
    "priority": "HIGH"
  }'
*/

// List Tickets (Admin) with cross-entity search
/*
curl -X GET "http://localhost:5000/api/v1/tickets?searchTerm=John&status=OPEN&priority=URGENT" \
  -H "Authorization: Bearer <admin_token>"
*/

// Get Ticket Detail with paginated messages
/*
curl -X GET "http://localhost:5000/api/v1/tickets/ticket_id?messagePage=1&messageLimit=50" \
  -H "Authorization: Bearer <token>"
*/

// Reply to Ticket
/*
curl -X POST http://localhost:5000/api/v1/tickets/ticket_id/messages \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I have additional information",
    "attachments": ["https://.../screenshot.png"]
  }'
*/

// Add Internal Note (Staff only)
/*
curl -X POST http://localhost:5000/api/v1/tickets/ticket_id/messages \
  -H "Authorization: Bearer <staff_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Customer called - escalating to priority HIGH",
    "isInternalNote": true
  }'
*/

// Get Analytics
/*
curl -X GET "http://localhost:5000/api/v1/tickets/analytics?period=monthly" \
  -H "Authorization: Bearer <admin_token>"
*/

// Get Analytics with custom date range
/*
curl -X GET "http://localhost:5000/api/v1/tickets/analytics?rangeStartDay=2026-01-01&rangeEndDay=2026-06-30" \
  -H "Authorization: Bearer <admin_token>"
*/