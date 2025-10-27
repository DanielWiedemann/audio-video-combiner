import { getDb, updateProcessingJob } from "./db";
import { processVideoJob } from "./videoProcessor";
import { processingJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

let processingInProgress = false;

export async function startJobProcessor() {
  console.log("[JobProcessor] Started");
  setInterval(async () => {
    if (!processingInProgress) {
      await processNextJob();
    }
  }, 5000);
}

async function processNextJob() {
  const db = await getDb();
  if (!db) return;

  try {
    const pendingJobs = await db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.status, "pending"))
      .limit(1);

    if (pendingJobs.length === 0) return;

    const job = pendingJobs[0];
    processingInProgress = true;

    console.log(`[JobProcessor] Processing job #${job.id}`);

    await updateProcessingJob(job.id, {
      status: "processing",
      progress: 10,
    });

    let audioPath: string | null = null;
    let videoPath: string | null = null;

    try {
      console.log(`[JobProcessor] Downloading audio file...`);
      audioPath = await downloadFile(job.audioUrl, `audio-${job.id}`);
      console.log(`[JobProcessor] Downloading video file...`);
      videoPath = await downloadFile(job.videoUrl, `video-${job.id}`);

      await updateProcessingJob(job.id, { progress: 30 });

      console.log(`[JobProcessor] Processing video...`);
      const outputUrl = await processVideoJob(audioPath, videoPath, job.id);

      await updateProcessingJob(job.id, { progress: 90 });

      await updateProcessingJob(job.id, {
        status: "completed",
        outputUrl,
        progress: 100,
      });

      console.log(`[JobProcessor] Job #${job.id} completed`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error(`[JobProcessor] Job #${job.id} failed:`, errorMessage);

      await updateProcessingJob(job.id, {
        status: "failed",
        errorMessage,
        progress: 0,
      });
    } finally {
      try {
        if (audioPath && fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
        }
        if (videoPath && fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    console.error("[JobProcessor] Error processing job:", error);
  } finally {
    processingInProgress = false;
  }
}

async function downloadFile(url: string, filename: string): Promise<string> {
  const tempDir = "/tmp/video-combiner";
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const filePath = path.join(tempDir, `${filename}-${Date.now()}`);

  if (url.startsWith("data:")) {
    try {
      const base64Data = url.split(",")[1];
      if (!base64Data) {
        throw new Error("Invalid data URL format");
      }
      const buffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(filePath, buffer);
      console.log(`[JobProcessor] Downloaded file to ${filePath}`);
      return filePath;
    } catch (error) {
      throw new Error(`Failed to decode base64 data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (url.startsWith("blob:")) {
    throw new Error("Blob URLs are not supported. Files must be uploaded as base64.");
  }

  throw new Error("Only base64 data URLs are supported in this version");
}

