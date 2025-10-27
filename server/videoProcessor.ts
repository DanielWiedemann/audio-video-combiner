import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { storagePut } from "./storage";

// const unlinkAsync = promisify(fs.unlink);

export async function getMediaDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 0);
    });
  });
}

export async function combineAudioVideo(
  audioPath: string,
  videoPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err: any, audioMetadata: any) => {
      if (err) return reject(err);

      const audioDuration = audioMetadata.format.duration || 0;

      ffmpeg.ffprobe(videoPath, (err: any, videoMetadata: any) => {
        if (err) return reject(err);

        const videoDuration = videoMetadata.format.duration || 0;
        const loopCount = Math.ceil(audioDuration / videoDuration);

        let filterComplex = "";
        let inputStr = "";

        for (let i = 0; i < loopCount; i++) {
          inputStr += `-i "${videoPath}" `;
        }
        inputStr += `-i "${audioPath}" `;

        for (let i = 0; i < loopCount; i++) {
          filterComplex += `[${i}]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v${i}];`;
        }

        for (let i = 0; i < loopCount; i++) {
          filterComplex += `[v${i}]`;
        }

        filterComplex += `concat=n=${loopCount}:v=1:a=0[vout];[vout][${loopCount}]concat=n=1:v=1:a=1[out]`;

        ffmpeg()
          .input(videoPath)
          .input(audioPath)
          .complexFilter(filterComplex)
          .outputOptions([
            "-c:v libx264",
            "-c:a aac",
            `-t ${audioDuration}`,
            "-pix_fmt yuv420p",
          ])
          .output(outputPath)
          .on("end", () => {
            resolve();
          })
          .on("error", reject)
          .run();
      });
    });
  });
}

export async function processVideoJob(
  audioPath: string,
  videoPath: string,
  jobId: number
): Promise<string> {
  const tempDir = "/tmp/video-combiner";
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const outputPath = path.join(tempDir, `output-${jobId}-${Date.now()}.mp4`);

  try {
    await combineAudioVideo(audioPath, videoPath, outputPath);

    const fileBuffer = fs.readFileSync(outputPath);
    const { url } = await storagePut(
      `videos/${jobId}-${Date.now()}.mp4`,
      fileBuffer,
      "video/mp4"
    );

    return url;
  } finally {
    try {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

