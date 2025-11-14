# Changelog
## Version: 2.0.5
### Changes
- Updated [sync_config] `getSyncConfig()` Salesforce configs by adding two new fields to the `Opportunity` sync.
  - convertCurrency(Choreo_ARR__c)
  - convertCurrency(APIM_Cloud_ARR__c)
- Updated records by adding two new fields to `SFOpportunitySyncRecord` record type.
  - decimal Choreo_ARR__c
  - decimal APIM_Cloud_ARR__c
- Updated [db_functions] `dbPrepareBatchQuery()` database batch execution query by adding two new sync columns to `Opportunity` sync query.
  - Choreo_ARR__c
  - APIM_Cloud_ARR__c
- Updated database table by adding two new sync columns to `sf_opportunity` sync table.
  - [DECIMAL(16,2)] Choreo_ARR__c
  - [DECIMAL(16,2)] APIM_Cloud_ARR__c  
## Version: 2.0.4
### Changes
- Updated [sync_config] `getSyncConfig()` Salesforce configs by adding four new fields to the `Opportunity` sync.
  - convertCurrency(APIM_ARR_Opportunity__c)
  - convertCurrency(Choreo_ARR_Opportunity__c)
  - convertCurrency(APIM_PSO__c)
  - convertCurrency(Choreo_PSO__c)
- Updated records by adding four new fields to `SFOpportunitySyncRecord` record type.
  - decimal APIM_ARR_Opportunity__c
  - decimal Choreo_ARR_Opportunity__c
  - decimal APIM_PSO__c
  - decimal Choreo_PSO__c
- Updated [db_functions] `dbPrepareBatchQuery()` database batch execution query by adding four new sync columns to `Opportunity` sync query.
  - APIM_ARR_Opportunity__c
  - Choreo_ARR_Opportunity__c
  - APIM_PSO__c
  - Choreo_PSO__c 
- Updated database table by adding four new sync columns to `sf_opportunity` sync table.
  - [DECIMAL(16,2)] APIM_ARR_Opportunity__c
  - [DECIMAL(16,2)] Choreo_ARR_Opportunity__c 
  - [DECIMAL(16,2)] APIM_PSO__c
  - [DECIMAL(16,2)] Choreo_PSO__c   
## Version: 2.0.3
### Changes
- Updated Ballerina version from Swan Lake Update 7 (2201.7.1) -> Swan Lake Update 7 (2201.7.5).
- Updated [sf_functions] `salesforceEP` Salesforce client by adding HTTP/1.1 configs as a workaround for Choreo connectivity issue. [1]

[1] Mail: _[ATTENTION REQUIRED] Experiencing intermittent timeouts in most Internal Apps and Integrations running on Choreo_
## Version: 2.0.2
### Changes
- Updated [sync_config] `getSyncConfig()` Salesforce configs by adding two new fields to the `Opportunity` sync.
  - convertCurrency(APIM_ARR__c)
  - convertCurrency(APIM_Delayed_ARR__c)
- Updated records by adding two new fields to `SFOpportunitySyncRecord` record type.
  - decimal APIM_ARR__c
  - decimal APIM_Delayed_ARR__c
- Updated [db_functions] `dbPrepareBatchQuery()` database batch execution query by adding two new sync columns to `Opportunity` sync query.
  - APIM_ARR__c
  - APIM_Delayed_ARR__c
- Updated database table by adding two new sync columns to `sf_opportunity` sync table.
  - [DECIMAL(16,2)] APIM_ARR__c
  - [DECIMAL(16,2)] APIM_Delayed_ARR__c
- Ballerina version upgraded to 2201.7.1
## Version: 2.0.1
### Changes
- Updated [db_functions] `dbUpdateSync()` database update sync function to perform insertion in chunks.
- Updated [db_functions] `dbUpdateSync()` database update sync function by disabling transaction block until the database connectivity is optimised.
## Version: 2.0.0
### Changes
- Renamed [types] `ConfSFSync` configuration record name -> `SfSyncConf`.
- Renamed [types] `ConfAuthSalesforce` configuration record name -> `SalesforceAuthConf`.
- Renamed [types] `ConfDatabase` configuration record name -> `DatabaseConf`.
- Renamed [types] `ConfChoreoApp` configuration record name -> `ChoreoApp`.
- Renamed [types] `ConfErrorEmail` configuration record name -> `ErrorEmail`.
- Removed [sync_config] `accountSyncIntervalHours` configurable of type `decimal`.
- Removed [sync_config] `opportunitySyncIntervalHours` configurable of type `decimal`.
- Convert the Ballerina Service to a Ballerina Function executable.
  - Rename Ballerina entry file `service.bal` -> `main.bal`.
  - Removed `/{syncObject}` resource endpoint to sync Salesforce objects to the database.
  - Removed `/info/{syncObject}` resource endpoint to fetch sync status information.
  - Removed [types] `SyncInfo` sync info record.
  - Removed [types] `SyncInfoItem` sync info item record.
  - Removed [types] `SyncInfoResponse` info response record.
  - Removed [types] `ServiceErrorDetail` service error details record.
  - Removed [types] `BadRequestError` `400: Bad Request` response record.
  - Removed [types] `InternalServerError` `500: Internal Server Error` response record.
  - Removed [utils] `ackCaller()` HTTP caller acknowledge function.
  - Removed [utils] `generateInfoPayload()` info payload generation function.
