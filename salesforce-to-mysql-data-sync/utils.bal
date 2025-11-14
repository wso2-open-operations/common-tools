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
import ballerina/time;

# Process the sync by retrieving the data from Salesforce and updating the database for the given sync object type.
# (This function was written to avoid METHOD TOO LARGE Ballerina error)
# 
# + syncObj - Sync object to process
# + return - `()` on successful process completion
function processSyncObject(string syncObj) returns error? {
    // Check and retrieve the sync config for the provided Salesforce object
    SfSyncConf syncConfig = check getSyncConfig(syncObj);

    match syncObj {
        ACCOUNT => {
            SFAccountSyncRecord[] sfRecords = check sfQueryAccount(syncConfig);
            check dbUpdateSync(sfRecords);
        }
        OPPORTUNITY => {
            SFOpportunitySyncRecord[] sfRecords = check sfQueryOpportunity(syncConfig);
            check dbUpdateSync(sfRecords);
        }
    }
}

# Check whether the sync is up-to-date for the given sync object by comparing
# the last sync completed time with the defined sync interval/period.
# 
# + syncObj - Sync Object to check
# + return - `true` if the sync is up-to-date, or `false` if it needs to be re-synced
function checkSyncStatus(string syncObj) returns boolean|error {
    // Get the configured sync period for the sync (in seconds)
    SfSyncConf syncConf = check getSyncConfig(syncObj);
    decimal syncPeriodInSecs = syncConf.periodInHours * 60 * 60;

    // Compare with the time since last successfully completed sync
    time:Utc timeCurrent = time:utcNow();
    time:Utc timeLastSuccess = [0];
    
    // If prior sync logs exist in the log table (database), get the last success sync time from the database
    DBSyncLogTimes? syncTimes = check dbGetLastSyncLog(COMPLETED, syncObj);
    if syncTimes !is () {
        timeLastSuccess = syncTimes.end_time;
    }
    time:Seconds timeSinceLastSync = time:utcDiffSeconds(timeCurrent, timeLastSuccess);

    if timeSinceLastSync < syncPeriodInSecs {
        string nextSyncTime = time:utcToEmailString(time:utcAddSeconds(timeLastSuccess, syncPeriodInSecs));
        log:printDebug(string `[cacheSyncStatus()] Sync is up-to-date, (next sync after: ${nextSyncTime}) ignoring the ${syncObj} sync.`);
        return true;
    } else {
        log:printDebug(string `[cacheSyncStatus()] Sync is out-of-date, processing the ${syncObj} sync.`);
        return false;
    }
}

# Handle Salesforce response errors by extracting error details.
# 
# + err - Salesforce response error
# + return - Handled error object
isolated function handleSalesforceError(error err) returns error {
    var errDetails = err.detail();
    if errDetails.hasKey("body") {
        SalesforceResponseError[] errBody = check errDetails.get("body").ensureType();
        return error(errBody[0].message, errorCode = errBody[0].errorCode);
    }
    // Unhandled Salesforce error
    return err;
}
