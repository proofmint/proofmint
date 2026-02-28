-- AlterTable
ALTER TABLE `Badge`
    RENAME COLUMN `imageUrl` TO `imageCid`,
    ADD COLUMN `metadataCid` VARCHAR(191) NULL;
