import dayjs from "dayjs";
import { z } from "zod";

import { Prisma, type PrismaClient } from "@blobscan/db";

import {
  dailyDateProcedure,
  datePeriodProcedure,
} from "../../middlewares/withDates";
import { timeFrameProcedure } from "../../middlewares/withTimeFrame";
import { createTRPCRouter, publicProcedure } from "../../trpc";
import {
  buildRawWhereClause,
  buildWhereClause,
  type DatePeriod,
} from "../../utils/dates";
import { STATS_PATH } from "../../utils/stats";

function queryDailyTransactionStats(
  prisma: PrismaClient,
  datePeriod: DatePeriod,
): Prisma.PrismaPromise<Prisma.TransactionDailyStatsCreateManyInput[]> {
  const dateField = Prisma.sql`timestamp`;
  const whereClause = buildRawWhereClause(dateField, datePeriod);

  return prisma.$queryRaw<Prisma.TransactionDailyStatsCreateManyInput[]>`
    SELECT COUNT(id)::Int as "totalTransactions", DATE_TRUNC('day', ${dateField}) as "day"
    FROM "Transaction"
    ${whereClause}
    GROUP BY "day"
  `;
}

export const transactionStatsRouter = createTRPCRouter({
  getOverallStats: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${STATS_PATH}/transaction/overall`,
        tags: ["stats", "transaction"],
        summary: "Get transaction overall stats",
      },
    })
    .input(z.void())
    .output(z.object({ total: z.number(), updatedAt: z.date() }))
    .query(async ({ ctx }) => {
      const overallTransactionStats =
        await ctx.prisma.transactionOverallStats.findUnique({
          where: { id: 1 },
        });

      if (!overallTransactionStats) {
        return {
          total: 0,
          updatedAt: new Date(),
        };
      }

      return {
        total: overallTransactionStats.totalTransactions,
        updatedAt: overallTransactionStats.updatedAt,
      };
    }),
  getDailyStats: timeFrameProcedure
    .meta({
      openapi: {
        method: "GET",
        path: `${STATS_PATH}/transaction`,
        tags: ["stats", "transaction"],
        summary: "Get transaction time series stats",
      },
    })
    .output(
      z.array(
        z
          .object({
            day: z.date(),
            totalTransactions: z.number(),
          })
          .optional(),
      ),
    )
    .query(({ ctx }) => {
      const timeFrame = ctx.timeFrame;

      return ctx.prisma.transactionDailyStats.findMany({
        select: {
          day: true,
          totalTransactions: true,
        },
        where: {
          day: {
            lte: timeFrame.final.toDate(),
            gte: timeFrame.initial.toDate(),
          },
        },
      });
    }),
  updateDailyStats: dailyDateProcedure.mutation(
    async ({ ctx: { prisma, datePeriod } }) => {
      const [dailyTransactionStats] = await queryDailyTransactionStats(
        prisma,
        datePeriod,
      );

      if (!dailyTransactionStats) {
        return;
      }

      return prisma.transactionDailyStats.upsert({
        create: dailyTransactionStats,
        update: dailyTransactionStats,
        where: { day: datePeriod.to },
      });
    },
  ),
  backfillDailyStats: datePeriodProcedure.mutation(
    async ({ ctx: { prisma, datePeriod } }) => {
      // Delete all the rows if current date is set as target date
      if (
        !datePeriod.from &&
        datePeriod.to &&
        dayjs(datePeriod.to).isSame(dayjs(), "day")
      ) {
        await prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "TransactionDailyStats"`,
        );
      } else {
        await prisma.blockDailyStats.deleteMany({
          where: buildWhereClause("day", datePeriod),
        });
      }

      const dailyTransactionStats = await queryDailyTransactionStats(
        prisma,
        datePeriod,
      );

      return prisma.transactionDailyStats.createMany({
        data: dailyTransactionStats,
      });
    },
  ),
});
