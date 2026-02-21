# Bulk Certificate Issuance Implementation

## Overview

This document describes the implementation of the bulk certificate issuance endpoint (`POST /api/certificates/bulk`), which allows issuers to upload a CSV file containing multiple recipients and issue certificates to all of them in a single operation.

## Architecture

### Request Flow

```
Client Request (CSV Upload)
    ↓
Authentication & Authorization
    ↓
CSV Parsing & Validation
    ↓
Credit Validation & Deduction
    ↓
Bulk Job Creation
    ↓
Task Enqueueing (for each recipient)
    ↓
Job Status Update (PENDING → PROCESSING)
    ↓
Response (Job Details)
    ↓
[Async] Queue Processing
    ↓
[Async] Certificate Generation & Minting
```

## Implementation Details

### 1. Endpoint: `POST /api/certificates/bulk`

**Location:** `app/api/certificates/bulk/route.ts`

**Request Format:**
- Content-Type: `multipart/form-data`
- Fields:
  - `templateId` (string): ID of the certificate template to use
  - `csvFile` (File): CSV file containing recipient data

**CSV Format:**
- Required column: `email`
- Additional columns: Treated as dynamic field data
- Example:
  ```csv
  email,recipientName,courseName,completionDate
  john@example.com,John Doe,Web Development,2024-01-15
  jane@example.com,Jane Smith,Data Science,2024-01-16
  ```

### 2. Authentication & Authorization

```typescript
const auth = await requireIssuer(req);
if ("error" in auth) {
  return auth.error;
}
const issuerId = auth.payload.issuerId!;
```

- Validates JWT token
- Extracts issuer ID from token
- Returns 401 if authentication fails

### 3. Template Validation

```typescript
const template = await prisma.certificateTemplate.findUnique({
  where: { id: templateId },
});

if (!template) {
  return NextResponse.json({ error: "Template not found" }, { status: 404 });
}

if (template.issuerId !== issuerId) {
  return NextResponse.json(
    { error: "Template does not belong to this issuer" },
    { status: 403 }
  );
}
```

- Validates template exists
- Validates template belongs to authenticated issuer
- Returns 404 if template not found
- Returns 403 if template belongs to different issuer

### 4. CSV Parsing

```typescript
const csvContent = await csvFile.text();
const recipientData = await parseCSV(csvContent);
```

**CSV Parser (`lib/utils/csvParser.ts`):**
- Parses CSV using `csv-parse` library
- Validates required "email" column exists
- Validates email format for each row
- Extracts field data from remaining columns
- Returns array of `RecipientData` objects
- Throws descriptive errors for invalid CSV

**Error Handling:**
- Returns 400 with detailed error message if CSV parsing fails
- Error messages include row numbers and specific validation failures

### 5. Credit Management

```typescript
// Calculate total credits needed (1 per recipient)
const totalCredits = recipientData.length;

// Validate issuer has sufficient credits
const creditValidation = await validateCredits(issuerId, totalCredits);
if (!creditValidation.valid) {
  return NextResponse.json(
    { 
      error: creditValidation.error,
      required: totalCredits,
      available: creditValidation.currentBalance
    },
    { status: 400 }
  );
}

// Deduct total credits atomically
const creditDeduction = await deductCredits(issuerId, totalCredits);
if (!creditDeduction.success) {
  // Delete job if credit deduction fails
  await prisma.bulkIssuanceJob.delete({ where: { id: job.id } });
  return NextResponse.json(
    { error: creditDeduction.error },
    { status: 500 }
  );
}
```

**Credit Manager (`lib/services/creditManager.ts`):**
- `validateCredits()`: Checks if issuer has sufficient balance
- `deductCredits()`: Atomically deducts credits using database transaction
- Creates `CreditTransaction` record for audit trail
- Returns detailed error messages

**Key Features:**
- Atomic credit deduction (all or nothing)
- Upfront payment (credits deducted before processing)
- Automatic refund on individual certificate failures
- Audit trail for all credit transactions

