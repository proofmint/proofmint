import prisma from "@/lib/prisma";
import { Indexer } from "algosdk";

async function main() {
  const issuedBadges = await prisma.issuedBadge.findMany({
    where: {
      transactionHash: {
        notIn: [""],
        not: null,
      },
    },
    select: {
      transactionHash: true,
      id: true,
      receiverEmail: true,
      claimedAt: true,
    },
  });

  if (issuedBadges.length > 0) {
    let processedCount = 0;
    for (const issuedBadge of issuedBadges) {
      const txnId = issuedBadge.transactionHash;
      if (!txnId) {
        continue;
      }
      const indexer = new Indexer(
        "a".repeat(64),
        "https://mainnet-idx.4160.nodely.dev",
        443
      );
      const txn = await indexer.lookupTransactionByID(txnId).do();
      const block = txn.transaction.confirmedRound;
      const group = txn.transaction.group;
      if (block && group) {
        const blockData = await indexer.lookupBlock(block).do();
        if (blockData.transactions) {
          const groupTxns = blockData.transactions.filter((dupTxn) =>
            dupTxn.group
              ? new TextDecoder().decode(dupTxn.group) ==
                new TextDecoder().decode(group)
              : false
          );
          if (groupTxns.length > 0) {
            const replacedTxnId = groupTxns[groupTxns.length - 1].id;
            if (replacedTxnId) {
              await prisma.issuedBadge.update({
                where: { id: issuedBadge.id },
                data: { transactionHash: replacedTxnId },
              });
              console.log(`Updated TXN ID: ${replacedTxnId}, old TXN ID: ${txnId}`);
              await new Promise((resolve) => setTimeout(resolve, 400));
            }
          }
        }
      }
      processedCount++;
      console.log(`Processed ${processedCount} of ${issuedBadges.length}`);
    }
  }
}

main();