- Removed the redundant caching functionalities with the new flow.
  - Removed [types] `CacheKeys` cache key enum.
  - Removed [types] `ServiceStatus` service status cache enum.
  - Removed [utils] `cacheInit()` cache initialisation function.
  - Removed [utils] `cacheReset()` cache reset function.
  - Removed [utils] `cacheSyncBegin()` sync begin cache function.
  - Removed [utils] `cacheSyncEnd()` sync end cache function.
- Removed failure email notification functionalities.
  - Removed [types] `ChoreoApp` Choreo OAuth2 app configuration record.
  - Removed [types] `ErrorEmail` error email configuration record.
  - Removed [utils] `sendErrorEmail()` error notification function.

### New
- Added [types] `SfSyncMinimalConf` configuration record for configuring minimal options.
  - `enabled` [boolean]
  - `periodInHours` [decimal]
- Added [sync_config] `accountSync` sync configurable of type `SfSyncMinimalConf`.
- Added [sync_config] `opportunitySync` sync configurable of type `SfSyncMinimalConf`.
- Added `executeSync()` function to sync Salesforce objects to the database.
## Version: 1.1.6
### Changes
- Updated [types] `ConfErrorEmail` by updating fields.
  - Removed `baseUrl` [string]
  - Removed `tokenUrl` [string]
  - Removed `accessKey` [string]
  - Removed `secretKey` [string]
