/**
 * Streaming audio player with barge-in support.
 *
 * Pipeline:
 *   - Desktop / Chromium with MediaSource: progressive MP3 chunks
 *   - Mobile (Chrome Android): Blob fallback (Android MSE doesn't accept
 *     audio/mpeg; ArrayBuffer + URL.createObjectURL is the safe path)
 *
 * Autoplay policy: `audio.play()` returns a Promise that REJECTS on
 * mobile when the call isn't tied to a recent user gesture. We catch
 * that, dispatch a `cozza:audio-blocked` event the UI can listen to in
 * order to show a "Tap to enable audio" banner, and a one-time `unlock()`
 * gesture flips the player into "always allowed" mode.
 *
 * `abort()` triggers barge-in: cancels the upstream fetch reader, stops
 * playback and revokes the object URL.
 */
export class StreamingAudioPlayer {
  private audio: HTMLAudioElement;
  private controller: AbortController | null = null;
  private currentObjectUrl: string | null = null;
  private onEndedCallback: (() => void) | null = null;
  private static unlocked = false;

  constructor() {
    this.audio = new Audio();
    // 'none' on mobile to avoid wasting bandwidth on first sentence
    this.audio.preload = 'none';
    this.audio.setAttribute('playsinline', '');
    this.audio.crossOrigin = 'anonymous';
    this.audio.addEventListener('ended', () => {
      this.onEndedCallback?.();
    });
    this.audio.addEventListener('error', (ev) => {
      console.warn('[audio] element error', ev, this.audio.error);
    });
  }

  static get isUnlocked(): boolean {
    return StreamingAudioPlayer.unlocked;
  }

  /**
   * Call from a synchronous user-gesture handler (e.g. a button onClick)
   * to satisfy the autoplay policy for the rest of the session.
   * Plays a tiny silent buffer; resolves on success.
   */
  static async unlock(): Promise<boolean> {
    if (StreamingAudioPlayer.unlocked) return true;
    try {
      // 0.1s of silence as a base64 mp3 (RFC frame, no payload)
      const SILENT_MP3 =
        'data:audio/mpeg;base64,SUQzAwAAAAAAFlRFTkMAAAAMAAADTGF2ZjU3LjUuMTAA//uQAAAAAAAAAAAAAAAAAAAAAAAA';
      const a = new Audio(SILENT_MP3);
      a.preload = 'auto';
      a.muted = false;
      a.setAttribute('playsinline', '');
      await a.play();
      a.pause();
      StreamingAudioPlayer.unlocked = true;
      window.dispatchEvent(new CustomEvent('cozza:audio-unlocked'));
      return true;
    } catch {
      return false;
    }
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

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isAndroid = /Android/i.test(ua);
    const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
    const supportsMse =
      typeof MediaSource !== 'undefined' &&
      typeof MediaSource.isTypeSupported === 'function' &&
      MediaSource.isTypeSupported('audio/mpeg');

    // On Android/iOS, even if MSE reports support for audio/mpeg, behavior
    // is flaky. Force the simpler Blob path for predictable mobile audio.
    if (supportsMse && !isAndroid && !isIos) {
      try {
        await this.playViaMediaSource(res.body, signal);
      } catch (e) {
        console.warn('[audio] MSE failed, falling back to blob', e);
        await this.playViaBlob(res, signal);
      }
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

      const onSourceOpen = (): void => {
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
              // ignore
            }
          }
        };

        sourceBuffer.addEventListener('updateend', () => {
          isAppending = false;
          if (!started) {
            started = true;
            this.tryPlay().then(resolve).catch(reject);
          }
          drain();
        });

        const onAbort = (): void => {
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
    await this.tryPlay();
  }

  private async tryPlay(): Promise<void> {
    try {
      await this.audio.play();
    } catch (e) {
      const isAutoplayBlock =
        e instanceof Error &&
        (e.name === 'NotAllowedError' || /interact|gesture|user activation/i.test(e.message));
      if (isAutoplayBlock) {
        console.warn('[audio] autoplay blocked — emitting cozza:audio-blocked');
        window.dispatchEvent(
          new CustomEvent('cozza:audio-blocked', {
            detail: { reason: e.message },
          }),
        );
        return; // soft fail: don't reject the chat flow
      }
      console.error('[audio] play() failed', e);
      window.dispatchEvent(
        new CustomEvent('cozza:audio-error', {
          detail: { message: e instanceof Error ? e.message : 'audio error' },
        }),
      );
      throw e;
    }
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