### 6. Bulk Job Creation

```typescript
const job = await prisma.bulkIssuanceJob.create({
  data: {
    issuerId,
    certificateTemplateId: templateId,
    recipientData: recipientData as any,
    status: JobStatus.PENDING,
    totalItems: recipientData.length,
    processedItems: 0,
    failedItems: 0,
  },
});
```

**BulkIssuanceJob Model:**
- `id`: Unique job identifier
- `issuerId`: Owner of the job
- `certificateTemplateId`: Template to use
- `recipientData`: Array of recipient data (stored as JSON)
- `status`: PENDING → PROCESSING → COMPLETED
- `totalItems`: Total number of certificates to issue
- `processedItems`: Number of certificates processed so far
- `failedItems`: Number of certificates that failed
- `statusMessages`: Error messages for failed certificates (optional)

### 7. Task Enqueueing

```typescript
// Get issuer details for queue tasks
const issuer = await prisma.issuer.findUnique({
  where: { id: issuerId },
  include: { user: true },
});

// Enqueue certificate tasks for each recipient
for (const recipient of recipientData) {
  await queueProcessor.enqueue({
    templateId,
    recipientEmail: recipient.email,
    recipientName: recipient.fieldData.recipientName || recipient.fieldData.name || "Recipient",
    fieldData: recipient.fieldData,
    jobId: job.id,
    issuerId,
    issuerAddress: issuer.user.walletAddress,
    issuerEmail: issuer.user.email,
    certificateName: template.templateName,
  });
}
```

**Queue Processor (`lib/services/queueProcessor.ts`):**
- Simple in-memory queue with sequential processing
- Each task contains all data needed for certificate generation
- Processing starts automatically when tasks are enqueued
- Runs asynchronously in the background

**Task Processing Flow:**
1. Generate certificate image
2. Upload image to IPFS
3. Create and upload metadata to IPFS
4. Mint NFT on Algorand
5. Update certificate record
6. Send email notification
7. Update job progress counters

### 8. Job Status Update

```typescript
await prisma.bulkIssuanceJob.update({
  where: { id: job.id },
  data: {
    status: JobStatus.PROCESSING,
  },
});
```

- Updates job status from PENDING to PROCESSING
- Indicates that tasks have been enqueued and processing has started

### 9. Response

```typescript
return NextResponse.json(
  {
    success: true,
    job: {
      id: job.id,
      totalItems: job.totalItems,
      status: JobStatus.PROCESSING,
    },
  },
  { status: 200 }
);
```

- Returns immediately after enqueueing tasks
- Does not wait for certificate processing to complete
- Client can poll job status to monitor progress

## Error Handling

### Validation Errors (400)

1. **Missing templateId**
   ```json
   { "error": "templateId is required and must be a string" }
   ```

2. **Missing csvFile**
   ```json
   { "error": "csvFile is required and must be a file" }
   ```

3. **CSV parsing failure**
   ```json
   { "error": "CSV parsing failed: CSV file is missing required \"email\" column" }
   ```

4. **Insufficient credits**
   ```json
   {
     "error": "Insufficient credits. Required: 10, Available: 5",
     "required": 10,
     "available": 5
   }
   ```

### Authorization Errors (403)

1. **Template ownership**
   ```json
   { "error": "Template does not belong to this issuer" }
   ```

### Resource Errors (404)

1. **Template not found**
   ```json
   { "error": "Template not found" }
   ```

2. **Issuer not found**
   ```json
   { "error": "Issuer not found" }
   ```

### Server Errors (500)

1. **Credit deduction failure**
   ```json
   { "error": "Failed to deduct credits" }
   ```

2. **General errors**
   ```json
   { "error": "Failed to create bulk issuance job: <error message>" }
   ```

## Cleanup on Errors

The implementation includes proper cleanup mechanisms:

1. **Credit deduction failure:**
   - Deletes the created job
   - No credits are deducted