- Renamed [db_functions] `azureMySql` database configurable variable -> `syncDbConf`.
### New
- Added [types] `ConfChoreoApp` OAuth app configuration record.
- Added [utils] `errEmailBaseUrl` configurable variable for error email client base URL.
- Added [utils] `errEmailAuth` configurable variable for error email client OAuth credentials.
## Version: 1.1.5
### Changes
- Updated Ballerina version from Swan Lake Update 3 (2201.3.1) -> Swan Lake Update 5 (2201.5.0).
- Updated license headers. (`Inc.` -> `LLC.`)
- Updated Ballerina module import order. ([order of imports](https://learn-ballerina.github.io/best_practices/format_the_code.html?highlight=import#order-of-the-imports-in-a-bal-file))
- Renamed [types] `ConfSalesforce` Salesforce configuration record -> `ConfAuthSalesforce`.
- Updated [types] `ConfAuthSalesforce` by updating fields.
  - Removed `baseUrl` [string]
- Updated [types] `ConfDatabase` by updating fields.
  - Renamed `hostname` [string] -> `host` [string]
  - Renamed `username` [string] -> `user` [string]
- Renamed [sf_functions] `sfConfig` configurable variable -> `sfAuth`.
- Refactored [sf_functions] `sfQueryAccount` function.
- Refactored [sf_functions] `sfQueryOpportunity` function.
- Removed `servicePort` configurable port number by hard coding the value to `9090`.
### New
- Added [sf_functions] `sfBaseUrl` `string` configurable to configure Salesforce base URL.
- Added `display` annotation to service.
- Added [db_functions] `display` annotation to Azure database client.
- Added [sf_functions] `display` annotation to Salesforce client.
## Version: 1.1.4
### Changes
- Renamed Ballerina file `record.bal` -> `types.bal` which contains the service type defintions.
- Renamed Ballerina file `util.bal` -> `utils.bal` which contains the utility/supporting functions.
- Updated [utils] `generateInfoPayload()` function return type from `json` -> `SyncInfo`.
- Updated GET `/info/{syncObject}` resource endpoint return types.
  - Replaced `http:Ok` -> `SyncInfoResponse`.
  - Replaced `http:BadRequest` -> `BadRequestError`.
  - Replaced `http:InternalServerError` -> `InternalServerError`.
### New
- Added [types] `SyncInfoItem` for capturing sync object information.
- Added [types] `SyncInfo` for capturing overall sync information.
- Added [types] `ServiceErrorDetail` for capturing service errors.
- Added [types] `BadRequestError` for returning bad request (400) responses.
- Added [types] `InternalServerError` for returning internal server error (500) responses.
- Added [types] `SyncInfoResponse` for returning success responses.
## Version: 1.1.3
### Changes
- Updated [sync_config] `getSyncConfig()` Salesforce configs by adding a new field to the `Opportunity` sync.
  - convertCurrency(Cloud_ARR__C)
- Updated records by adding a new field to `SFOpportunitySyncRecord` record type.
  - decimal? Cloud_ARR__C
- Updated [db_functions] `dbPrepareBatchQuery()` database batch execution query by adding a new sync column to `Opportunity` sync query.
- Updated database table by adding a new sync column to `sf_opportunity` sync table.
  - [DECIMAL(16,2)] Cloud_ARR__C
## Version: 1.1.2
### Changes
- Updated [sync_config] `getSyncConfig()` Salesforce configs by adding 2 new fields to the `Opportunity` sync.
  - convertCurrency(IAM_Cloud_ARR__c)
  - convertCurrency(Integration_Cloud_ARR__c)
- Updated records by adding 2 new fields to `SFOpportunitySyncRecord` record type.
  - decimal? IAM_Cloud_ARR__c
  - decimal? Integration_Cloud_ARR__c
- Updated [db_functions] `dbPrepareBatchQuery()` database batch execution query by adding 2 new sync columns to `Opportunity` sync query.
- Updated database table by adding 2 new sync columns to `sf_opportunity` sync table.
  - [DECIMAL(16,2)] IAM_Cloud_ARR__c
  - [DECIMAL(16,2)] Integration_Cloud_ARR__c
- Inferred [util] safe cache access/updates by locking the thread during cache operations.
## Version: 1.1.1
### Changes
- Updated Ballerina version from `Swan Lake 2201.1.1` -> `Swan Lake 2201.1.2`
## Version: 1.1.0
### Changes
- Updated Ballerina version from `Swan Lake Beta6` -> `Swan Lake 2201.1.1`
- Updated [sf_functions] Salesforce connector from `ballerinax/sfdc` -> `ballerinax/salesforce.rest`.
  - Updated `salesforceConfig` Salesforce client configuration.
  - Updated querying methods from `getQueryResult()` and `getNextQueryResult()` -> new `query()` method.
- Updated [sf_functions] individual Salesforce string configurables to a record type configurable `sfConfig`.
- Updated [db_functions] individual database string configurables to a record type configurable `azureMySql`.
- Updated [records] `ConfErrorEmail` record field names from all capital snake-case to camel-case.
- Updated [util] error email configuration name from `ERR_EMAIL` -> `errEmailConf`.
- Updated [service] service port configuration name from `SERVICE_PORT` -> `servicePort`.
- Updated [service] running mode check configuration name from `IS_PROD` -> `isProd`.
- Updated [util] sync status check function name from `cacheSyncStatus()` -> `checkSyncStatus()`.
- Updated [util] `cacheSyncEnd()` function to return `string` or `()`, where nil is returned if there are no pending syncs.
### New
- Added [util] `handleSalesforceError()` function to handle Salesforce response errors.
- Added [records] `ConfSalesforce` configuration record for Salesforce service client.
- Added [records] `SalesforceResponseError` record to capture Salesforce response errors.
- Added [records] `ConfDatabase` configuration record for Azure MySQL client.
- Added [sync_config] sync interval period configurations for each sync type.
  - `accountSyncIntervalHours` to define Account sync interval in hours.
  - `opportunitySyncIntervalHours` to define Opportunity sync interval in hours.
## Version: 1.0.5
### New
- Added [ConfErrorEmail] configuration record for email service client.
- Added [sendErrorEmail()] util function to report failures via email.
- Added `IS_PROD` boolean configurable to dynamically handle environment based variables/logic.
## Version: 1.0.4
### New
- Added `/info/{syncObject}` resource endpoint to fetch sync status information.
- Added [generateInfoPayload()] util function to generate sync status information payload.
## Version: 1.0.3
### New
- Added [DBSyncLogTimes] database record to store database log sync times.
- Added [dbGetLastSyncLog()] database function to retrieve last sync log matching the given criteria (status, sync object type).
- Added [dbCheckProcessing()] database function to check whether any active syncs are being processed.
- Added `400:Bad Request` error response in `/{syncObject}` resource endpoint for providing unsupported sync object types.
- Added [ackCaller()] util function to acknowledge the service caller. _(added to avoid METHOD TOO LARGE Ballerina issue)_
- Added [processSyncObject()] util function to process the provided sync object. _(added to avoid METHOD TOO LARGE Ballerina issue)_
### Changes
- Updated `mysql:Client` database client server timezone in connection options to `UTC`, to fetch log times from database as UTC timezone timestamps. (since within the service all times are processed in UTC timezone.)
- Updated `dbSyncLogEntry()` function name to `dbInsertSyncLog()`.
- Updated [dbInsertSyncLog()] database function Ballerina documentation.
- Removed the following fields from the `ConfSFSync` record, as these values are dynamically fetched from the database.
  - lastStartedTime
  - lastSuccessTime
- Removed cache storage of `ConfSFSync` record type configs, as sync log times are removed from the cache and dynamically fetched from the database.
- Updated [cacheInit()] util function by removing the initialisation of sync (`ConfSFSync`) configs.
- Updated [cacheSyncStatus()] util function by using database-fetched sync times for comparison, instead of using (now removed) cached sync times.
- Updated [cacheSyncStatus()] util function by removing the update logic for the (now removed) cached sync start time.
- Updated [cacheSyncEnd()] util function by removing the update logic for the (now removed) cached sync success time.
- Updated [cacheSyncEnd()] util function by removing the `success` status parameter, it is no longer being used to update the cached sync success time.
## Version: 1.0.2
### New
- Added [dbShadowCopy()] database function to generate shadow copies of sync tables.
### Changes
- Updated `dbSyncLogEntry()` function to return `-1` instead of `0`, on successful log updates for `COMPLETED` and `FAILED` statuses.
## Version: 1.0.1
### Changes
- Updated [getSyncConfig()] Salesforce configs by adding 6 new fields to the `Opportunity` sync.
  - CloseDate
  - convertCurrency(Cloud_ARR_Opportunity__c)
  - convertCurrency(IAM_BU_ARR_Opportunity__c)
  - convertCurrency(Integration_BU_ARR_Opportunity__c)
  - convertCurrency(IAM_PSO__c)
  - convertCurrency(Integration_PSO__c)
- Updated records by adding 6 new fields to `SFOpportunitySyncRecord` record type.
  - string CloseDate
  - decimal? Cloud_ARR_Opportunity__c
  - decimal? IAM_BU_ARR_Opportunity__c
  - decimal? Integration_BU_ARR_Opportunity__c
  - decimal? IAM_PSO__c
  - decimal? Integration_PSO__c
- Updated [dbPrepareBatchQuery()] database batch execution query by adding 6 new sync columns to `Opportunity` sync query.
- Updated database table by adding 6 new sync columns to `sf_opportunity` sync table.
  - [DATE] CloseDate
  - [DECIMAL(16,2)] Cloud_ARR_Opportunity__c
  - [DECIMAL(16,2)] IAM_BU_ARR_Opportunity__c
  - [DECIMAL(16,2)] Integration_BU_ARR_Opportunity__c
  - [DECIMAL(16,2)] IAM_PSO__c
  - [DECIMAL(16,2)] Integration_PSO__c
- Updated some columns of `sf_account` table to `NOT NULL`, to match the required/non-nillable fields in the sync.
  - [VARCHAR(100)] Name
  - [VARCHAR(100)] Account_Owner_Email
  - [VARCHAR(100)] Account_Owner_FullName
- Updated currency columns of `sf_opportunity` table from `DECIMAL(10,0)` -> `DECIMAL(16,2)`, to provide more precision to the sync data.
  - [DECIMAL(16,2)] ARR__c
  - [DECIMAL(16,2)] IAM_ARR__c
  - [DECIMAL(16,2)] Integration_ARR__c
  - [DECIMAL(16,2)] Open_Banking_ARR__c
  - [DECIMAL(16,2)] Delayed_ARR__c
  - [DECIMAL(16,2)] IAM_Delayed_ARR__c
  - [DECIMAL(16,2)] Integration_Delayed__c
  - [DECIMAL(16,2)] OB_Delayed_ARR__c
  - [DECIMAL(16,2)] CL_ARR_Today__c
## Version: 1.0.0
### New
- Added `/{syncObject}` resource endpoint to sync Salesforce objects to the database.
- Added Salesforce configs and functions to retrieve `Account` and `Opportunity` object data from Salesforce.
- Added database functions to insert/update Salesforce sync data.
- Added database functions to maintain sync status (processing, completed, failed) logs.
- Added record types for each sync object and enums for service/database maintained statuses.
- Added caching functions to cache/queue concurrent sync calls.
- Added caching functions to maintain sync statuses (start/end times) to decide whether to process the current sync call.
