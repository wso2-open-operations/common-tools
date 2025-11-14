-- Salesforce Sync Database and Tables Creation Script.

DROP DATABASE IF EXISTS `salesforce_sync`;
CREATE DATABASE IF NOT EXISTS `salesforce_sync`;
USE `salesforce_sync`;

CREATE TABLE `sf_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'Salesforce sync log index',
  `sync_type` varchar(50) NOT NULL COMMENT 'Salesforce sync type',
  `start_time` timestamp NULL DEFAULT NULL COMMENT 'Salesforce sync start time',
  `end_time` timestamp NULL DEFAULT NULL COMMENT 'Salesforce sync end time',
  `status` varchar(20) NOT NULL COMMENT 'Salesforce sync status (“Processing” | ”Completed” | ”Failed”)',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `sf_account` (
  `Id` varchar(100) NOT NULL,
  `Name` varchar(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `BillingCountry` varchar(100) DEFAULT NULL,
  `ShippingCountry` varchar(100) DEFAULT NULL,
  `Account_Classification__c` varchar(100) DEFAULT NULL,
  `Sales_Regions__c` varchar(100) DEFAULT NULL,
  `Sub_Region__c` varchar(100) DEFAULT NULL,
  `NAICS_Industry__c` varchar(100) DEFAULT NULL,
  `Sub_Industry__c` varchar(100) DEFAULT NULL,
  `Account_Owner_Email` varchar(100) NOT NULL,
  `Account_Owner_FullName` varchar(100) NOT NULL,
  `IsInSF` tinyint(4) NOT NULL DEFAULT '1',
  `ARR_Churn_Date__c` date DEFAULT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `sf_opportunity` (
  `Id` varchar(100) NOT NULL,
  `Name` varchar(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `AccountId` varchar(100) NOT NULL,
  `CloseDate` date NOT NULL,
  `StageName` varchar(100) NOT NULL,
  `Confidence__c` varchar(100) DEFAULT NULL,
  `Primary_Partner_Role__c` varchar(100) DEFAULT NULL,
  `Entry_Vector__c` varchar(100) DEFAULT NULL,
  `Renewal_Delayed__c` tinyint(4) DEFAULT NULL,
  `Opportunity_Record_Type` varchar(100) DEFAULT NULL,
  `ARR__c` decimal(16,2) NOT NULL DEFAULT '0.00',
  `IAM_ARR__c` decimal(16,2) NOT NULL DEFAULT '0.00',
  `APIM_ARR__c` decimal(16,2) NOT NULL DEFAULT '0.00',
  `Integration_ARR__c` decimal(16,2) NOT NULL DEFAULT '0.00',
  `Open_Banking_ARR__c` decimal(16,2) NOT NULL DEFAULT '0.00',
  `Delayed_ARR__c` decimal(16,2) NOT NULL DEFAULT '0.00',
  `IAM_Delayed_ARR__c` decimal(16,2) NOT NULL DEFAULT '0.00',
  `APIM_Delayed_ARR__c` decimal(16,2) NOT NULL DEFAULT '0.00',
  `Integration_Delayed__c` decimal(16,2) NOT NULL DEFAULT '0.00',
  `OB_Delayed_ARR__c` decimal(16,2) NOT NULL DEFAULT '0.00',
  `Cloud_ARR_Opportunity__c` decimal(16,2) DEFAULT '0.00',
  `IAM_BU_ARR_Opportunity__c` decimal(16,2) DEFAULT '0.00',
  `APIM_ARR_Opportunity__c` decimal(16,2) DEFAULT '0.00',
  `Integration_BU_ARR_Opportunity__c` decimal(16,2) DEFAULT '0.00',
  `Choreo_ARR_Opportunity__c` decimal(16,2) DEFAULT '0.00',
  `IAM_PSO__c` decimal(16,2) DEFAULT '0.00',
  `APIM_PSO__c` decimal(16,2) DEFAULT '0.00',
  `Integration_PSO__c` decimal(16,2) DEFAULT '0.00',
  `Choreo_PSO__c` decimal(16,2) DEFAULT '0.00',
  `Cloud_ARR__c` decimal(16,2) DEFAULT '0.00',
  `IAM_Cloud_ARR__c` decimal(16,2) DEFAULT '0.00',
  `Integration_Cloud_ARR__c` decimal(16,2) DEFAULT '0.00',
  `Choreo_ARR__c` decimal(16,2) DEFAULT '0.00',
  `APIM_Cloud_ARR__c` decimal(16,2) DEFAULT '0.00',
  `CL_ARR_Today__c` decimal(16,2) NOT NULL DEFAULT '0.00',
  `CL_Start_Date_Roll_Up__c` date DEFAULT NULL,
  `CL_End_Date_Roll_Up__c` date DEFAULT NULL,
  `PS_Support_Account_Start_Date_Roll_Up__c` date DEFAULT NULL,
  `PS_Support_Account_End_Date_Roll_Up__c` date DEFAULT NULL,
  `PS_Start_Date_Roll_Up__c` date DEFAULT NULL,
  `PS_End_Date_Roll_Up__c` date DEFAULT NULL,
  `Subscription_Start_Date__c` date DEFAULT NULL,
  `Subscription_End_Date__c` date DEFAULT NULL,
  `Subs_Start_Date__c` date DEFAULT NULL,
  `Subs_End_Date__c` date DEFAULT NULL,
  `ARR_Cloud_ARR__c` decimal(16,2) DEFAULT '0.00',
  `IAM_ARR_AND_Cloud__c` decimal(16,2) DEFAULT '0.00',
  `APIM_ARR_Cloud__c` decimal(16,2) DEFAULT '0.00',
  `Integration_ARR_AND_Cloud__c` decimal(16,2) DEFAULT '0.00',
  `Direct_Channel__c` varchar(100) DEFAULT NULL,
  `Forecast_Type1__c` varchar(100) DEFAULT NULL,
  `Add_to_Forecast__c` tinyint(4) NOT NULL DEFAULT '0',
  `Opportunity_Owner_Email` varchar(100) NOT NULL,
  `Opportunity_Owner_FullName` varchar(100) NOT NULL,
  `IsInSF` tinyint(4) NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;


DROP procedure IF EXISTS `arr_shadow_copy`;

DELIMITER $$
CREATE PROCEDURE `arr_shadow_copy` ()
BEGIN
	DROP TABLE IF EXISTS arr_sf_account;
	CREATE TABLE IF NOT EXISTS arr_sf_account LIKE sf_account;
	INSERT INTO arr_sf_account SELECT * FROM sf_account;

	DROP TABLE IF EXISTS arr_sf_opportunity;
	CREATE TABLE IF NOT EXISTS arr_sf_opportunity LIKE sf_opportunity;
	INSERT INTO arr_sf_opportunity SELECT * FROM sf_opportunity;
END$$

DELIMITER ;