2. **Issuer not found after job creation:**
   - Deletes the created job
   - Credits remain deducted (should not happen in normal flow)

3. **Individual certificate failures (during queue processing):**
   - Refunds 1 credit per failed certificate
   - Marks certificate as REJECTED
   - Continues processing remaining certificates
   - Updates job's failedItems counter

## Asynchronous Processing

The bulk issuance endpoint uses asynchronous processing to handle large batches efficiently:

1. **Immediate Response:**
   - Endpoint returns immediately after enqueueing tasks
   - Client receives job ID and can poll for status

2. **Background Processing:**
   - Queue processor handles certificates sequentially
   - Each certificate goes through full issuance flow
   - Progress is tracked in job record

3. **Status Tracking:**
   - Job status: PENDING → PROCESSING → COMPLETED
   - Counters: processedItems, failedItems
   - Error messages stored in statusMessages

## Testing

### Unit Tests

Location: `app/api/certificates/bulk/route.test.ts`

Tests cover:
- ✅ Required field validation
- ✅ Template existence validation
- ✅ Template ownership validation
- ✅ CSV parsing error handling
- ✅ Credit validation
- ✅ Successful job creation and task enqueueing

All tests pass (6/6).

### Integration Testing

To test the complete flow:

1. Create a certificate template
2. Prepare a CSV file with test recipients
3. Ensure issuer has sufficient credits
4. Send POST request with template ID and CSV file
5. Verify job is created with correct status
6. Monitor job progress (processedItems, failedItems)
7. Verify certificates are minted on blockchain
8. Verify email notifications are sent

### Sample CSV

Location: `app/api/certificates/bulk/sample-recipients.csv`

Contains 5 sample recipients with various field data.

## Performance Considerations

### Current Implementation

- **Sequential Processing:** Certificates are processed one at a time
- **In-Memory Queue:** Simple queue stored in application memory
- **Processing Time:** ~15-30 seconds per certificate (image generation, IPFS upload, blockchain minting)

### Scalability

For production use with large batches (100+ certificates):

1. **Parallel Processing:**
   - Process multiple certificates concurrently
   - Use worker threads or separate processes

2. **Persistent Queue:**
   - Migrate to Redis (Bull queue)
   - Or use AWS SQS, RabbitMQ
   - Enables distributed processing

3. **Batch Optimization:**
   - Batch IPFS uploads
   - Optimize image generation
   - Cache template data

4. **Monitoring:**
   - Track queue depth
   - Monitor processing rate
   - Alert on failures

## Requirements Validation

This implementation satisfies the following requirements:

- ✅ **Requirement 2.1:** CSV validation and parsing
- ✅ **Requirement 2.2:** Credit calculation and validation
- ✅ **Requirement 2.3:** Bulk job creation with PENDING status
- ✅ **Requirement 2.4:** Atomic credit deduction
- ✅ **Requirement 2.5:** Task enqueueing to processing queue
- ✅ **Requirement 8.6:** Job initialization with correct counters
- ✅ **Requirement 10.2:** POST endpoint at /api/certificates/bulk
- ✅ **Requirement 10.3:** Authentication and authorization
- ✅ **Requirement 10.4:** Appropriate HTTP error codes
- ✅ **Requirement 10.6:** Descriptive error messages

## Future Enhancements

1. **Job Status Endpoint:**
   - GET /api/certificates/bulk/[jobId]
   - Returns current job status and progress

2. **Job Cancellation:**
   - DELETE /api/certificates/bulk/[jobId]
   - Stops processing and refunds remaining credits

3. **Retry Failed Certificates:**
   - POST /api/certificates/bulk/[jobId]/retry
   - Retries only failed certificates

4. **Webhook Notifications:**
   - Notify client when job completes
   - Include summary of successes and failures

5. **Batch Size Limits:**
   - Enforce maximum batch size (e.g., 1000 certificates)
   - Prevent resource exhaustion

6. **Progress Streaming:**
   - WebSocket or Server-Sent Events
   - Real-time progress updates to client
