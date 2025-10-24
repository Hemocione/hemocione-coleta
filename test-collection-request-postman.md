# Collection Request Creation API Test

## Postman Collection

### 1. Basic Collection Request Creation

```bash
curl --location 'http://localhost:3000/api/backoffice/v1/bloodbanks/123e4567-e89b-12d3-a456-426614174000/collection-requests' \
--header 'Content-Type: application/json' \
--header 'x-secret: dev-secret' \
--data '{
    "institutionId": "123e4567-e89b-12d3-a456-426614174001",
    "requestedByUserId": "123e4567-e89b-12d3-a456-426614174002",
    "requestedDates": [
        {
            "availableDateId": "507f1f77bcf86cd799439011"
        }
    ]
}'
```

### 2. Collection Request with Specific Slots

```bash
curl --location 'http://localhost:3000/api/backoffice/v1/bloodbanks/123e4567-e89b-12d3-a456-426614174000/collection-requests' \
--header 'Content-Type: application/json' \
--header 'x-secret: dev-secret' \
--data '{
    "institutionId": "123e4567-e89b-12d3-a456-426614174001",
    "requestedByUserId": "123e4567-e89b-12d3-a456-426614174002",
    "requestedDates": [
        {
            "availableDateId": "507f1f77bcf86cd799439011",
            "slotIds": ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"]
        }
    ]
}'
```

### 3. Collection Request with Multiple Dates

```bash
curl --location 'http://localhost:3000/api/backoffice/v1/bloodbanks/123e4567-e89b-12d3-a456-426614174000/collection-requests' \
--header 'Content-Type: application/json' \
--header 'x-secret: dev-secret' \
--data '{
    "institutionId": "123e4567-e89b-12d3-a456-426614174001",
    "requestedByUserId": "123e4567-e89b-12d3-a456-426614174002",
    "requestedDates": [
        {
            "availableDateId": "507f1f77bcf86cd799439011"
        },
        {
            "availableDateId": "507f1f77bcf86cd799439014",
            "slotIds": ["507f1f77bcf86cd799439015"]
        }
    ]
}'
```

## Postman Setup Instructions

1. **Method**: POST
2. **URL**: `http://localhost:3000/api/backoffice/v1/bloodbanks/{bloodBanksLocationId}/collection-requests`
3. **Headers**:
   - `Content-Type: application/json`
   - `x-secret: dev-secret`
4. **Body** (raw JSON):

```json
{
  "institutionId": "123e4567-e89b-12d3-a456-426614174001",
  "requestedByUserId": "123e4567-e89b-12d3-a456-426614174002",
  "requestedDates": [
    {
      "availableDateId": "507f1f77bcf86cd799439011"
    }
  ]
}
```

## Expected Response (Success)

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439016",
    "institutionId": "123e4567-e89b-12d3-a456-426614174001",
    "institutionName": "Hospital Teste",
    "institutionLocation": {
      "type": "Point",
      "coordinates": [-46.6333, -23.5505]
    },
    "institutionAddress": "Rua Teste, 123",
    "institutionLogo": "https://example.com/logo.png",
    "requestedByUserId": "123e4567-e89b-12d3-a456-426614174002",
    "bloodBanksLocationId": "123e4567-e89b-12d3-a456-426614174000",
    "requestedDates": [
      {
        "availableDateId": "507f1f77bcf86cd799439011",
        "slotIds": [],
        "date": "2024-01-20",
        "startTime": "2024-01-20T08:00:00.000Z",
        "endTime": "2024-01-20T17:00:00.000Z",
        "teamName": "Equipe A",
        "teamColor": "#FF5733",
        "isLocked": false
      }
    ],
    "status": "pending",
    "statusHistory": [
      {
        "status": "pending",
        "changedAt": "2024-01-15T10:30:00.000Z",
        "changedBy": "123e4567-e89b-12d3-a456-426614174002",
        "reason": "Request created by backoffice"
      }
    ],
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

## Test Cases for Validation

### Invalid Institution ID

```json
{
  "institutionId": "invalid-uuid",
  "requestedByUserId": "123e4567-e89b-12d3-a456-426614174002",
  "requestedDates": [
    {
      "availableDateId": "507f1f77bcf86cd799439011"
    }
  ]
}
```

### Invalid Available Date ID

```json
{
  "institutionId": "123e4567-e89b-12d3-a456-426614174001",
  "requestedByUserId": "123e4567-e89b-12d3-a456-426614174002",
  "requestedDates": [
    {
      "availableDateId": "invalid-objectid"
    }
  ]
}
```

### Too Many Requested Dates

```json
{
  "institutionId": "123e4567-e89b-12d3-a456-426614174001",
  "requestedByUserId": "123e4567-e89b-12d3-a456-426614174002",
  "requestedDates": [
    {
      "availableDateId": "507f1f77bcf86cd799439011"
    },
    {
      "availableDateId": "507f1f77bcf86cd799439012"
    },
    {
      "availableDateId": "507f1f77bcf86cd799439013"
    },
    {
      "availableDateId": "507f1f77bcf86cd799439014"
    }
  ]
}
```

### Empty Requested Dates

```json
{
  "institutionId": "123e4567-e89b-12d3-a456-426614174001",
  "requestedByUserId": "123e4567-e89b-12d3-a456-426614174002",
  "requestedDates": []
}
```

## Notes

- Make sure your development server is running on `localhost:3000`
- The `x-secret` header should match the `SECRET` environment variable (defaults to "dev-secret")
- The `bloodBanksLocationId` in the URL must be a valid UUID
- The `availableDateId` must be a valid MongoDB ObjectId (24 hex characters)
- The `slotIds` are optional and must be valid MongoDB ObjectIds if provided
- You can request between 1 and 3 dates maximum
- The blood bank must exist and have available dates for the request to succeed
