import { createRequire } from 'node:module';
import path from 'node:path';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema.js';

// Automatic nudity check for profile photos, run when a member confirms an
// upload. Uses the open-source NSFWJS model (MobileNetV2 "mid", 224px) on the
// TensorFlow.js WebAssembly backend: about 45 ms a photo, no native build, and
// the photo never leaves our server. The model's five classes are Neutral,
// Drawing, Sexy (half-naked: lingerie, swimwear, shirtless, cleavage), Porn
// and Hentai.
//
// The thresholds are deliberately high for an automatic refusal: a fully
// clothed woman in a saree scored Sexy 0.39 in testing, so anything short of
// a confident call goes to staff instead of being refused. Staff still see
// every photo in production (PHOTO_MODERATION=pending); this check stops the
// explicit ones before anyone has to look at them.

export type ScreeningScores = { neutral: number; drawing: number; sexy: number; porn: number; hentai: number };
export type ScreeningVerdict = 'BLOCK' | 'REVIEW' | 'CLEAR';

export const SCREENING_THRESHOLDS = {
  block: { porn: 0.6, hentai: 0.6, sexy: 0.7, combined: 0.85 },
  review: { porn: 0.15, hentai: 0.15, sexy: 0.3, combined: 0.4 },
} as const;

export function screeningVerdict(s: ScreeningScores): ScreeningVerdict {
  const combined = s.porn + s.hentai + s.sexy;
  const b = SCREENING_THRESHOLDS.block;
  if (s.porn >= b.porn || s.hentai >= b.hentai || s.sexy >= b.sexy || combined >= b.combined) return 'BLOCK';
  const r = SCREENING_THRESHOLDS.review;
  if (s.porn >= r.porn || s.hentai >= r.hentai || s.sexy >= r.sexy || combined >= r.combined) return 'REVIEW';
  return 'CLEAR';
}

const INPUT_SIZE = 224;

type Classifier = (rgb: Uint8Array, width: number, height: number) => Promise<ScreeningScores>;

@Injectable()
export class PhotoScreeningService implements OnModuleInit {
  private readonly logger = new Logger(PhotoScreeningService.name);
  private classifier: Promise<Classifier> | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  get enabled(): boolean {
    return this.config.get('PHOTO_SCREENING', { infer: true }) === 'true';
  }

  // Warm the model up at boot so the first upload isn't slow. A failure here
  // is logged, and retried on the next upload.
  onModuleInit() {
    if (!this.enabled) return;
    this.getClassifier().catch(() => undefined);
  }

  // Scores for one image, or null when the check could not run (feature off,
  // model failed to load, unreadable image). Callers must treat null as
  // "not screened", never as clean.
  async screen(bytes: Uint8Array): Promise<{ verdict: ScreeningVerdict; scores: ScreeningScores } | null> {
    if (!this.enabled) return null;
    try {
      const classify = await this.getClassifier();
      const { default: sharp } = await import('sharp');
      // rotate() applies the EXIF orientation; cover-crop to the model's square.
      const { data, info } = await sharp(bytes)
        .rotate()
        .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'cover' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const scores = await classify(new Uint8Array(data), info.width, info.height);
      return { verdict: screeningVerdict(scores), scores };
    } catch (err) {
      this.logger.error(`Photo screening failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private getClassifier(): Promise<Classifier> {
    if (!this.classifier) {
      this.classifier = this.loadClassifier().catch((err: unknown) => {
        this.classifier = null; // let the next upload retry
        this.logger.error(`Could not load the photo screening model: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      });
    }
    return this.classifier;
  }

  private async loadClassifier(): Promise<Classifier> {
    const started = Date.now();
    const tf = await import('@tensorflow/tfjs');
    const wasm = await import('@tensorflow/tfjs-backend-wasm');
    // The .wasm binaries ship inside the package; point the backend at them
    // on disk rather than a CDN.
    const require = createRequire(import.meta.url);
    const wasmDir = path.join(path.dirname(require.resolve('@tensorflow/tfjs-backend-wasm/package.json')), 'dist') + path.sep;
    wasm.setWasmPaths(wasmDir);
    await tf.setBackend('wasm');
    await tf.ready();
    tf.enableProdMode();

    const nsfw = await import('nsfwjs');
    const model = await nsfw.load('MobileNetV2Mid');
    this.logger.log(`Photo screening model ready in ${Date.now() - started} ms (${tf.getBackend()})`);

    return async (rgb, width, height) => {
      const image = tf.tensor3d(rgb, [height, width, 3], 'int32');
      try {
        const predictions = await model.classify(image, 5);
        const score = (name: string) => predictions.find((p) => p.className === name)?.probability ?? 0;
        return { neutral: score('Neutral'), drawing: score('Drawing'), sexy: score('Sexy'), porn: score('Porn'), hentai: score('Hentai') };
      } finally {
        image.dispose();
      }
    };
  }
}
