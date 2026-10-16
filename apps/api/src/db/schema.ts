import { integer, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const learners = pgTable("learners", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  persona: text("persona").notNull(),
  profile: jsonb("profile").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const resources = pgTable("resources", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  nodeId: text("node_id").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  reviewScore: real("review_score").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const masteryEvidence = pgTable("mastery_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  nodeId: text("node_id").notNull(),
  score: integer("score").notNull(),
  evidence: jsonb("evidence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  status: text("status").notNull(),
  events: jsonb("events").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

