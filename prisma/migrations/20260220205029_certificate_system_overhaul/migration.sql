/*
  Warnings:

  - You are about to drop the column `fieldData` on the `IssuedCertificate` table. All the data in the column will be lost.
  - You are about to drop the column `generatedImageUrl` on the `IssuedCertificate` table. All the data in the column will be lost.
  - You are about to drop the column `transactionHash` on the `IssuedCertificate` table. All the data in the column will be lost.
  - Added the required column `certificateName` to the `BulkIssuanceJob` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `BulkIssuanceJob` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitName` to the `BulkIssuanceJob` table without a default value. This is not possible if the table is not empty.
  - Added the required column `certificateName` to the `IssuedCertificate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `IssuedCertificate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `properties` to the `IssuedCertificate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitName` to the `IssuedCertificate` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `BulkIssuanceJob` ADD COLUMN `certificateName` VARCHAR(191) NOT NULL,
    ADD COLUMN `customProperties` JSON NULL,
    ADD COLUMN `description` VARCHAR(191) NOT NULL,
    ADD COLUMN `sendEmail` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `unitName` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `IssuedCertificate` DROP COLUMN `fieldData`,
    DROP COLUMN `generatedImageUrl`,
    DROP COLUMN `transactionHash`,
    ADD COLUMN `certificateName` VARCHAR(191) NOT NULL,
    ADD COLUMN `claimTransactionHash` VARCHAR(191) NULL,
    ADD COLUMN `description` VARCHAR(191) NOT NULL,
    ADD COLUMN `errorMessage` TEXT NULL,
    ADD COLUMN `imageCid` VARCHAR(191) NULL,
    ADD COLUMN `metadataCid` VARCHAR(191) NULL,
    ADD COLUMN `mintTransactionHash` VARCHAR(191) NULL,
    ADD COLUMN `mintingStatus` ENUM('PENDING', 'MINTED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `properties` JSON NOT NULL,
    ADD COLUMN `unitName` VARCHAR(191) NOT NULL,
    MODIFY `assetId` VARCHAR(191) NULL;
