import dayjs, { type Dayjs } from "dayjs";

import { Prisma } from "@blobscan/db";

export type DatePeriod = {
  from?: string;
  to?: string;
};

export function normalizeDate(
  date: Dayjs | string | Date,
  startOfOrEndOfDay: "startOf" | "endOf" = "endOf",
) {
  const date_ = dayjs(date);

  return date_[startOfOrEndOfDay]("day").toISOString();
}

export function buildRawWhereClause(
  dateField: Prisma.Sql,
  { from, to }: DatePeriod,
): Prisma.Sql {
  if (from && to) {
    return Prisma.sql`WHERE ${dateField} BETWEEN ${from}::TIMESTAMP AND ${to}::TIMESTAMP`;
  } else if (from) {
    return Prisma.sql`WHERE ${dateField} >= ${from}::TIMESTAMP`;
  } else if (to) {
    return Prisma.sql`WHERE ${dateField} < ${to}::TIMESTAMP`;
  }

  return Prisma.empty;
}

export function buildWhereClause(dateField: string, { from, to }: DatePeriod) {
  return { [dateField]: { gte: from, lte: to } };
}
