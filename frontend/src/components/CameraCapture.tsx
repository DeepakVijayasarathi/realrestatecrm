"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { CameraIcon, RefreshCwIcon, XIcon } from "@/components/icons";

interface Props {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

/** Live camera modal — lets staff snap a property photo directly instead of hunting for
 * one on disk. Falls back to a clear error (not a silent blank screen) when the browser
 * has no camera, permission is denied, or the page isn't served over HTTPS/localhost
 * (getUserMedia requires a secure context). */
export default function CameraCapture({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [canFlip, setCanFlip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [starting, setStarting] = useState(false);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    setError(null);
    setStarting(true);
    stopStream();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera capture isn't supported in this browser — use Upload instead.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      // Only offer the flip button if the device actually has more than one camera
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      setCanFlip(devices.filter((d) => d.kind === "videoinput").length > 1);
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError") setError("Camera permission was denied. Allow camera access in your browser settings, or use Upload instead.");
      else if (name === "NotFoundError") setError("No camera was found on this device — use Upload instead.");
      else setError(err instanceof Error ? err.message : "Could not start the camera — use Upload instead.");
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    if (!open) {
      stopStream();
      setShot((s) => { if (s) URL.revokeObjectURL(s.url); return null; });
      return;
    }
    setShot(null);
    startCamera();
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facingMode]);

  if (!open) return null;

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setShot({ blob, url: URL.createObjectURL(blob) });
        stopStream();
      },
      "image/jpeg",
      0.92
    );
  }

  function retake() {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
    startCamera();
  }

  function usePhoto() {
    if (!shot) return;
    const file = new File([shot.blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file);
    onClose();
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-[110] flex flex-col bg-slate-950">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium">{shot ? "Review photo" : "Take property photo"}</span>
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-white/10"><XIcon className="h-5 w-5" /></button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
        {error ? (
          <div className="mx-6 max-w-sm rounded-xl bg-white/5 p-6 text-center text-sm text-slate-200">
            <CameraIcon className="mx-auto mb-3 h-8 w-8 text-slate-400" />
            {error}
          </div>
        ) : shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot.url} alt="Captured" className="max-h-full max-w-full object-contain" />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="max-h-full max-w-full object-contain" />
        )}
        {starting && !error && <p className="absolute bottom-4 text-xs text-slate-400">Starting camera…</p>}
      </div>

      <div className="flex items-center justify-center gap-4 bg-slate-950 px-4 py-5">
        {error ? (
          <Button variant="secondary" onClick={onClose}>Close</Button>
        ) : shot ? (
          <>
            <Button variant="secondary" onClick={retake}><RefreshCwIcon className="mr-1.5 inline h-4 w-4" />Retake</Button>
            <Button onClick={usePhoto}>Use photo</Button>
          </>
        ) : (
          <>
            {canFlip && (
              <button
                type="button"
                onClick={() => setFacingMode((m) => (m === "environment" ? "user" : "environment"))}
                className="rounded-full border border-white/20 p-3 text-white hover:bg-white/10"
                title="Flip camera"
              >
                <RefreshCwIcon className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={capture}
              disabled={starting}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 disabled:opacity-50"
              title="Capture"
            >
              <span className="h-12 w-12 rounded-full bg-white" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
