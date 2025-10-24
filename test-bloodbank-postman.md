# Blood Bank Creation API Test

## Postman Collection

### 1. Basic Blood Bank Creation

```bash
curl --location 'http://localhost:3000/api/backoffice/v1/bloodbanks' \
--header 'Content-Type: application/json' \
--header 'x-secret: dev-secret' \
--data '{
    "name": "Hospital São Paulo",
    "bloodBanksLocationId": "123e4567-e89b-12d3-a456-426614174000"
}'
```

### 2. Blood Bank with All Fields

```bash
curl --location 'http://localhost:3000/api/backoffice/v1/bloodbanks' \
--header 'Content-Type: application/json' \
--header 'x-secret: dev-secret' \
--data '{
    "name": "Hospital das Clínicas",
    "slug": "hospital-das-clinicas",
    "logo": "https://example.com/logo.png",
    "bloodBanksLocationId": "123e4567-e89b-12d3-a456-426614174001",
    "timezone": "America/Sao_Paulo"
}'
```

### 3. Blood Bank with Custom Timezone

```bash
curl --location 'http://localhost:3000/api/backoffice/v1/bloodbanks' \
--header 'Content-Type: application/json' \
--header 'x-secret: dev-secret' \
--data '{
    "name": "Hospital Rio de Janeiro",
    "bloodBanksLocationId": "123e4567-e89b-12d3-a456-426614174002",
    "timezone": "America/Sao_Paulo"
}'
```

## Postman Setup Instructions

1. **Method**: POST
2. **URL**: `http://localhost:3000/api/backoffice/v1/bloodbanks`
3. **Headers**:
   - `Content-Type: application/json`
   - `x-secret: dev-secret`
4. **Body** (raw JSON):

```json
{
  "name": "Hospital Teste",
  "bloodBanksLocationId": "123e4567-e89b-12d3-a456-426614174000"
}
```

## Expected Response (Success)

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Hospital Teste",
    "slug": "hospital-teste",
    "bloodBanksLocationId": "123e4567-e89b-12d3-a456-426614174000",
    "logo": null,
    "timezone": "America/Sao_Paulo",
    "active": false,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

## Test Cases for Validation

### Invalid Name (too short)

```json
{
  "name": "",
  "bloodBanksLocationId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Invalid UUID

```json
{
  "name": "Hospital Teste",
  "bloodBanksLocationId": "invalid-uuid"
}
```

### Invalid Logo URL

```json
{
  "name": "Hospital Teste",
  "bloodBanksLocationId": "123e4567-e89b-12d3-a456-426614174000",
  "logo": "not-a-valid-url"
}
```

### Invalid Slug

```json
{
  "name": "Hospital Teste",
  "slug": "Invalid Slug!",
  "bloodBanksLocationId": "123e4567-e89b-12d3-a456-426614174000"
}
```

## Notes

- Make sure your development server is running on `localhost:3000`
- The `x-secret` header should match the `SECRET` environment variable (defaults to "dev-secret")
- Each test should use a unique `bloodBanksLocationId` to avoid duplicate key errors
- New blood banks are created with `active: false` by default
