import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, processingJobs, processingQueue } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createProcessingJob(
  userId: number,
  audioUrl: string,
  videoUrl: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    console.log(`[DB] Creating job for user ${userId}`);
    console.log(`[DB] Audio URL length: ${audioUrl.length}`);
    console.log(`[DB] Video URL length: ${videoUrl.length}`);
    
    await db.insert(processingJobs).values({
      userId,
      audioUrl,
      videoUrl,
      status: "pending",
    });

    const jobs = await db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.userId, userId))
      .orderBy(desc(processingJobs.createdAt))
      .limit(1);

    console.log(`[DB] Job created with ID: ${jobs[0]?.id}`);
    return jobs[0];
  } catch (error) {
    console.error(`[DB] Error creating job:`, error);
    throw error;
  }
}

export async function getProcessingJob(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(processingJobs)
    .where(eq(processingJobs.id, jobId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateProcessingJob(
  jobId: number,
  updates: Partial<{
    status: "pending" | "processing" | "completed" | "failed";
    outputUrl: string;
    errorMessage: string;
    progress: number;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(processingJobs)
    .set(updates as any)
    .where(eq(processingJobs.id, jobId));
}

export async function getUserProcessingJobs(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(processingJobs)
    .where(eq(processingJobs.userId, userId))
    .orderBy(desc(processingJobs.createdAt));
}

// TODO: add feature queries here as your schema grows.
