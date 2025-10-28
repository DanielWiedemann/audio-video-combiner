import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  createProcessingJob,
  getProcessingJob,
  getUserProcessingJobs,
} from "./db";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  video: router({
    upload: protectedProcedure
      .input(
        z.object({
          audioUrl: z.string(),
          videoUrl: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          console.log(`[Upload] Creating job for user ${ctx.user.id}`);
          console.log(`[Upload] Audio URL length: ${input.audioUrl.length}`);
          console.log(`[Upload] Video URL length: ${input.videoUrl.length}`);
          
          const job = await createProcessingJob(
            ctx.user.id,
            input.audioUrl,
            input.videoUrl
          );
          
          console.log(`[Upload] Job created with ID: ${job.id}`);
          return { jobId: job.id };
        } catch (error) {
          console.error(`[Upload] Error:`, error);
          throw error;
        }
      }),
    getJob: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ ctx, input }) => {
        const job = await getProcessingJob(input.jobId);
        if (!job || job.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return job;
      }),
    listJobs: protectedProcedure.query(async ({ ctx }) => {
      return await getUserProcessingJobs(ctx.user.id);
    }),
  }),

});

export type AppRouter = typeof appRouter;
