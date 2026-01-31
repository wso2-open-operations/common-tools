# QR Code Generation Service

A simple HTTP service for generating QR codes built with Go.

## Features

- Generate QR codes from any text or URL
- Configurable QR code size
- RESTful API
- Health check endpoint
- Secure with request size limits and timeouts

## Prerequisites

- Go 1.25.4 or higher

## Installation

```bash
# Clone the repository
cd operations/qr-generation

# Install dependencies
go mod tidy

# Build the service
make build
```

## Running the Service

### Using Make

```bash
make run
```

### Using Go directly

```bash
go run cmd/api/main.go
```

### Using the binary

```bash
./bin/qr-api
```

The service will start on port 8080 by default.

## Configuration

Configure the service using environment variables. Copy `.env.example` to `.env` and customize as needed.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8080 | Server port |
| `READ_TIMEOUT` | 5s | HTTP read timeout (Go duration format) |
| `WRITE_TIMEOUT` | 10s | HTTP write timeout (Go duration format) |
| `SHUTDOWN_TIMEOUT` | 5s | Graceful shutdown timeout (Go duration format) |
| `MAX_BODY_SIZE` | 524288 | Max request body size in bytes (512KB) |
| `MIN_SIZE` | 64 | Minimum QR code size in pixels |
| `MAX_SIZE` | 2048 | Maximum QR code size in pixels |
| `LOG_LEVEL` | info | Logging level: `debug`, `info`, `warn`, `error` |
| `LOG_ENV` | dev | Log format: `dev` (text) or `prod` (JSON) |

### Logging Configuration

The service uses structured logging with configurable levels:

- **`LOG_LEVEL`**: Controls which messages are logged
  - `debug`: Most verbose, includes all messages (recommended for development/debugging)
  - `info`: Standard informational messages (recommended for production)
  - `warn`: Warning messages and errors only
  - `error`: Error messages only

- **`LOG_ENV`**: Controls the log output format
  - `dev`: Human-readable text format (recommended for local development)
  - `prod`: JSON format for structured log parsing (recommended for production/Choreo)

### Configuration Examples

**Development (verbose logging):**
```bash
export LOG_LEVEL=debug
export LOG_ENV=dev
./bin/qr-api
```

**Production (JSON logs):**
```bash
export LOG_LEVEL=info
export LOG_ENV=prod
export PORT=8080
./bin/qr-api
```

**Debugging in Choreo:**
```bash
# Set these in Choreo environment variables
LOG_LEVEL=debug
LOG_ENV=prod
```

### Using .env file

```bash
# Copy example file
cp .env.example .env

# Edit .env with your configuration
# Then run the service (if using a tool that loads .env)
./bin/qr-api
```

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok"
}
```

### Generate QR Code

```bash
POST /generate?size={pixels}
```

**Query Parameters:**
- `size` (optional): QR code size in pixels (64-2048, default: 256)

**Request Body:**
- Raw text or URL to encode

**Response:**
- PNG

**Examples:**

Generate a QR code for a URL:
```bash
curl -X POST "http://localhost:8080/generate?size=256" \
  -d "https://wso2.com" \
  --output qrcode.png
```

Generate a QR code for text:
```bash
curl -X POST "http://localhost:8080/generate?size=512" \
  -d "Hello World" \
  --output qrcode.png
```

## Development

### Build

```bash
make build
```

### Run tests

```bash
make test
```

### Clean build artifacts

```bash
make clean
```

### Update dependencies

```bash
make tidy
```

## Project Structure

```
.
├── cmd/
│   └── api/
│       └── main.go           # Application entry point
├── internal/
│   ├── config/
│   │   └── config.go         # Configuration management
│   ├── logger/
│   │   └── logger.go         # Centralized logging setup
│   ├── qr/
│   │   └── service.go        # QR code generation logic
│   └── transport/
│       └── http/
│           ├── handler.go    # HTTP handlers
│           └── middleware.go # Request logging and method checks
├── .choreo/
│   └── component.yaml        # Choreo deployment configuration
├── bin/                      # Build output (gitignored)
├── .env.example              # Example environment configuration
├── openapi.yaml              # OpenAPI specification
├── go.mod                    # Go module definition
├── go.sum                    # Go module checksums
└── README.md                 # This file
```

## Logging

The service provides comprehensive logging for debugging and monitoring:

### Log Levels

- **Debug**: Detailed information for debugging (request/response details, parsing steps)
- **Info**: General operational messages (server start/stop, request completion)
- **Warn**: Warning messages (invalid inputs, deprecated features)
- **Error**: Error messages (failures, exceptions)

### Viewing Logs

**Local Development (text format):**
```bash
LOG_ENV=dev LOG_LEVEL=debug ./bin/qr-api
```

**Production/Choreo (JSON format):**
```bash
LOG_ENV=prod LOG_LEVEL=info ./bin/qr-api
```

### Example Log Output

**Debug level (dev format):**
```
2026-01-29T10:00:00Z DEBUG Starting QR generation service initialization
2026-01-29T10:00:00Z DEBUG Configuration loaded port=8080 read_timeout=5s
2026-01-29T10:00:01Z INFO Starting server port=8080 addr=:8080
2026-01-29T10:00:05Z DEBUG Received QR generation request method=POST
2026-01-29T10:00:05Z INFO QR code request completed successfully size=256
```

**Info level (prod format - JSON):**
```json
{"time":"2026-01-29T10:00:00Z","level":"INFO","msg":"Starting server","port":"8080","addr":":8080"}
{"time":"2026-01-29T10:00:05Z","level":"INFO","msg":"QR code request completed successfully","data_length":18,"size":256,"output_size":1234,"remote_addr":"127.0.0.1:54321"}
```

## License

See the LICENSE file in the repository root.
