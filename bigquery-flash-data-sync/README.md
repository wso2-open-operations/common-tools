# BigQuery Flash Data Sync

A Go-based CLI that streams rows from multiple SQL databases (MySQL / PostgreSQL) into Google BigQuery with automatic schema inference, configurable table batching, and structured logging.

## ✅ Highlights

- Dynamic configuration for any number of databases + tables through environment variables
- Schema inference and type mapping that adapt to MySQL/PostgreSQL sources before loading into BigQuery
- Concurrent table jobs powered by `errgroup` + BigQuery JSON load jobs with optional table creation/truncation
- Safety features: dry-run mode, max row parse failure threshold, configurable batching, and database-specific timeouts
- Works with both MySQL and PostgreSQL sources
- UTF-8 data sanitization to prevent BigQuery upload failures

## 📋 Requirements

- Go 1.21+
- Google Cloud SDK (BigQuery API enabled and authenticated)
- Source databases reachable (MySQL 5.7+ / PostgreSQL 12+) with read permissions
- Service account with `bigquery.dataEditor` and `bigquery.jobUser` roles

## 🚀 Quick Start

```bash
# 1. Clone and navigate to the repo
cd bigquery-flash-data-sync

# 2. Install dependencies
go mod download

# 3. Set up authentication
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID

# 4. Bootstrap your configuration
cp .env.example .env
# Edit .env with your credentials (see Configuration below)

# 5. Run in dry-run mode to validate
DRY_RUN=true go run ./cmd/datasync

# 6. Build for production
go build -ldflags "-X main.Version=1.0.0" -o bin/datasync ./cmd/datasync
./bin/datasync
```

## ⚙️ Configuration

All runtime settings are loaded from environment variables. Copy `.env.example` to `.env` and configure your databases.

### Minimal Configuration

```bash
# Google Cloud / BigQuery
GCP_PROJECT_ID=my-gcp-project-123
BQ_DATASET_ID=analytics_data

# Databases to sync (comma-separated identifiers)
SYNC_DATABASES=finance,salesforce

# Finance Database
FINANCE_ENABLED=true
FINANCE_DB_TYPE=mysql
FINANCE_DB_HOST=finance-db.example.com
FINANCE_DB_PORT=3306
FINANCE_DB_NAME=finance_prod
FINANCE_DB_USER=reader
FINANCE_DB_PASSWORD=secret
FINANCE_TABLES=invoices,payments,accounts

# Salesforce Database
SALESFORCE_ENABLED=true
SALESFORCE_DB_TYPE=postgres
SALESFORCE_DB_HOST=salesforce-db.example.com
SALESFORCE_DB_PORT=5432
SALESFORCE_DB_NAME=salesforce_mirror
SALESFORCE_DB_USER=reader
SALESFORCE_DB_PASSWORD=secret
SALESFORCE_TABLES=opportunities,contacts
```

### Global BigQuery & Runtime Settings

| Variable                 | Description                                                                               | Default                     |
| ------------------------ | ----------------------------------------------------------------------------------------- | --------------------------- |
| `GCP_PROJECT_ID`         | Target Google Cloud project                                                               | _required_                  |
| `BQ_DATASET_ID`          | BigQuery dataset where tables are created                                                 | _required_                  |
| `SYNC_TIMEOUT`           | Pipeline timeout (Go duration)                                                            | `10m`                       |
| `DRY_RUN`                | Skip BigQuery writes while exercising extraction                                          | `false`                     |
| `AUTO_CREATE_TABLES`     | Create BigQuery tables when missing                                                       | `true`                      |
| `TRUNCATE_ON_SYNC`       | Replace table contents on first load                                                      | `false`                     |
| `ALLOW_TABLE_RECREATION` | Allow automatic table deletion/recreation on critical schema errors (⚠️ causes data loss) | `false`                     |
| `MAX_ROW_PARSE_FAILURES` | Allowed row parse errors per table (`-1` = unlimited)                                     | `100`                       |
| `DATE_FORMAT`            | Layout for timestamp parsing (`time` package format)                                      | `2006-01-02T15:04:05Z07:00` |
| `DEFAULT_BATCH_SIZE`     | Rows buffered before each load job                                                        | `1000`                      |

### Global Database Defaults

These are used when per-database overrides are not specified:

| Variable                  | Description                            | Default     |
| ------------------------- | -------------------------------------- | ----------- |
| `DB_HOST`                 | Default host                           | `localhost` |
| `DB_PORT`                 | Default port                           | `3306`      |
| `DB_TYPE`                 | Default driver (`mysql` or `postgres`) | `mysql`     |
| `DB_MAX_OPEN_CONNECTIONS` | Connection pool size                   | `10`        |
| `DB_MAX_IDLE_CONNECTIONS` | Idle pool size                         | `10`        |
| `DB_CONN_MAX_LIFETIME`    | Lifetime for pooled connections        | `1m`        |

### TLS/SSL Configuration

Secure database connections with proper certificate verification:

