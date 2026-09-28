'use client';

import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ACCEPTED = 'image/jpeg,image/png,image/webp,application/pdf';

/**
 * Drag-drop + camera-capture evidence upload (implementation.md §7.6). Posts
 * straight to `/api/v1/files` with `kind: 'photo'` and the given `testId` —
 * the route resolves and checks lab scope from that id (implementation.md
 * §11). Camera capture is the standard HTML file input `capture` attribute
 * (opens the device camera directly on mobile/tablet; a no-op, ordinary file
 * picker on desktop), not the MediaDevices API — same result, far less code.
 */
export function FileDrop({
  testId,
  onUploaded,
  disabled = false,
}: {
  testId: string;
  onUploaded: (attachmentId: string) => void;
  disabled?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputId = useId();
  const cameraInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    const form = new FormData();
    form.set('file', file);
    form.set('kind', 'photo');
    form.set('testId', testId);
    try {
      const res = await fetch('/api/v1/files', { method: 'POST', body: form });
      const body = await res.json();
      if (!body.ok) throw new Error('Upload failed');
      onUploaded(body.data.id as string);
      toast.success('Evidence added');
    } catch {
      toast.error('Could not upload this file. Try a JPEG, PNG, WebP or PDF under 20 MB.');
    } finally {
      setUploading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) void upload(file);
  }

  return (
    <section
      aria-label="Add evidence — drag a file here, or use the buttons below"
      className={cn(
        'flex flex-col items-center gap-2 rounded-[var(--radius-panel)] border-2 border-dashed border-border p-4 text-center transition-colors',
        dragOver && 'border-ring bg-active-bg',
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      {uploading ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : (
        <ImagePlus className="size-5 text-muted-foreground" aria-hidden="true" />
      )}
      <p className="text-sm text-muted-foreground">Drag a photo or document here, or</p>
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled || uploading}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          Choose file
        </Button>
        <input
          ref={cameraInputRef}
          id={cameraInputId}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled || uploading}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="size-4" />
          Take photo
        </Button>
      </div>
    </section>
  );
}
