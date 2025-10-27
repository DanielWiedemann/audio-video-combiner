import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Upload, Download, Play, Music } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.video.upload.useMutation();
  const jobsQuery = trpc.video.listJobs.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 2000,
  });

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setAudioFile(e.target.files[0]);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setVideoFile(e.target.files[0]);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleProcess = async () => {
    if (!audioFile || !videoFile) {
      alert("Please select both audio and video files");
      return;
    }

    setIsProcessing(true);

    try {
      const audioBase64 = await fileToBase64(audioFile);
      const videoBase64 = await fileToBase64(videoFile);

      await uploadMutation.mutateAsync({
        audioUrl: audioBase64,
        videoUrl: videoBase64,
      });

      setAudioFile(null);
      setVideoFile(null);
      if (audioInputRef.current) audioInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";

      await jobsQuery.refetch();
    } catch (error) {
      alert("Error processing video: " + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (jobsQuery.data?.some(j => j.status === "processing" || j.status === "pending")) {
      const interval = setInterval(() => {
        jobsQuery.refetch();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [jobsQuery.data, jobsQuery]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{APP_TITLE}</CardTitle>
            <CardDescription>Combine audio and video files</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Upload an audio file and a video file. The video will loop to match the audio length and be exported as 1920x1080 MP4 for YouTube.
            </p>
            <a href={getLoginUrl()}>
              <Button className="w-full">Sign In</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{APP_TITLE}</h1>
          <p className="text-gray-600">Combine audio and video files with automatic looping</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="w-5 h-5" />
                Audio File
              </CardTitle>
              <CardDescription>Select your audio track (MP3, WAV, AAC, etc.)</CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                onChange={handleAudioChange}
                className="w-full"
              />
              {audioFile && (
                <p className="text-sm text-green-600 mt-2">✓ {audioFile.name}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                Video File
              </CardTitle>
              <CardDescription>Select your video clip (MP4, MOV, WebM, etc.)</CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                className="w-full"
              />
              {videoFile && (
                <p className="text-sm text-green-600 mt-2">✓ {videoFile.name}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Processing Options</CardTitle>
            <CardDescription>Your video will be exported as 1920x1080 MP4</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleProcess}
              disabled={!audioFile || !videoFile || isProcessing}
              className="w-full"
              size="lg"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isProcessing ? "Processing..." : "Process Video"}
            </Button>
            {isProcessing && (
              <div className="mt-4">
                <Progress value={50} className="w-full" />
                <p className="text-sm text-gray-600 mt-2">Uploading and queuing your video...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {jobsQuery.data && jobsQuery.data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Jobs</CardTitle>
              <CardDescription>Your processing history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {jobsQuery.data.map((job) => (
                  <div
                    key={job.id}
                    className="p-4 border rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">Job #{job.id}</p>
                        <p className="text-sm text-gray-600">
                          Status: <span className="capitalize font-semibold">{job.status}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(job.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {job.status === "completed" && job.outputUrl && (
                        <a href={job.outputUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </a>
                      )}
                      {job.status === "failed" && (
                        <p className="text-sm text-red-600">{job.errorMessage}</p>
                      )}
                    </div>
                    {(job.status === "processing" || job.status === "pending") && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Progress</span>
                          <span>{job.progress}%</span>
                        </div>
                        <Progress value={job.progress} className="w-full" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

