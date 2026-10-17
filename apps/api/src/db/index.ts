import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { LearningResource } from "@zhijing/shared";
import * as schema from "./schema.js";

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 3, ssl: { rejectUnauthorized: false } })
  : undefined;

export const database = pool ? drizzle(pool, { schema }) : undefined;

export async function persistResource(resource: LearningResource): Promise<void> {
  if (!database) return;
  await database
    .insert(schema.resources)
    .values({
      id: resource.id,
      userId: resource.userId,
      nodeId: resource.nodeId,
      type: resource.type,
      payload: resource,
      reviewScore: resource.reviewScore,
    })
    .onConflictDoUpdate({ target: schema.resources.id, set: { payload: resource, reviewScore: resource.reviewScore } });
}

export async function persistMasteryEvidence(input: {
  userId: string;
  nodeId: string;
  score: number;
  evidence: Record<string, unknown>;
}): Promise<void> {
  if (!database) return;
  await database.insert(schema.masteryEvidence).values({
    userId: input.userId,
    nodeId: input.nodeId,
    score: input.score,
    evidence: input.evidence,
  });
}

export async function closeDatabase(): Promise<void> {
  await pool?.end();
}

