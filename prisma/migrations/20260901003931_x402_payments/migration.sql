-- CreateTable
CREATE TABLE `IssuerApiKey` (
    `id` VARCHAR(191) NOT NULL,
    `issuerId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `keyHash` VARCHAR(191) NOT NULL,
    `prefix` VARCHAR(191) NOT NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `IssuerApiKey_keyHash_key`(`keyHash`),
    INDEX `IssuerApiKey_issuerId_idx`(`issuerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `X402Payment` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('BADGE', 'CERTIFICATE', 'CERTIFICATE_BULK') NOT NULL,
    `issuerId` VARCHAR(191) NULL,
    `resource` TEXT NOT NULL,
    `network` VARCHAR(191) NOT NULL,
    `asset` VARCHAR(191) NOT NULL,
    `amountAtomic` VARCHAR(191) NOT NULL,
    `payer` VARCHAR(191) NULL,
    `payTo` VARCHAR(191) NOT NULL,
    `settlementTxId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `refId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `X402Payment_settlementTxId_key`(`settlementTxId`),
    INDEX `X402Payment_issuerId_idx`(`issuerId`),
    INDEX `X402Payment_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `IssuerApiKey` ADD CONSTRAINT `IssuerApiKey_issuerId_fkey` FOREIGN KEY (`issuerId`) REFERENCES `Issuer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `X402Payment` ADD CONSTRAINT `X402Payment_issuerId_fkey` FOREIGN KEY (`issuerId`) REFERENCES `Issuer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