| Variable             | Description                                                | Default                     |
| -------------------- | ---------------------------------------------------------- | --------------------------- |
| `DB_TLS_MODE`        | TLS mode: `disable`, `require`, `verify-ca`, `verify-full` | `verify-full`               |
| `DB_TLS_CA_PATH`     | Path to CA certificate file                                | _required for verify modes_ |
| `DB_TLS_CERT_PATH`   | Path to client certificate (for mutual TLS)                | _optional_                  |
| `DB_TLS_KEY_PATH`    | Path to client private key (for mutual TLS)                | _optional_                  |
| `DB_TLS_SERVER_NAME` | Server name for certificate verification                   | _defaults to host_          |

**TLS Mode Options:**

| Mode          | Encryption | Server Verification | Hostname Check | Security Level        |
| ------------- | ---------- | ------------------- | -------------- | --------------------- |
| `disable`     | ❌         | ❌                  | ❌             | ⚠️ Insecure           |
| `require`     | ✅         | ❌                  | ❌             | ⚠️ Weak               |
| `verify-ca`   | ✅         | ✅                  | ❌             | ✅ Good               |
| `verify-full` | ✅         | ✅                  | ✅             | ✅ Best (recommended) |

### Per-Database Configuration

1. List identifiers in `SYNC_DATABASES` (e.g., `finance,salesforce`)
2. Prefix all variables with the uppercase identifier (e.g., `FINANCE_DB_HOST`)
3. Required per database: `{ID}_DB_NAME`, `{ID}_DB_USER`, `{ID}_TABLES`

```bash
# Example: FINANCE database with custom TLS
FINANCE_ENABLED=true
FINANCE_DB_TYPE=mysql
FINANCE_DB_HOST=finance-db.example.com
FINANCE_DB_PORT=3306
FINANCE_DB_NAME=finance_prod
FINANCE_DB_USER=reader
FINANCE_DB_PASSWORD=secret
FINANCE_TABLES=invoices,payments,accounts

# Per-database TLS override
FINANCE_DB_TLS_MODE=verify-full
FINANCE_DB_TLS_CA_PATH=/path/to/finance-ca.pem

# Per-database timeout overrides
FINANCE_DB_CONN_TIMEOUT=30s
FINANCE_DB_READ_TIMEOUT=60s
FINANCE_DB_WRITE_TIMEOUT=60s
```

### Per-Table Configuration (Optional)

Use `{DATABASE}_{TABLE}_SETTING` for fine-grained control:

```bash
FINANCE_INVOICES_ENABLED=true
FINANCE_INVOICES_TARGET_TABLE=finance_invoices
FINANCE_INVOICES_PRIMARY_KEY=invoice_id
FINANCE_INVOICES_TIMESTAMP_COLUMN=updated_at
FINANCE_INVOICES_COLUMNS=id,amount,status,created_at
FINANCE_INVOICES_BATCH_SIZE=5000
```

## 🏗 Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  MySQL/Postgres │────▶│  Schema Inference │────▶│    BigQuery     │
│   Databases     │     │  & Data Extract   │     │    Dataset      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### How It Works

1.  **Configuration Loading**: Reads environment variables and builds database/table configs with validation
2.  **Schema Inference**: Automatically detects source schemas and maps to BigQuery types
3.  **Concurrent Processing**: Parallel extraction and loading using `errgroup` workers per table
4.  **Data Sanitization**: Handles special characters, NULLs, and invalid UTF-8 sequences
5.  **BigQuery Loading**: Creates/updates tables and loads data via JSON load jobs
6.  **Error Handling**: Configurable row parse failure threshold with detailed logging

### Supported Type Mappings

| MySQL Type              | PostgreSQL Type         | BigQuery Type |
| ----------------------- | ----------------------- | ------------- |
| VARCHAR, CHAR, TEXT     | VARCHAR, TEXT, CITEXT   | STRING        |
| INT, TINYINT, BIGINT    | INTEGER, BIGINT, SERIAL | INTEGER       |
| FLOAT, DOUBLE, DECIMAL  | FLOAT, NUMERIC, REAL    | FLOAT         |
| DATE                    | DATE                    | DATE          |
| TIME                    | TIME, TIMETZ            | TIME          |
| DATETIME, TIMESTAMP     | TIMESTAMP, TIMESTAMPTZ  | TIMESTAMP     |
| BOOLEAN, BOOL, BIT      | BOOLEAN                 | BOOLEAN       |
| BLOB, BINARY, VARBINARY | BYTEA                   | BYTES         |
| JSON                    | JSON, JSONB             | JSON          |
| ENUM, SET               | UUID, INET, CIDR        | STRING        |

## 📁 Project Structure

