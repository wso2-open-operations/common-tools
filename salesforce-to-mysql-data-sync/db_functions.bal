// Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License. 
import ballerina/log;
import ballerina/sql;
import ballerina/time;
import ballerinax/mysql;
import ballerinax/mysql.driver as _;

configurable DatabaseConf syncDbConf = ?;

const BATCH_SIZE = 100;

// Initialize Azure MySQL Client
@display {
    label: "Salesforce Sync Database Client",
    id: "salesforce-sync-database-client"
}
final mysql:Client dbClient = check new (
    syncDbConf.host,
    syncDbConf.user,
    syncDbConf.password,
    syncDbConf.database,
    options = {
        serverTimezone: "UTC",
        ssl: {
            mode: mysql:SSL_PREFERRED
        }
    }
);

# Insert/Update the Salesforce sync records in the database.
# 
# + sfRecords - Salesforce sync records array
# + return - `()` on successful database update
function dbUpdateSync(any[] sfRecords) returns error? {
    int batchCount = (sfRecords.length() / BATCH_SIZE) + ((sfRecords.length() % BATCH_SIZE) > 0 ? 1 : 0); 
    
    // TODO: Enable transaction once the database connectivity is optimised
    // transaction {
        log:printDebug("[dbUpdateSync()] Executing prepare query by setting 'IsInSF' to 0...");
        sql:ParameterizedQuery initialiseQuery = check dbPrepareInitQuery(sfRecords);
        _ = check dbClient->execute(initialiseQuery);

        foreach int i in int:range(0, batchCount, 1) {
            log:printDebug(string `[dbUpdateSync()] Executing sync record batch ${i + 1} of ${batchCount}...`);
            int batchStartIndex = i * BATCH_SIZE;
            int batchEndIndex = (i + 1) != batchCount
                ? (i + 1) * BATCH_SIZE
                : sfRecords.length();
            any[] insertBatch = sfRecords.slice(batchStartIndex, batchEndIndex);
            sql:ParameterizedQuery[] insertBatchQuery = check dbPrepareBatchQuery(insertBatch);
            _ = check dbClient->batchExecute(insertBatchQuery);
        }
    //     check commit;
    // }
}

# Insert sync start log entry or update sync end status log entry in the database.
# Inserted start log entry returns the database insert ID, which can be used to 
# later update the same row with the end log entry.
# 
# + status - [`PROCESSING`|`COMPLETED`|`FAILED`] - Log status to update
# + syncObj - Salesforce (object) sync type
# + logIndex - Sync log index to update (Only applies to `COMPLETED` or `FAILED` status logs)
# + return - Insert ID as a `int` for start log [`PROCESSING`] entries, or `-1` for end log [`COMPLETED`|`FAILED`] updates
function dbInsertSyncLog(LogStatus status, string syncObj, int logIndex = -1) returns int|error {
    time:Utc currentTimeUtc = time:utcNow();
    time:Civil currentTime = time:utcToCivil(currentTimeUtc);
    match status {
        PROCESSING => {
            log:printDebug(string `[dbInsertSyncLog()] Inserting Processing sync log entry for ${syncObj} in the database...`);

            sql:ParameterizedQuery query = `
                INSERT INTO sf_log (
                    sync_type,
                    start_time,
                    status
                )
                VALUES (
                    ${syncObj},
                    ${currentTime},
                    ${status}
                )
            `;
            sql:ExecutionResult result = check dbClient->execute(query);
            int insertID = check result.lastInsertId.ensureType(int);
            log:printDebug(string `SUCCESS: [dbInsertSyncLog()] inserted row with ID: ${insertID}.`);
            return insertID;
        }
        COMPLETED|FAILED => {
            log:printDebug(string `[dbInsertSyncLog()] Updating ${status.toString()} sync log entry for ${syncObj} in the database...`);
            if logIndex == -1 {
                return error("Invalid sync log index: [dbInsertSyncLog()] Sync log index '-1' provided.");
            }
            sql:ParameterizedQuery query = `
                UPDATE sf_log
                SET
                    end_time = ${currentTime},
                    status = ${status}
                WHERE
                    id = ${logIndex}
            `;
            _ = check dbClient->execute(query);
            log:printDebug(string `SUCCESS: [dbInsertSyncLog()] updated row with ID: ${logIndex}.`);
            return -1;
        }
        _ => {
            return error("Invalid sync status: [dbInsertSyncLog()] Unknown sync status type provided.");
        }
    }
}

