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
    # Owner record.
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
    # Owner record.
    record {
        # Owner Email
        string Email;
        # Owner Name
        string Name;
    } Owner;
};
