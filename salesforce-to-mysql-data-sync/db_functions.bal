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
    // Execute transaction to insert all records.
    transaction {
        log:printDebug("[dbUpdateSync()] Executing prepare query by setting 'IsInSF' to 0...");
        sql:ParameterizedQuery initialiseQuery = check dbPrepareInitQuery(sfRecords);
        _ = check dbClient->execute(initialiseQuery);

        log:printDebug(string `[dbUpdateSync()] Executing sync record insertion...`);
        sql:ParameterizedQuery[] insertQuery = check dbInsertQuery(sfRecords);
        _ = check dbClient->batchExecute(insertQuery);
        check commit;
    }
    on fail error e {
        log:printError(string `[dbUpdateSync()] Transaction failed and rolled back: ${e.message()}`);
        return e;
    }
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
    return error(string `Invalid records type: [dbInsertQuery()] Batch SQL query for passed in record type`
        + string `(${(typeof records).toString()}) not defined.`);
}

# Generate the sync (insert/update) SQL query array for given Salesforce object records.
#
# + records - Salesforce object records array
# + return - Generated query as a `sql:ParameterizedQuery` array
function dbInsertQuery(any[] records) returns sql:ParameterizedQuery[]|error {
    if records is SFAccountSyncRecord[] {
        return from var 'record in records
            select `
            INSERT INTO sf_account (
                Id,
                Name,
                BillingCountry,
                ShippingCountry,
                Account_Owner_Email,
                Account_Owner_FullName
            )
            VALUES (
                ${'record.Id},
                ${'record.Name},
                ${'record.BillingCountry},
                ${'record.ShippingCountry},
                ${'record.Owner.Email},
                ${'record.Owner.Name}
            )
            ON DUPLICATE KEY UPDATE
                Id = ${'record.Id},
                Name = ${'record.Name},
                BillingCountry = ${'record.BillingCountry},
                ShippingCountry = ${'record.ShippingCountry},
                Account_Owner_Email = ${'record.Owner.Email},
                Account_Owner_FullName = ${'record.Owner.Name},
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
                Opportunity_Owner_Email,
                Opportunity_Owner_FullName
            )
            VALUES (
                ${'record.Id},
                ${'record.Name},
                ${'record.AccountId},
                ${'record.CloseDate},
                ${'record.StageName},
                ${'record.Owner.Email},
                ${'record.Owner.Name}
            )
            ON DUPLICATE KEY UPDATE
                Id = ${'record.Id},
                Name = ${'record.Name},
                AccountId = ${'record.AccountId},
                CloseDate = ${'record.CloseDate},
                StageName = ${'record.StageName},
                Opportunity_Owner_Email = ${'record.Owner.Email},
                Opportunity_Owner_FullName = ${'record.Owner.Name},
                IsInSF = 1
        `;
    }
    return error(string `Invalid records type: [dbInsertQuery()] Batch SQL query for passed in record type `
        + string `(${(typeof records).toString()}) not defined.`);
}
