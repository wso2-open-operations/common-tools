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

configurable boolean isProd = false;

final readonly & SyncObject[] supportedSyncObjs = [ACCOUNT, OPPORTUNITY];

# Sync Salesforce objects to a managed database.
# 
# Version: 1.0.0
@display {
    label: "Salesforce Sync Service",
    id: "sales/salesforce-sync-cron"
}
public function main() {
    // Whether the sync executed at least once
    boolean isSyncExecuted = false;
    do {
        foreach SyncObject syncObject in supportedSyncObjs {
            // Check whether the sync object is enabled
            boolean isEnabled = (check getSyncConfig(syncObject)).enabled;
            if !isEnabled {
                log:printInfo(string `Sync object ${syncObject} is disabled, skipping sync.`);
                continue;
            }

            // Check whether a re-sync is required for the sync object
            // If the sync is up-to-date, continue to the next sync (if available)
            boolean isSynced = check checkSyncStatus(syncObject);
            if isSynced {
                log:printInfo(string `Sync object ${syncObject} is up-to-date, skipping sync.`);
                continue;
            }

            executeSync(syncObject);
            isSyncExecuted = true;
        }

        // Generate shadow tables after successfully completing the syncs
        if isSyncExecuted {
            check dbShadowCopy();
        }
    } on fail error err {
        log:printError("Error processing sync.", err, err.stackTrace());
    }
}

# Process the provided sync object type.
# 
# + syncObject - Salesforce sync object to process
function executeSync(SyncObject syncObject) {
    int dbSyncLogIndex = -1;
    do {
        // Check whether active syncs are running
        // (This can occur in the parallel instance setup on Azure prod)
        boolean activeSync = check dbCheckProcessing();
        if activeSync {
            log:printInfo("Parallel sync process is currently active, ending process.");
            return;
        }

        log:printInfo(string `Processing Salesforce ${syncObject} sync...`);
        dbSyncLogIndex = check dbInsertSyncLog(PROCESSING, syncObject);
        check processSyncObject(syncObject);

        log:printInfo("Successfully processed the sync.");
        dbSyncLogIndex = check dbInsertSyncLog(COMPLETED, syncObject, dbSyncLogIndex);
    } on fail error err {
        log:printError(err.message(), stackTrace = err.stackTrace());
        if dbSyncLogIndex != -1 {
            _ = checkpanic dbInsertSyncLog(FAILED, syncObject, dbSyncLogIndex);
        }
    }
}
