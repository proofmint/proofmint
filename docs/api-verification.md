# Credential Verification API

Public API for verifying badges and certificates issued through the ProofMint platform.

## Base URL

```
https://proofmint.app/api/verify
```

---

## Endpoints

### 1. Verify Credential (GET)

Query a credential by name, issue date, and recipient email.

#### Request

```http
GET /api/verify?name=<name>&issueDate=<date>&userEmail=<email>
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Name of the badge or certificate template |
| `issueDate` | string | Yes | Date the credential was issued (YYYY-MM-DD format) |
| `userEmail` | string | Yes | Email address of the recipient |

#### Example Request

```bash
curl "https://proofmint.app/api/verify?name=Web%20Development&issueDate=2024-01-15&userEmail=john@example.com"
```

---

### 2. Verify Credential (POST)

Query a credential using a JSON body.

#### Request

```http
POST /api/verify
Content-Type: application/json
```

#### Request Body

```json
{
  "name": "Web Development",
  "issueDate": "2024-01-15",
  "userEmail": "john@example.com"
}
```

#### Example Request

```bash
curl -X POST "https://proofmint.app/api/verify" \
  -H "Content-Type: application/json" \
  -d '{"name": "Web Development", "issueDate": "2024-01-15", "userEmail": "john@example.com"}'
```

---

## Response

### Success Response

**Status Code:** `200 OK`

**Content-Type:** `application/json`

**Response Body:**

```json
{
  "name": "Web Development",
  "issuerName": "Acme Organization",
  "imageUrl": "https://example.com/badge-image.png",
  "dateOfAchievement": "2024-01-15T10:30:00.000Z",
  "type": "badge"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Name of the badge or certificate |
| `issuerName` | string | Organization name of the issuer |
| `imageUrl` | string | URL to the credential image |
| `dateOfAchievement` | string | ISO 8601 timestamp of when the credential was issued |
| `type` | string | Type of credential - either `"badge"` or `"certificate"` |

---

### Error Responses

#### Missing Required Parameters

**Status Code:** `400 Bad Request`

```json
{
  "error": "Missing required parameters: name, issueDate, userEmail"
}
```

#### Invalid Email Format

**Status Code:** `400 Bad Request`

```json
{
  "error": "Invalid email format"
}
```

#### Invalid Date Format

**Status Code:** `400 Bad Request`

```json
{
  "error": "Invalid issue date format"
}
```

#### No Matching Credential Found

**Status Code:** `404 Not Found`

```json
{
  "error": "No matching credential found"
}
```

#### Internal Server Error

**Status Code:** `500 Internal Server Error`

```json
{
  "error": "Internal Server Error"
}
```

---

## Examples

### Successful Badge Verification

**Request:**

```bash
curl "https://proofmint.app/api/verify?name=AWS%20Certified%20Developer&issueDate=2024-03-20&userEmail=jane@example.com"
```

**Response:**

```json
{
  "name": "AWS Certified Developer",
  "issuerName": "TechCorp Solutions",
  "imageUrl": "https://proofmint.app/images/badges/aws-dev.png",
  "dateOfAchievement": "2024-03-20T14:00:00.000Z",
  "type": "badge"
}
```

### Successful Certificate Verification

**Request:**

```bash
curl -X POST "https://proofmint.app/api/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MBA Completion",
    "issueDate": "2023-12-01",
    "userEmail": "ceo@example.com"
  }'
```

**Response:**

```json
{
  "name": "MBA Completion",
  "issuerName": "Harvard Business School",
  "imageUrl": "https://proofmint.app/images/certificates/mba-2023.png",
  "dateOfAchievement": "2023-12-01T09:00:00.000Z",
  "type": "certificate"
}
```

### Not Found Example

**Request:**

```bash
curl "https://proofmint.app/api/verify?name=NonExistent&issueDate=2024-01-01&userEmail=test@example.com"
```

**Response:**

```json
{
  "error": "No matching credential found"
}
```

---

## Implementation Notes

- The API is publicly accessible (no authentication required)
- Email comparison is case-insensitive
- Date matching is done within a 24-hour range on the specified date
- The API searches for badges first, then certificates if no badge is found
- The `dateOfAchievement` in the response is in ISO 8601 format with UTC timezone
- All URLs in the response are permanent and can be embedded in websites or documents

---

## Language Examples

### JavaScript/Node.js

```javascript
async function verifyCredential(name, issueDate, userEmail) {
  const params = new URLSearchParams({
    name,
    issueDate,
    userEmail
  });

  const response = await fetch(`https://proofmint.app/api/verify?${params}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
  
  return response.json();
}

// Usage
verifyCredential('Web Development', '2024-01-15', 'john@example.com')
  .then(data => console.log(data))
  .catch(err => console.error(err));
```

### Python

```python
import requests

def verify_credential(name, issue_date, user_email):
    params = {
        'name': name,
        'issueDate': issue_date,
        'userEmail': user_email
    }
    
    response = requests.get('https://proofmint.app/api/verify', params=params)
    
    if response.status_code == 200:
        return response.json()
    else:
        error = response.json().get('error', 'Unknown error')
        raise Exception(error)

# Usage
try:
    credential = verify_credential('Web Development', '2024-01-15', 'john@example.com')
    print(credential)
except Exception as e:
    print(f"Error: {e}")
```

### PHP

```php
function verifyCredential($name, $issueDate, $userEmail) {
    $url = 'https://proofmint.app/api/verify';
    $params = http_build_query([
        'name' => $name,
        'issueDate' => $issueDate,
        'userEmail' => $userEmail
    ]);
    
    $response = file_get_contents($url . '?' . $params);
    $data = json_decode($response, true);
    
    if (isset($data['error'])) {
        throw new Exception($data['error']);
    }
    
    return $data;
}

// Usage
try {
    $credential = verifyCredential('Web Development', '2024-01-15', 'john@example.com');
    print_r($credential);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
```

### Go

```go
package main

import (
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
)

type Credential struct {
    Name              string `json:"name"`
    IssuerName        string `json:"issuerName"`
    ImageUrl          string `json:"imageUrl"`
    DateOfAchievement string `json:"dateOfAchievement"`
    Type              string `json:"type"`
}

func verifyCredential(name, issueDate, userEmail string) (*Credential, error) {
    baseUrl := "https://proofmint.app/api/verify"
    params := url.Values{
        "name":      {name},
        "issueDate": {issueDate},
        "userEmail": {userEmail},
    }

    resp, err := http.Get(baseUrl + "?" + params.Encode())
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
    }

    var credential Credential
    if err := json.NewDecoder(resp.Body).Decode(&credential); err != nil {
        return nil, err
    }

    return &credential, nil
}

// Usage
func main() {
    credential, err := verifyCredential("Web Development", "2024-01-15", "john@example.com")
    if err != nil {
        fmt.Printf("Error: %v\n", err)
        return
    }
    fmt.Printf("%+v\n", credential)
}
```

---

## Support

For questions or issues, please contact the ProofMint development team.
