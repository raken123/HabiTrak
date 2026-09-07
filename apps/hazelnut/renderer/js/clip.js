// A clip in the editor.
//
// Squirreal's document is still a layer stack — every tool works on the frame
// you are parked on — but behind it sits a sequence of frames and a rate. The
// background layer is redrawn from the clip whenever the playhead moves, so
// Draw, Expand and AIScope need to know nothing about video at all.

import { makeCanvas, ctx2d, loadImage } from './dom.js';

export class Clip {
  /**
   * @param {{frames: HTMLCanvasElement[], fps?: number}} opts
   */
  constructor({ frames, fps = 24, source = null }) {
    if (!frames?.length) throw new Error('A clip needs at least one frame.');
    this.frames = frames;
    this.fps = fps;
    this.index = 0;
    // The encoded clip this was decoded from, when there was one. Tools that
    // send the whole clip back to the model pass this rather than re-encoding
    // frames the browser cannot mux.
    this.source = source;
  }

  get length() { return this.frames.length; }
  get seconds() { return this.frames.length / this.fps; }
  get time() { return this.index / this.fps; }

  frame(i = this.index) {
    return this.frames[Math.max(0, Math.min(this.frames.length - 1, Math.round(i)))];
  }

  /** Decode a video data URL into frames by seeking through it. */
  static async fromVideo(dataUrl, { fps = 24, maxFrames = 240, pixelBudget = 400e6 } = {}) {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = dataUrl;

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('That clip could not be decoded.'));
    });

    const width = video.videoWidth;
    const height = video.videoHeight;

    // Frames are held as canvases, so a long clip at a large frame size can ask
    // for more memory than the machine has. Cap the decode by pixels as well as
    // by frame count, and sample at whatever rate that leaves — the clip then
    // plays at the right speed, just with fewer frames in it.
    const byBudget = Math.max(8, Math.floor(pixelBudget / (width * height * 4)));
    const count = Math.max(1, Math.min(maxFrames, byBudget, Math.round(video.duration * fps)));
    const rate = count / video.duration;
    const frames = [];

    for (let i = 0; i < count; i += 1) {
      await new Promise((resolve) => {
        video.onseeked = resolve;
        video.currentTime = Math.min(video.duration - 0.001, i / rate);
      });
      const canvas = makeCanvas(width, height);
      ctx2d(canvas).drawImage(video, 0, 0);
      frames.push(canvas);
    }
    return new Clip({ frames, fps: rate, source: dataUrl });
  }

  /** Frames handed over already decoded, as data URLs. */
  static async fromFrames(urls, { fps = 24 } = {}) {
    const images = await Promise.all(urls.map(loadImage));
    const frames = images.map((img) => {
      const canvas = makeCanvas(img.naturalWidth, img.naturalHeight);
      ctx2d(canvas).drawImage(img, 0, 0);
      return canvas;
    });
    return new Clip({ frames, fps });
  }
}

/**
 * Attach a clip to a document: the background layer becomes a window onto the
 * clip, and moving the playhead redraws it. Everything above the background is
 * left alone, so a stroke drawn on a layer stays put while the clip plays.
 */
export function attachClip(doc, clip) {
  doc.clip = clip;
  doc.setFrame = (index) => {
    clip.index = Math.max(0, Math.min(clip.length - 1, Math.round(index)));
    const background = doc.layers[0];
    if (!background) return;
    background.clear();
    background.ctx.drawImage(clip.frame(), 0, 0, doc.width, doc.height);
    doc.touch();
  };
  doc.setFrame(0);
  return doc;
}
