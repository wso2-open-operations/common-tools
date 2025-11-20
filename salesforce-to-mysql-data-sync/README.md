# Salesforce Sync Service
This is a scheduled task written in [Ballerina](https://ballerina.io/) language. 
Purpose of this service is to sync a selected set of fields in Account and Opportunity 
[Salesforce](https://www.salesforce.com/) objects to a MySQL database which will serve 
as a caching layer for the internal applications and dashboards.

**Sync objects:** [`"Account"`|`"Opportunity"`]
