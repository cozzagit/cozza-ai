/**
 * Streaming audio player with barge-in support.
 *
 * Pipeline: HTMLAudioElement + MediaSource for progressive MP3 chunks
 * (TTFB <500ms with ElevenLabs Flash). When MediaSource is unavailable
 * or doesn't support `audio/mpeg` (jsdom, some Android quirks),
 * falls back to a single Blob URL.
 *
 * `abort()` triggers barge-in: cancels the upstream fetch reader,
 * stops playback and revokes the object URL.
 */
export class StreamingAudioPlayer {
  private audio: HTMLAudioElement;
  private controller: AbortController | null = null;
  private currentObjectUrl: string | null = null;
  private onEndedCallback: (() => void) | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';
    this.audio.addEventListener('ended', () => {
      this.onEndedCallback?.();
    });
  }

  onEnded(cb: () => void): void {
    this.onEndedCallback = cb;
  }

  /** Play a streaming Response as MP3. Resolves when playback starts. */
  async playStream(res: Response): Promise<void> {
    this.abort();
    this.controller = new AbortController();
    const signal = this.controller.signal;
    if (!res.body) throw new Error('Response body missing');

    const supportsMse =
      typeof MediaSource !== 'undefined' &&
      typeof MediaSource.isTypeSupported === 'function' &&
      MediaSource.isTypeSupported('audio/mpeg');

    if (supportsMse) {
      await this.playViaMediaSource(res.body, signal);
    } else {
      await this.playViaBlob(res, signal);
    }
  }

  private playViaMediaSource(body: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const ms = new MediaSource();
      this.cleanupObjectUrl();
      this.currentObjectUrl = URL.createObjectURL(ms);
      this.audio.src = this.currentObjectUrl;

      const onSourceOpen = () => {
        ms.removeEventListener('sourceopen', onSourceOpen);
        let sourceBuffer: SourceBuffer;
        try {
          sourceBuffer = ms.addSourceBuffer('audio/mpeg');
        } catch (e) {
          reject(e);
          return;
        }
        const reader = body.getReader();
        const queue: Uint8Array[] = [];
        let isAppending = false;
        let readerDone = false;
        let started = false;

        const drain = (): void => {
          if (isAppending || sourceBuffer.updating) return;
          const next = queue.shift();
          if (next) {
            isAppending = true;
            try {
              // copy to a fresh ArrayBuffer-backed view (TS2345 safety vs SharedArrayBuffer)
              sourceBuffer.appendBuffer(next.slice().buffer);
            } catch (e) {
              reject(e);
            }
            return;
          }
          if (readerDone && ms.readyState === 'open') {
            try {
              ms.endOfStream();
            } catch {
              // ignore — already closed
            }
          }
        };

        sourceBuffer.addEventListener('updateend', () => {
          isAppending = false;
          if (!started) {
            started = true;
            this.audio.play().then(resolve).catch(reject);
          }
          drain();
        });

        const onAbort = () => {
          try {
            void reader.cancel();
          } catch {
            // ignore
          }
          if (ms.readyState === 'open') {
            try {
              ms.endOfStream();
            } catch {
              // ignore
            }
          }
          this.audio.pause();
        };
        signal.addEventListener('abort', onAbort, { once: true });

        const pumpReader = async (): Promise<void> => {
          try {
            for (;;) {
              if (signal.aborted) return;
              const { value, done } = await reader.read();
              if (done) {
                readerDone = true;
                drain();
                return;
              }
              if (value) {
                queue.push(value);
                drain();
              }
            }
          } catch (e) {
            if (!signal.aborted) reject(e);
          }
        };
        void pumpReader();
      };

      ms.addEventListener('sourceopen', onSourceOpen);
    });
  }

  private async playViaBlob(res: Response, signal: AbortSignal): Promise<void> {
    const buf = await res.arrayBuffer();
    if (signal.aborted) return;
    const blob = new Blob([buf], { type: 'audio/mpeg' });
    this.cleanupObjectUrl();
    this.currentObjectUrl = URL.createObjectURL(blob);
    this.audio.src = this.currentObjectUrl;
    await this.audio.play();
  }

  abort(): void {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    if (!this.audio.paused) {
      this.audio.pause();
    }
    this.audio.currentTime = 0;
    this.cleanupObjectUrl();
  }

  private cleanupObjectUrl(): void {
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
  }

  dispose(): void {
    this.abort();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.onEndedCallback = null;
  }
}