# Check whether any sync processes are currently running by querying the last log entry status on the database.
# If the processing log found is older than 1 hour, they are ignored as faulty/erroneous log entries.
# 
# + return - Sync processing (active) status as a `boolean`
function dbCheckProcessing() returns boolean|error {
    log:printDebug("[dbCheckProcessing()] Retrieving sync log processing status from the database...");
    time:Utc hourAgoUtc = [time:utcNow()[0] - (60 * 60)];
    time:Civil hourAgoTime = time:utcToCivil(hourAgoUtc);
    sql:ParameterizedQuery query = `
        SELECT
            id
        FROM
            sf_log
        WHERE
            status = ${PROCESSING}
            AND start_time > ${hourAgoTime}
    `;
    int|error result = dbClient->queryRow(query);
    if result is int {
        log:printDebug(string `SUCCESS: [dbCheckProcessing()] Retrieved processing sync log with ID: ${result}.`);
        return true;
    } else if result is sql:NoRowsError {
        log:printDebug("SUCCESS: [dbCheckProcessing()] No processing sync logs found.");
        return false;
    } else {
        error err = result;
        return err;
    }
}

# Retrieve the last sync log times with the given end sync status for the given sync object type from the database.
# 
# + status - [`COMPLETED`|`FAILED`] - End log status
# + syncObj - Salesforce (object) sync type
# + return - Sync log times as a `DBSyncLogTimes` record, or `()` if no matching logs found
function dbGetLastSyncLog(LogStatus status, string syncObj) returns DBSyncLogTimes|error? {
    log:printDebug(string `[dbGetLastSyncLog()] Retrieving ${status.toString()} sync log times for ${syncObj} from the database...`);
    if [COMPLETED, FAILED].indexOf(status) is () {
        return error("Invalid sync status: [dbGetLastSyncLog()] Only `Completed` and `Failed` log statuses can be retrieved.");
    }
    sql:ParameterizedQuery query = `
        SELECT
            id,
            start_time,
            end_time
        FROM
            sf_log
        WHERE
            status = ${status}
            && sync_type = ${syncObj}
        ORDER BY id DESC
        LIMIT 1
    `;
    DBSyncLogTimes|error result = dbClient->queryRow(query);
    if result is DBSyncLogTimes {
        log:printDebug(string `SUCCESS: [dbGetLastSyncLog()] Retrieved sync times log with ID: ${result.id}.`);
        return result;
    } else if result is sql:NoRowsError {
        log:printDebug("SUCCESS: [dbGetLastSyncLog()] No matching rows found.");
        return;
    } else {
        error err = result;
        return err;
    }
}

# Generate shadow tables of the Salesforce sync tables by calling a stored procedure in the database.
# 
# + return - `()` on successful table generation
function dbShadowCopy() returns error? {
    log:printDebug("[dbShadowCopy()] Generating shadow copies of the sync tables...");
    sql:ProcedureCallResult result = check dbClient->call(`CALL arr_shadow_copy()`);
    check result.close();
}