```
bigquery-flash-data-sync/
├── README.md                    # This file
├── .env.example                 # Configuration template
├── go.mod                       # Go module dependencies
├── go.sum                       # Dependency checksums
├── cmd/
│   └── datasync/
│       └── main.go              # Application entry point
└── internal/
    ├── config/
    │   └── config.go            # Environment parsing, TLS config, validation
    ├── logger/
    │   └── logger.go            # Structured logging (zap)
    ├── model/
    │   ├── models.go            # Data structures, schema comparison
    │   └── parser.go            # Row parsing, UTF-8 sanitization
    └── pipeline/
        ├── bqsetup.go           # Schema inference, table management
        └── job.go               # ETL job orchestration, concurrent sync

```

## ⚠️ Important: Table Recreation Behavior

When critical schema errors are detected (e.g., incompatible type changes), the sync may need to delete and recreate the BigQuery table.

**Default Behavior (Safe):**

- `ALLOW_TABLE_RECREATION=false` (default)
- Sync fails with an error message
- Manual intervention required
- **No data loss**

**Opt-in Behavior (For automated pipelines):**

- `ALLOW_TABLE_RECREATION=true`
- Table is automatically deleted and recreated
- Data is re-synced from source
- **⚠️ WARNING: Causes data loss in BigQuery**

Only enable `ALLOW_TABLE_RECREATION=true` if:

- Your source database is the authoritative data source
- You can afford to re-sync all data
- You're running automated pipelines that need to handle schema changes

## 🔧 Adding New Databases

Simply update your `.env` file — no code changes required:

```bash
# 1. Add to SYNC_DATABASES
SYNC_DATABASES=finance,salesforce,inventory

# 2.  Configure the new database
INVENTORY_ENABLED=true
INVENTORY_DB_TYPE=postgres
INVENTORY_DB_HOST=inventory-db.example.com
INVENTORY_DB_PORT=5432
INVENTORY_DB_NAME=inventory_prod
INVENTORY_DB_USER=reader
INVENTORY_DB_PASSWORD=secret
INVENTORY_TABLES=products,stock_levels,warehouses

# 3. Optional: Add TLS configuration
INVENTORY_DB_TLS_MODE=verify-full
INVENTORY_DB_TLS_CA_PATH=/path/to/inventory-ca.pem
```

## 🐛 Troubleshooting

### Connection Issues

```bash
# Verify MySQL connectivity
mysql -h $DB_HOST -P $DB_PORT -u $USER -p -e "SHOW TABLES"

# Verify PostgreSQL connectivity
psql -h $DB_HOST -p $DB_PORT -U $USER -d $DB_NAME -c "\dt"

# Check BigQuery access
bq ls --project_id=$GCP_PROJECT_ID $BQ_DATASET_ID
```

### Enable Debug Logging

```bash
LOG_LEVEL=debug LOG_ENV=dev go run ./cmd/datasync
```

### Common Errors

| Error                                                     | Solution                                                 |
| --------------------------------------------------------- | -------------------------------------------------------- |
| `Table 'database.table' doesn't exist`                    | Check table names in `{DB}_TABLES` variable              |
| `dial tcp: i/o timeout`                                   | Verify `DB_HOST` and `DB_PORT`, check firewall           |
| `Access denied`                                           | Verify credentials and user permissions                  |
| `Permission denied` (BigQuery)                            | Add `bigquery.dataEditor` role to service account        |
| `invalid character`                                       | Enable debug mode, check for invalid UTF-8 data          |
| `context deadline exceeded`                               | Increase `SYNC_TIMEOUT` value                            |
| `exceeded maximum row parse failures`                     | Increase `MAX_ROW_PARSE_FAILURES` or fix source data     |
| `requires recreation... AllowTableRecreation is disabled` | Set `ALLOW_TABLE_RECREATION=true` or manually fix schema |
| `failed to read CA certificate`                           | Verify `DB_TLS_CA_PATH` points to valid certificate      |

### Test Mode

Run without writing to BigQuery:

```bash
DRY_RUN=true go run ./cmd/datasync
```

## 📊 Performance

| Rows | Columns | Tables | Sync Time | Memory |
| ---- | ------- | ------ | --------- | ------ |
| 1K   | 10      | 5      | ~3s       | ~50MB  |
| 50K  | 25      | 10     | ~20s      | ~200MB |
| 500K | 50      | 15     | ~120s     | ~800MB |

### Optimization Tips

- Increase `DB_MAX_OPEN_CONNECTIONS` for more parallelism
- Adjust `DEFAULT_BATCH_SIZE` based on row size (larger batches = fewer API calls)
- Set appropriate `SYNC_TIMEOUT` for large datasets
- Use `{TABLE}_COLUMNS` to sync only needed columns
- Use `{TABLE}_BATCH_SIZE` for tables with large rows

## 🔒 Security Best Practices

- **Never commit `.env`** to version control (add to `.gitignore`)
- Use **read-only database users** with minimal permissions
- Store production credentials in a **secret manager** (e.g., Google Secret Manager)
- Enable **TLS/SSL** with `verify-full` mode for all database connections
- Provide proper **CA certificates** for certificate verification
- **Rotate credentials** regularly
- Use service accounts with **least-privilege IAM roles**

## 📝 License

Copyright 2025 WSO2 LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
