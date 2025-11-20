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
  `Account_Owner_Email` varchar(100) NOT NULL,
  `Account_Owner_FullName` varchar(100) NOT NULL,
  `IsInSF` tinyint(4) NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `sf_opportunity` (
  `Id` varchar(100) NOT NULL,
  `Name` varchar(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `AccountId` varchar(100) NOT NULL,
  `CloseDate` date NOT NULL,
  `StageName` varchar(100) NOT NULL,
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