# Generate the sync initialization SQL query for given Salesforce object records type.
# 
# + records - Salesforce object records array
# + return - Generated initialize query as a `sql:ParameterizedQuery`
function dbPrepareInitQuery(any[] records) returns sql:ParameterizedQuery|error {
    if records is SFAccountSyncRecord[] {
        return `UPDATE sf_account SET IsInSF = 0`;
    }
    if records is SFOpportunitySyncRecord[] {
        return `UPDATE sf_opportunity SET IsInSF = 0`;
    }
    return error(string `Invalid records type: [dbPrepareBatchQuery()] Batch SQL query for passed in record type`
        + string `(${(typeof records).toString()}) not defined.`);
}

# Generate the batch sync (insert/update) SQL query array for given Salesforce object records.
# 
# + records - Salesforce object records array
# + return - Generated batch query as a `sql:ParameterizedQuery` array
function dbPrepareBatchQuery(any[] records) returns sql:ParameterizedQuery[]|error {
    if records is SFAccountSyncRecord[] {
        return from var 'record in records
        select `
            INSERT INTO sf_account (
                Id,
                Name,
                BillingCountry,
                ShippingCountry,
                Sales_Regions__c,
                Sub_Region__c,
                NAICS_Industry__c,
                Sub_Industry__c,
                Account_Classification__c,
                Account_Owner_Email,
                Account_Owner_FullName,
                ARR_Churn_Date__c
            )
            VALUES (
                ${'record.Id},
                ${'record.Name},
                ${'record.BillingCountry},
                ${'record.ShippingCountry},
                ${'record.Sales_Regions__c},
                ${'record.Sub_Region__c},
                ${'record.NAICS_Industry__c},
                ${'record.Sub_Industry__c},
                ${'record.Account_Classification__c},
                ${'record.Owner.Email},
                ${'record.Owner.Name},
                ${'record.ARR_Churn_Date__c}
            )
            ON DUPLICATE KEY UPDATE
                Id = ${'record.Id},
                Name = ${'record.Name},
                BillingCountry = ${'record.BillingCountry},
                ShippingCountry = ${'record.ShippingCountry},
                Sales_Regions__c = ${'record.Sales_Regions__c},
                Sub_Region__c = ${'record.Sub_Region__c},
                NAICS_Industry__c = ${'record.NAICS_Industry__c},
                Sub_Industry__c = ${'record.Sub_Industry__c},
                Account_Classification__c = ${'record.Account_Classification__c},
                Account_Owner_Email = ${'record.Owner.Email},
                Account_Owner_FullName = ${'record.Owner.Name},
                ARR_Churn_Date__c = ${'record.ARR_Churn_Date__c},
                IsInSF = 1
        `;
    }
    if records is SFOpportunitySyncRecord[] {
        return from var 'record in records
        select `
            INSERT INTO sf_opportunity (
                Id,
                Name,
                AccountId,
                CloseDate,
                StageName,
                Confidence__c,
                Primary_Partner_Role__c,
                Entry_Vector__c,
                Renewal_Delayed__c,
                Opportunity_Record_Type,
                ARR__c,
                IAM_ARR__c,
                APIM_ARR__c,
                Integration_ARR__c,
                Open_Banking_ARR__c,
                Delayed_ARR__c,
                IAM_Delayed_ARR__c,
                APIM_Delayed_ARR__c,
                Integration_Delayed__c,
                Cloud_ARR_Opportunity__c,
                IAM_BU_ARR_Opportunity__c,
                APIM_ARR_Opportunity__c,
                Integration_BU_ARR_Opportunity__c,
                Choreo_ARR_Opportunity__c,
                IAM_PSO__c,
                APIM_PSO__c,
                Integration_PSO__c,
                Choreo_PSO__c,
                Cloud_ARR__c,
                IAM_Cloud_ARR__c,
                Integration_Cloud_ARR__c,
                Choreo_ARR__c,
                APIM_Cloud_ARR__c,
                CL_ARR_Today__c, 
                ARR_Cloud_ARR__c,
                IAM_ARR_AND_Cloud__c,
                Integration_ARR_AND_Cloud__c,
                APIM_ARR_Cloud__c,
                Subs_Start_Date__c,
                Subs_End_Date__c,
                Direct_Channel__c,
                Forecast_Type1__c,
                CL_Start_Date_Roll_Up__c,
                CL_End_Date_Roll_Up__c,
                PS_Support_Account_Start_Date_Roll_Up__c,
                PS_Support_Account_End_Date_Roll_Up__c,
                PS_Start_Date_Roll_Up__c,
                PS_End_Date_Roll_Up__c,
                Subscription_Start_Date__c,
                Subscription_End_Date__c,
                Add_to_Forecast__c,
                Opportunity_Owner_Email,
                Opportunity_Owner_FullName
            )
            VALUES (
                ${'record.Id},
                ${'record.Name},
                ${'record.AccountId},
                ${'record.CloseDate},
                ${'record.StageName},
                ${'record.Confidence__c},
                ${'record.Primary_Partner_Role__c},
                ${'record.Entry_Vector__c},
                ${'record.Renewal_Delayed__c},
                ${'record.RecordType?.Name},
                ${'record.ARR__c},
                ${'record.IAM_ARR__c},
                ${'record.APIM_ARR__c},
                ${'record.Integration_ARR__c},
                ${'record.Open_Banking_ARR__c},
                ${'record.Delayed_ARR__c},
                ${'record.IAM_Delayed_ARR__c},
                ${'record.APIM_Delayed_ARR__c},
                ${'record.Integration_Delayed__c},
                ${'record.Cloud_ARR_Opportunity__c},
                ${'record.IAM_BU_ARR_Opportunity__c},
                ${'record.APIM_ARR_Opportunity__c},
                ${'record.Integration_BU_ARR_Opportunity__c},
                ${'record.Choreo_ARR_Opportunity__c},
                ${'record.IAM_PSO__c},
                ${'record.APIM_PSO__c},
                ${'record.Integration_PSO__c},
                ${'record.Choreo_PSO__c},
                ${'record.Cloud_ARR__c},
                ${'record.IAM_Cloud_ARR__c},
                ${'record.Integration_Cloud_ARR__c},
                ${'record.Choreo_ARR__c},
                ${'record.APIM_Cloud_ARR__c},
                ${'record.CL_ARR_Today__c},
                ${'record.ARR_Cloud_ARR__c},
                ${'record.IAM_ARR_AND_Cloud__c},
                ${'record.Integration_ARR_AND_Cloud__c},
                ${'record.APIM_ARR_Cloud__c},
                ${'record.Subs_Start_Date__c},
                ${'record.Subs_End_Date__c},
                ${'record.Direct_Channel__c},
                ${'record.Forecast_Type1__c},
                ${'record.CL_Start_Date_Roll_Up__c},
                ${'record.CL_End_Date_Roll_Up__c},
                ${'record.PS_Support_Account_Start_Date_Roll_Up__c},
                ${'record.PS_Support_Account_End_Date_Roll_Up__c},
                ${'record.PS_Start_Date_Roll_Up__c},
                ${'record.PS_End_Date_Roll_Up__c},
                ${'record.Subscription_Start_Date__c},
                ${'record.Subscription_End_Date__c},
                ${'record.Add_to_Forecast__c},
                ${'record.Owner.Email},
                ${'record.Owner.Name}
            )
            ON DUPLICATE KEY UPDATE
                Id = ${'record.Id},
                Name = ${'record.Name},
                AccountId = ${'record.AccountId},
                CloseDate = ${'record.CloseDate},
                StageName = ${'record.StageName},
                Confidence__c = ${'record.Confidence__c},
                Primary_Partner_Role__c = ${'record.Primary_Partner_Role__c},
                Entry_Vector__c = ${'record.Entry_Vector__c},
                Renewal_Delayed__c = ${'record.Renewal_Delayed__c},
                Opportunity_Record_Type = ${'record.RecordType?.Name},
                ARR__c = ${'record.ARR__c},
                IAM_ARR__c = ${'record.IAM_ARR__c},
                APIM_ARR__c = ${'record.APIM_ARR__c},
                Integration_ARR__c = ${'record.Integration_ARR__c},
                Open_Banking_ARR__c = ${'record.Open_Banking_ARR__c},
                Delayed_ARR__c = ${'record.Delayed_ARR__c},
                IAM_Delayed_ARR__c = ${'record.IAM_Delayed_ARR__c},
                APIM_Delayed_ARR__c = ${'record.APIM_Delayed_ARR__c},
                Integration_Delayed__c = ${'record.Integration_Delayed__c},
                Cloud_ARR_Opportunity__c = ${'record.Cloud_ARR_Opportunity__c},
                IAM_BU_ARR_Opportunity__c = ${'record.IAM_BU_ARR_Opportunity__c},
                APIM_ARR_Opportunity__c = ${'record.APIM_ARR_Opportunity__c},
                Integration_BU_ARR_Opportunity__c = ${'record.Integration_BU_ARR_Opportunity__c},
                Choreo_ARR_Opportunity__c = ${'record.Choreo_ARR_Opportunity__c},
                IAM_PSO__c = ${'record.IAM_PSO__c},
                APIM_PSO__c = ${'record.APIM_PSO__c},
                Integration_PSO__c = ${'record.Integration_PSO__c},
                Choreo_PSO__c = ${'record.Choreo_PSO__c},
                Cloud_ARR__c = ${'record.Cloud_ARR__c},
                IAM_Cloud_ARR__c = ${'record.IAM_Cloud_ARR__c},
                Integration_Cloud_ARR__c = ${'record.Integration_Cloud_ARR__c},
                Choreo_ARR__c = ${'record.Choreo_ARR__c},
                APIM_Cloud_ARR__c = ${'record.APIM_Cloud_ARR__c},
                CL_ARR_Today__c = ${'record.CL_ARR_Today__c},
                ARR_Cloud_ARR__c = ${'record.ARR_Cloud_ARR__c},
                IAM_ARR_AND_Cloud__c = ${'record.IAM_ARR_AND_Cloud__c},
                Integration_ARR_AND_Cloud__c = ${'record.Integration_ARR_AND_Cloud__c},
                APIM_ARR_Cloud__c = ${'record.APIM_ARR_Cloud__c},
                Subs_Start_Date__c = ${'record.Subs_Start_Date__c},
                Subs_End_Date__c = ${'record.Subs_End_Date__c},
                Direct_Channel__c = ${'record.Direct_Channel__c},
                Forecast_Type1__c = ${'record.Forecast_Type1__c},
                CL_Start_Date_Roll_Up__c = ${'record.CL_Start_Date_Roll_Up__c},
                CL_End_Date_Roll_Up__c = ${'record.CL_End_Date_Roll_Up__c},
                PS_Support_Account_Start_Date_Roll_Up__c = ${'record.PS_Support_Account_Start_Date_Roll_Up__c},
                PS_Support_Account_End_Date_Roll_Up__c = ${'record.PS_Support_Account_End_Date_Roll_Up__c},
                PS_Start_Date_Roll_Up__c = ${'record.PS_Start_Date_Roll_Up__c},
                PS_End_Date_Roll_Up__c = ${'record.PS_End_Date_Roll_Up__c},
                Subscription_Start_Date__c = ${'record.Subscription_Start_Date__c},
                Subscription_End_Date__c = ${'record.Subscription_End_Date__c},
                Add_to_Forecast__c = ${'record.Add_to_Forecast__c},
                Opportunity_Owner_Email = ${'record.Owner.Email},
                Opportunity_Owner_FullName = ${'record.Owner.Name},
                IsInSF = 1
        `;
    }
    return error(string `Invalid records type: [dbPrepareBatchQuery()] Batch SQL query for passed in record type ` 
        + string `(${(typeof records).toString()}) not defined.`);
}
