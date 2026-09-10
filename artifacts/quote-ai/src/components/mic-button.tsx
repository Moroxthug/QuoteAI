import { Mic, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { useToast } from "@/hooks/use-toast";

interface MicButtonProps {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}

export function MicButton({ onTranscribed, disabled }: MicButtonProps) {
  const { toast } = useToast();
  const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceInput({
    onTranscribed,
    onError: message => toast({ title: "Dettatura vocale", description: message, variant: "destructive" }),
  });

  const busy = isRecording || isTranscribing;

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        onClick={() => (isRecording ? stopRecording() : startRecording())}
        disabled={disabled || isTranscribing}
        title={isRecording ? "Ferma registrazione" : "Detta la descrizione del lavoro"}
        className={cn(
          "h-8 w-8 flex items-center justify-center rounded-xl transition-colors",
          isRecording
            ? "bg-red-100 text-red-600 hover:bg-red-200"
            : "text-gray-400 hover:bg-gray-100 hover:text-violet-600",
          (disabled || isTranscribing) && !isRecording && "opacity-40 cursor-not-allowed"
        )}
      >
        {isTranscribing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <Square className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>
      {!busy && (
        <div className="absolute bottom-full right-0 mb-2 px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
          Detta il lavoro a voce
          <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
      {isRecording && (
        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
      )}
    </div>
  );
}
