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
import ballerina/http;
import ballerina/log;
import ballerinax/salesforce;

configurable string sfBaseUrl = ?;
configurable SalesforceAuthConf sfAuth = ?;

// Initialize Salesforce service client
@display {
    label: "Salesforce Connector",
    id: "salesforce-connector"
}
final salesforce:Client salesforceEP = check new ({
    baseUrl: sfBaseUrl,
    auth: {...sfAuth},
    timeout: 300.0,
    retryConfig: {
        count: 3,
        interval: 5.0,
        statusCodes: [http:STATUS_INTERNAL_SERVER_ERROR, http:STATUS_SERVICE_UNAVAILABLE]
    },
    httpVersion: http:HTTP_1_1,
    http1Settings: {
        keepAlive: http:KEEPALIVE_NEVER
    }
});

# Get Salesforce Account object records from Salesforce.
# 
# + syncConfig - Sync configuration containing the query string
# + return - Account records as an `SFAccountSyncRecord` array or, `error`
function sfQueryAccount(SfSyncConf syncConfig) returns SFAccountSyncRecord[]|error {
    log:printDebug(string `Querying ${ACCOUNT} object on Salesforce...`);
    stream<SFAccountSyncRecord, error?>|error resultStream = check salesforceEP->query(syncConfig.soqlQuery);
    if resultStream is error {
        error err = resultStream;
        return handleSalesforceError(err);
    }

    SFAccountSyncRecord[] sfRecords =
        check from var result in resultStream
        select check result.cloneWithType();

    log:printDebug(string `SUCCESS: Received ${sfRecords.length()} records from Salesforce.`);
    return sfRecords;
}

# Get Salesforce Opportunity object records from Salesforce.
# 
# + syncConfig - Sync configuration containing the query string
# + return - Opportunity records as an `SFOpportunitySyncRecord` array or, `error`
function sfQueryOpportunity(SfSyncConf syncConfig) returns SFOpportunitySyncRecord[]|error {
    log:printDebug(string `Querying ${OPPORTUNITY} object on Salesforce...`);
    stream<SFOpportunitySyncRecord, error?>|error resultStream = check salesforceEP->query(syncConfig.soqlQuery);
    if resultStream is error {
        error err = resultStream;
        return handleSalesforceError(err);
    }

    SFOpportunitySyncRecord[] sfRecords =
        check from var result in resultStream
        select check result.cloneWithType();

    log:printDebug(string `SUCCESS: Received ${sfRecords.length()} records from Salesforce.`);
    return sfRecords;
}
