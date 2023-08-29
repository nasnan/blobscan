import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async () => {
  await prisma.$transaction([
    prisma.blockchainSyncState.deleteMany(),
    prisma.blobDailyStats.deleteMany(),
    prisma.blockDailyStats.deleteMany(),
    prisma.transactionDailyStats.deleteMany(),
    prisma.blobOverallStats.deleteMany(),
    prisma.blockOverallStats.deleteMany(),
    prisma.transactionOverallStats.deleteMany(),
    prisma.blobData.deleteMany(),
    prisma.blobsOnTransactions.deleteMany(),
    prisma.blobDataStorageReference.deleteMany(),
    prisma.blob.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.address.deleteMany(),
    prisma.block.deleteMany(),
  ]);
};
