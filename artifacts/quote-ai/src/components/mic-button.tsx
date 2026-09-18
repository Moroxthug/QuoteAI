import { Mic, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";

interface MicButtonProps {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}

/**
 * Voice-dictation trigger rendered as the composer's `.comp-mic` control
 * (dashboard home + new-quote AI tab). Recording state flips it to `.rec`.
 */
export function MicButton({ onTranscribed, disabled }: MicButtonProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceInput({
    onTranscribed,
    onError: message => toast({ title: t("mic.errorTitle"), description: message, variant: "destructive" }),
  });

  return (
    <button
      type="button"
      onClick={() => (isRecording ? stopRecording() : startRecording())}
      disabled={disabled || isTranscribing}
      title={isRecording ? t("mic.stop") : t("mic.dictate")}
      aria-label={isRecording ? t("mic.stop") : t("mic.dictate")}
      className={cn("comp-mic", isRecording && "rec")}
    >
      {isTranscribing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <Square className="h-3.5 w-3.5 fill-current" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
      {isRecording && <span className="rec-dot" />}
    </button>
  );
}
