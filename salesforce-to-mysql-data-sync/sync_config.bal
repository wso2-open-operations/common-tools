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
                        Account_Classification__c,
                        Sales_Regions__c,
                        Sub_Region__c,
                        BillingCountry,
                        ShippingCountry,
                        NAICS_Industry__c,
                        Sub_Industry__c,
                        Owner.Email,
                        Owner.Name,
                        ARR_Churn_Date__c
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
                        Confidence__c,
                        Entry_Vector__c,
                        Primary_Partner_Role__c,
                        Renewal_Delayed__c,
                        RecordType.Name,
                        convertCurrency(ARR__c),
                        convertCurrency(IAM_ARR__c),
                        convertCurrency(APIM_ARR__c),
                        convertCurrency(Integration_ARR__c),
                        convertCurrency(Open_Banking_ARR__c),
                        convertCurrency(Delayed_ARR__c),
                        convertCurrency(IAM_Delayed_ARR__c),
                        convertCurrency(APIM_Delayed_ARR__c),
                        convertCurrency(Integration_Delayed__c),
                        convertCurrency(Cloud_ARR_Opportunity__c),
                        convertCurrency(IAM_BU_ARR_Opportunity__c),
                        convertCurrency(APIM_ARR_Opportunity__c),
                        convertCurrency(Integration_BU_ARR_Opportunity__c),
                        convertCurrency(Choreo_ARR_Opportunity__c),
                        convertCurrency(IAM_PSO__c),
                        convertCurrency(APIM_PSO__c),
                        convertCurrency(Integration_PSO__c),
                        convertCurrency(Choreo_PSO__c),
                        convertCurrency(Cloud_ARR__c),
                        convertCurrency(IAM_Cloud_ARR__c),
                        convertCurrency(Integration_Cloud_ARR__c),
                        convertCurrency(Choreo_ARR__c),
                        convertCurrency(APIM_Cloud_ARR__c),
                        convertCurrency(CL_ARR_Today__c),
                        convertCurrency(ARR_Cloud_ARR__c),
                        convertCurrency(IAM_ARR_AND_Cloud__c),
                        convertCurrency(Integration_ARR_AND_Cloud__c),
                        convertCurrency(APIM_ARR_Cloud__c),
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
