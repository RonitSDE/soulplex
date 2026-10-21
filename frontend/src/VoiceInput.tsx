import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { csrf } from "./api";
export function VoiceInput({
  mode,
  onTranscript,
  onError,
}: {
  mode: string;
  onTranscript: (s: string) => void;
  onError: (s: string) => void;
}) {
  const [recording, setRecording] = useState(false),
    [clip, setClip] = useState<Blob | null>(null),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!clip) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(clip);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [clip]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  async function record() {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "Voice recording is unavailable here. Please type your answer.",
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const r = new MediaRecorder(stream.current);
      recorder.current = r;
      const chunks: BlobPart[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = () => {
        setClip(new Blob(chunks, { type: r.mimeType }));
        setRecording(false);
        stream.current?.getTracks().forEach((t) => t.stop());
        if (timer.current) clearTimeout(timer.current);
      };
      setClip(null);
      r.start();
      setRecording(true);
      timer.current = setTimeout(() => {
        if (r.state === "recording") r.stop();
      }, 60000);
    } catch (e) {
      onError((e as Error).message);
    }
  }
  async function transcribe() {
    if (!clip) return;
    setBusy(true);
    try {
      const r = await fetch("/api/transcribe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": clip.type, "X-CSRF-Token": csrf },
        body: clip,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Transcription failed.");
      onTranscript(data.text);
      setClip(null);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="voice-input">
      {!recording ? (
        <button
          type="button"
          className="icon-button"
          onClick={record}
          aria-label="Record a voice answer"
        >
          <Mic size={17} />
        </button>
      ) : (
        <button
          type="button"
          className="button small recording"
          onClick={() => recorder.current?.stop()}
        >
          <Square size={13} />
          Stop · 60s max
        </button>
      )}
      {clip && (
        <div className="voice-preview">
          <audio src={url} controls />
          <small>
            Recording stays on this device until you choose Transcribe. Review
            the text before sending.
          </small>
          <div className="actions">
            <button
              type="button"
              className="button small secondary"
              disabled={busy || mode === "demo"}
              onClick={transcribe}
            >
              {busy
                ? "Transcribing…"
                : mode === "demo"
                  ? "Transcription needs live mode"
                  : "Transcribe with AI"}
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Delete recording"
              onClick={() => setClip(null)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
