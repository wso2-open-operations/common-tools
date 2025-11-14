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
import ballerina/time;

# Service supported sync types/objects.
enum SyncObject {
    ACCOUNT,
    OPPORTUNITY
}

# Sync log statuses used on the log table in database.
enum LogStatus {
    PROCESSING = "Processing",
    COMPLETED = "Completed",
    FAILED = "Failed"
}

# Salesforce sync configuration.
type SfSyncConf record {
    # Enable/disable sync
    boolean enabled;
    # Time (minimum) period between sync in hours
    decimal periodInHours;
    # Salesforce SOQL sync query
    string soqlQuery;
};

# Salesforce sync minimal configuration.
type SfSyncMinimalConf record {
    # Enable/disable sync
    boolean enabled;
    # Time (minimum) period between sync in hours
    decimal periodInHours;
};

# [Configurable] Salesforce service configuration.
type SalesforceAuthConf record {|
    # OAuth2 refresh token endpoint
    string refreshUrl;
    # OAuth2 refresh token
    string refreshToken;
    # OAuth2 client ID
    string clientId;
    # OAuth2 client secret
    string clientSecret;
|};

# [Configurable] MySQL Database configuration.
type DatabaseConf record {|
    # Hostname
    string host;
    # Username
    string user;
    # Password
    string password;
    # Default database
    string database;
|};

# [Util] Salesforce API response error record.
type SalesforceResponseError record {
    # Salesforce generated error code
    string errorCode;
    # Error message
    string message;
};

# [Database] Sync log time retrieval record.
type DBSyncLogTimes record {|
    # Database row ID
    int id;
    # Sync start time
    time:Utc start_time;
    # Sync end time
    time:Utc end_time;
|};

# [Salesforce] Account sync query record.
type SFAccountSyncRecord record {
    # Account ID
    string Id;
    # Account name
    string Name;
    # Billing Country
    string? BillingCountry;
    # Shipping Country
    string? ShippingCountry;
    # Sales region
    string? Sales_Regions__c;
    # Sub region
    string? Sub_Region__c;
    # NAICS Industry
    string? NAICS_Industry__c;
    # NAICS Sub Industry
    string? Sub_Industry__c;
    # Account Classification
    string? Account_Classification__c;
    # ARR Churn Date
    string? ARR_Churn_Date__c;
    # Owner record
    record {
        # Owner Email
        string Email;
        # Owner Name
        string Name;
    } Owner;
};

# [Salesforce] Opportunity sync query record.
type SFOpportunitySyncRecord record {
    # Opportunity ID
    string Id;
    # Opportunity name
    string Name;
    # Account ID
    string AccountId;
    # Opportunity close date
    string CloseDate;
    # Opportunity stage
    string StageName;
    # Confidence level
    string? Confidence__c;
    # Primary partner role
    string? Primary_Partner_Role__c;
    # Entry vector
    string? Entry_Vector__c;
    # Renewal delayed status
    boolean Renewal_Delayed__c;
    # Total ARR amount
    decimal ARR__c;
    # IAM ARR amount
    decimal IAM_ARR__c;
    # APIM ARR amount
    decimal APIM_ARR__c;
    # Integration ARR amount
    decimal Integration_ARR__c;
    # Open Banking ARR amount
    decimal Open_Banking_ARR__c;
    # Delayed ARR amount
    decimal Delayed_ARR__c;
    # IAM Delayed ARR amount
    decimal IAM_Delayed_ARR__c;
    # APIM Delayed ARR amount
    decimal APIM_Delayed_ARR__c;
    # Integration Delayed ARR amount
    decimal Integration_Delayed__c;
    # Cloud ARR opportunity amount
    decimal? Cloud_ARR_Opportunity__c;
    # IAM BU ARR opportunity amount
    decimal? IAM_BU_ARR_Opportunity__c;
    # APIM ARR opportunity amount
    decimal? APIM_ARR_Opportunity__c;
    # Integration BU ARR opportunity amount
    decimal? Integration_BU_ARR_Opportunity__c;
    # Choreo ARR opportunity amount
    decimal? Choreo_ARR_Opportunity__c;
    # IAM PSO amount
    decimal? IAM_PSO__c;
    # APIM PSO amount
    decimal? APIM_PSO__c;
    # Integration PSO amount
    decimal? Integration_PSO__c;
    # Choreo PSO amount
    decimal? Choreo_PSO__c;
    # Cloud ARR amount
    decimal? Cloud_ARR__c;
    # IAM cloud ARR amount
    decimal? IAM_Cloud_ARR__c;
    # Integration Cloud ARR amount
    decimal? Integration_Cloud_ARR__c;
    # Choreo ARR amount
    decimal? Choreo_ARR__c;
    # APIM Cloud ARR amount
    decimal? APIM_Cloud_ARR__c;
    # Cloud ARR today amount
    decimal CL_ARR_Today__c;
    # Total Software + Cloud Products ARR value
    decimal? ARR_Cloud_ARR__c;
    # IAM Software and Cloud ARR value
    decimal? IAM_ARR_AND_Cloud__c;
    # Integration Software and Cloud ARR value
    decimal? Integration_ARR_AND_Cloud__c;
    # APIM Software and Cloud ARR value
    decimal? APIM_ARR_Cloud__c;
    # Subscription Start Date (including cloud fields)
    string? Subs_Start_Date__c;
    # Subscription End Date (including cloud fields)
    string? Subs_End_Date__c;
    # Direct Channel information
    string? Direct_Channel__c;
    # Forecast type
    string? Forecast_Type1__c;
    # Cloud start date roll up date
    string? CL_Start_Date_Roll_Up__c;
    # Cloud end date roll up date
    string? CL_End_Date_Roll_Up__c;
    # PS support account start date roll up date
    string? PS_Support_Account_Start_Date_Roll_Up__c;
    # PS support account end date roll up date
    string? PS_Support_Account_End_Date_Roll_Up__c;
    # PS start date roll up date
    string? PS_Start_Date_Roll_Up__c;
    # PS end date roll up date
    string? PS_End_Date_Roll_Up__c;
    # Subscription start date
    string? Subscription_Start_Date__c;
    # Subscription end date
    string? Subscription_End_Date__c;
    # Add to forecast (True/False)
    boolean Add_to_Forecast__c;
    # Account owner details
    record {
        # Owner Email
        string Email;
        # Owner Name
        string Name;
    } Owner;
    # Opportunity record type details
    SFRecordType? RecordType;
};

# [Salesforce] Record type record.
public type SFRecordType record {
    # Name of the record type (Renewal, Expansion, First Sale etc.)
    string? Name;
};
