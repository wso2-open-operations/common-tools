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
configurable SfSyncMinimalConf accountSync = {enabled: true, periodInHours: 4.0};
configurable SfSyncMinimalConf opportunitySync = {enabled: true, periodInHours: 4.0};

# Get the Salesforce sync configuration for the given Salesforce object defined within the service configuration.
# 
# + syncObj - Salesforce object to sync
# + return - Sync configuration as a `SfSyncConf` record, or `error` if no configuration defined for the given object
function getSyncConfig(string syncObj) returns SfSyncConf|error {
    match syncObj {
        ACCOUNT => {
            return {
                enabled: accountSync.enabled,
                periodInHours: accountSync.periodInHours,
                soqlQuery: (string `
                    SELECT
                        Id,
                        Name,
                        BillingCountry,
                        ShippingCountry,
                        Owner.Email,
                        Owner.Name
                    FROM
                        ACCOUNT
                `)
            };
        }
        OPPORTUNITY => {
            return {
                enabled: opportunitySync.enabled,
                periodInHours: opportunitySync.periodInHours,
                soqlQuery: (string `
                    SELECT
                        Id,
                        Name,
                        AccountId,
                        CloseDate,
                        StageName,
                        Owner.Email,
                        Owner.Name
                    FROM
                        OPPORTUNITY
                `)
            };
        }
        _ => {
            return error(string `Invalid sync object: Sync configuration for Salesforce object (${syncObj}) not defined.`);
        }
    }
}
