-- CreateTable
CREATE TABLE `IpfsPinRecord` (
    `id` VARCHAR(191) NOT NULL,
    `cid` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `IpfsPinRecord_cid_key`(`cid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IpfsPin` (
    `id` VARCHAR(191) NOT NULL,
    `recordId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `pinnedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IpfsPin_recordId_idx`(`recordId`),
    UNIQUE INDEX `IpfsPin_recordId_provider_key`(`recordId`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `IpfsPin` ADD CONSTRAINT `IpfsPin_recordId_fkey` FOREIGN KEY (`recordId`) REFERENCES `IpfsPinRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
