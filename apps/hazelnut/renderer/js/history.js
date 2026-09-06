// Undo / redo.
//
// States are whole-document snapshots. That is heavier than recording deltas,
// but a snapshot is correct for every tool without each tool having to describe
// its own inverse — including the ones that replace the entire layer stack.
// The cost is bounded by a memory budget rather than a fixed step count, so a
// small document gets a deep history and a 24-megapixel one does not eat the
// machine.

import { makeCanvas, ctx2d } from './dom.js';
import { Layer } from './doc.js';

const BUDGET_BYTES = 640 * 1024 * 1024;
const MAX_STATES = 40;

export class History extends EventTarget {
  constructor(doc) {
    super();
    this.doc = doc;
    this.entries = [];
    this.index = -1;
    this.push('Open', 'image');
  }

  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index < this.entries.length - 1; }

  /** Snapshot the document as it stands, labelled with what just happened. */
  push(label, icon = 'check') {
    // Anything that was undone is discarded the moment new work is done.
    this.entries.splice(this.index + 1);
    this.entries.push({ label, icon, at: Date.now(), state: snapshot(this.doc) });
    this.index = this.entries.length - 1;
    this.#trim();
    this.dispatchEvent(new CustomEvent('change'));
  }

  undo() {
    if (!this.canUndo) return false;
    this.index -= 1;
    restore(this.doc, this.entries[this.index].state);
    this.dispatchEvent(new CustomEvent('change'));
    return true;
  }

  redo() {
    if (!this.canRedo) return false;
    this.index += 1;
    restore(this.doc, this.entries[this.index].state);
    this.dispatchEvent(new CustomEvent('change'));
    return true;
  }

  /** Jump straight to a step, the way the History panel does. */
  goto(index) {
    if (index < 0 || index >= this.entries.length || index === this.index) return false;
    this.index = index;
    restore(this.doc, this.entries[index].state);
    this.dispatchEvent(new CustomEvent('change'));
    return true;
  }

  #trim() {
    const bytesOf = (entry) => entry.state.layers.length * entry.state.width * entry.state.height * 4;
    let total = this.entries.reduce((n, e) => n + bytesOf(e), 0);
    // Drop the oldest states first, but never the one being shown.
    while ((total > BUDGET_BYTES || this.entries.length > MAX_STATES) && this.index > 0) {
      total -= bytesOf(this.entries.shift());
      this.index -= 1;
    }
  }
}

function snapshot(doc) {
  return {
    width: doc.width,
    height: doc.height,
    activeId: doc.activeId,
    layers: doc.layers.map((layer) => {
      const copy = makeCanvas(doc.width, doc.height);
      ctx2d(copy).drawImage(layer.canvas, 0, 0);
      return { id: layer.id, name: layer.name, visible: layer.visible, opacity: layer.opacity, canvas: copy };
    }),
  };
}

function restore(doc, state) {
  doc.width = state.width;
  doc.height = state.height;
  doc.composed = makeCanvas(state.width, state.height);
  doc.composedCtx = ctx2d(doc.composed);
  doc.layers = state.layers.map((saved) => {
    const layer = new Layer({ name: saved.name, width: state.width, height: state.height, id: saved.id });
    layer.visible = saved.visible;
    layer.opacity = saved.opacity;
    layer.ctx.drawImage(saved.canvas, 0, 0);
    return layer;
  });
  doc.activeId = state.activeId;
  doc.touch();
}
