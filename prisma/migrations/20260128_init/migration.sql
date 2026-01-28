-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `organizationName` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NULL,
    `role` ENUM('RECEIVER', 'ISSUER') NOT NULL,
    `walletAddress` VARCHAR(191) NOT NULL,
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthToken` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `type` ENUM('MAGIC_LINK', 'OTP', 'EMAIL_VERIFICATION') NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuthToken_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Issuer` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `websiteUrl` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `creditBalance` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Issuer_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Badge` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `issuerId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NOT NULL,
    `unitName` VARCHAR(191) NULL,
    `badgeType` VARCHAR(191) NULL,
    `customProperties` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Badge_issuerId_fkey`(`issuerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BadgeClaimLink` (
    `id` VARCHAR(191) NOT NULL,
    `badgeId` VARCHAR(191) NOT NULL,
    `issuerId` VARCHAR(191) NOT NULL,
    `limit` INTEGER NOT NULL,
    `claimCount` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BadgeClaimLink_badgeId_key`(`badgeId`),
    INDEX `BadgeClaimLink_issuerId_fkey`(`issuerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IssuedBadge` (
    `id` VARCHAR(191) NOT NULL,
    `badgeId` VARCHAR(191) NOT NULL,
    `receiverEmail` VARCHAR(191) NOT NULL,
    `issuerId` VARCHAR(191) NOT NULL,
    `claimLinkId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'CLAIMED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `claimedAt` DATETIME(3) NULL,
    `transactionHash` VARCHAR(191) NULL,

    INDEX `IssuedBadge_badgeId_fkey`(`badgeId`),
    INDEX `IssuedBadge_claimLinkId_fkey`(`claimLinkId`),
    INDEX `IssuedBadge_issuerId_fkey`(`issuerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CertificateTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `issuerId` VARCHAR(191) NOT NULL,
    `templateName` VARCHAR(191) NOT NULL,
    `templateDescription` VARCHAR(191) NOT NULL,
    `backgroundImageUrl` VARCHAR(191) NOT NULL,
    `dynamicFields` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CertificateTemplate_issuerId_fkey`(`issuerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IssuedCertificate` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `receiverEmail` VARCHAR(191) NOT NULL,
    `issuerId` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NULL,
    `fieldData` JSON NOT NULL,
    `generatedImageUrl` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CLAIMED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `claimedAt` DATETIME(3) NULL,
    `transactionHash` VARCHAR(191) NULL,

    INDEX `IssuedCertificate_issuerId_fkey`(`issuerId`),
    INDEX `IssuedCertificate_jobId_fkey`(`jobId`),
    INDEX `IssuedCertificate_templateId_fkey`(`templateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BulkIssuanceJob` (
    `id` VARCHAR(191) NOT NULL,
    `issuerId` VARCHAR(191) NOT NULL,
    `certificateTemplateId` VARCHAR(191) NOT NULL,
    `recipientData` JSON NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `totalItems` INTEGER NOT NULL,
    `processedItems` INTEGER NOT NULL DEFAULT 0,
    `failedItems` INTEGER NOT NULL DEFAULT 0,
    `statusMessages` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BulkIssuanceJob_certificateTemplateId_fkey`(`certificateTemplateId`),
    INDEX `BulkIssuanceJob_issuerId_fkey`(`issuerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditPurchaseRequest` (
    `id` VARCHAR(191) NOT NULL,
    `issuerId` VARCHAR(191) NOT NULL,
    `creditsRequested` INTEGER NOT NULL,
    `amountPaid` DECIMAL(65, 30) NOT NULL,
    `paymentProofBase64` LONGTEXT NOT NULL,
    `referenceNumber` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `adminNotes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CreditPurchaseRequest_issuerId_fkey`(`issuerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `issuerId` VARCHAR(191) NOT NULL,
    `type` ENUM('PURCHASE', 'MINT_BADGE', 'MINT_CERTIFICATE') NOT NULL,
    `amount` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CreditTransaction_issuerId_fkey`(`issuerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Coupon` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `discountType` ENUM('PERCENTAGE', 'FIXED_AMOUNT') NOT NULL,
    `discountValue` DECIMAL(65, 30) NOT NULL,
    `minPurchaseAmount` DECIMAL(65, 30) NULL,
    `maxUses` INTEGER NULL,
    `uses` INTEGER NOT NULL DEFAULT 0,
    `issuerId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Coupon_code_key`(`code`),
    INDEX `Coupon_issuerId_fkey`(`issuerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CouponUsage` (
    `id` VARCHAR(191) NOT NULL,
    `couponId` VARCHAR(191) NOT NULL,
    `purchaseRequestId` VARCHAR(191) NOT NULL,
    `issuerId` VARCHAR(191) NOT NULL,
    `usedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CouponUsage_purchaseRequestId_key`(`purchaseRequestId`),
    INDEX `CouponUsage_couponId_fkey`(`couponId`),
    INDEX `CouponUsage_issuerId_fkey`(`issuerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditPrice` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `value` DECIMAL(65, 30) NOT NULL,
    `upiQrBase64` LONGTEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AuthToken` ADD CONSTRAINT `AuthToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Issuer` ADD CONSTRAINT `Issuer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Badge` ADD CONSTRAINT `Badge_issuerId_fkey` FOREIGN KEY (`issuerId`) REFERENCES `Issuer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BadgeClaimLink` ADD CONSTRAINT `BadgeClaimLink_badgeId_fkey` FOREIGN KEY (`badgeId`) REFERENCES `Badge`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BadgeClaimLink` ADD CONSTRAINT `BadgeClaimLink_issuerId_fkey` FOREIGN KEY (`issuerId`) REFERENCES `Issuer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssuedBadge` ADD CONSTRAINT `IssuedBadge_badgeId_fkey` FOREIGN KEY (`badgeId`) REFERENCES `Badge`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssuedBadge` ADD CONSTRAINT `IssuedBadge_claimLinkId_fkey` FOREIGN KEY (`claimLinkId`) REFERENCES `BadgeClaimLink`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssuedBadge` ADD CONSTRAINT `IssuedBadge_issuerId_fkey` FOREIGN KEY (`issuerId`) REFERENCES `Issuer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CertificateTemplate` ADD CONSTRAINT `CertificateTemplate_issuerId_fkey` FOREIGN KEY (`issuerId`) REFERENCES `Issuer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssuedCertificate` ADD CONSTRAINT `IssuedCertificate_issuerId_fkey` FOREIGN KEY (`issuerId`) REFERENCES `Issuer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssuedCertificate` ADD CONSTRAINT `IssuedCertificate_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `BulkIssuanceJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssuedCertificate` ADD CONSTRAINT `IssuedCertificate_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `CertificateTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BulkIssuanceJob` ADD CONSTRAINT `BulkIssuanceJob_certificateTemplateId_fkey` FOREIGN KEY (`certificateTemplateId`) REFERENCES `CertificateTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BulkIssuanceJob` ADD CONSTRAINT `BulkIssuanceJob_issuerId_fkey` FOREIGN KEY (`issuerId`) REFERENCES `Issuer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditPurchaseRequest` ADD CONSTRAINT `CreditPurchaseRequest_issuerId_fkey` FOREIGN KEY (`issuerId`) REFERENCES `Issuer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditTransaction` ADD CONSTRAINT `CreditTransaction_issuerId_fkey` FOREIGN KEY (`issuerId`) REFERENCES `Issuer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Coupon` ADD CONSTRAINT `Coupon_issuerId_fkey` FOREIGN KEY (`issuerId`) REFERENCES `Issuer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponUsage` ADD CONSTRAINT `CouponUsage_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponUsage` ADD CONSTRAINT `CouponUsage_issuerId_fkey` FOREIGN KEY (`issuerId`) REFERENCES `Issuer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponUsage` ADD CONSTRAINT `CouponUsage_purchaseRequestId_fkey` FOREIGN KEY (`purchaseRequestId`) REFERENCES `CreditPurchaseRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

