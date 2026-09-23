import test from 'node:test';
import assert from 'node:assert/strict';
import {mountPhotoViewer} from '../web/photo-view.mjs';

// A small DOM fixture lets network completions arrive in a controlled order.
function fixture(t) {
  const previous = globalThis.document, nodes = new Map();
  class Element {
    constructor(tag = 'div') {this.tag = tag; this.hidden = false; this.listeners = {}; this.attributes = {}; this.textContent = '';}
    set id(value) {this._id = value; nodes.set(value, this);}
    get id() {return this._id;}
    setAttribute(key, value) {this.attributes[key] = value;}
    removeAttribute(key) {delete this.attributes[key]; delete this[key];}
    addEventListener(type, fn) {(this.listeners[type] ||= []).push(fn);}
    emit(type) {for (const fn of this.listeners[type] || []) fn();}
    replaceWith(next) {nodes.set(this.id, next);}
    after() {}
    showModal() {this.open = true;}
    close() {this.open = false; this.emit('close');}
    focus() {globalThis.document.activeElement = this;}
  }
  for (const id of ['photo-dialog', 'photo-full', 'photo-close', 'photo-failure', 'photo-title',
    'photo-caption', 'photo-location', 'photo-credit', 'photo-source', 'photo-original', 'photo-license']) {
    const element = new Element(); element.id = id;
  }
  globalThis.document = {getElementById: id => nodes.get(id), createElement: tag => new Element(tag)};
  t.after(() => {if (previous === undefined) delete globalThis.document; else globalThis.document = previous;});
  return {open: mountPhotoViewer(), get: id => nodes.get(id)};
}
const first = {title:'First record', asset:'first.jpg', alt:'First photograph', caption:'First caption',
  location:'Time unknown', credit:'First photographer', source:'https://example.test/first',
  license:'Example license', licenseUrl:'https://example.test/license'};
const second = {title:'Second record', asset:'second.jpg', alt:'Second photograph', caption:'Second caption',
  location:'Camera position unknown', credit:'Second photographer', source:'https://example.test/second'};

test('the selected caption is never paired with the previous loaded photograph', t => {
  const {open,get} = fixture(t);
  open(first); get('photo-full').emit('load');
  assert.equal(get('photo-full').hidden, false);
  const oldImage = get('photo-full');
  get('photo-close').emit('click'); open(second);
  assert.equal(get('photo-full').hidden, true);
  assert.notEqual(get('photo-full'), oldImage);
  assert.equal(get('photo-caption').textContent, second.caption);
  assert.match(get('photo-status').textContent, /Loading/);
  get('photo-full').emit('load');
  assert.equal(get('photo-full').hidden, false);
  assert.equal(get('photo-status').textContent, '');
});

test('a failed request retains its source and can be retried without closing', t => {
  const {open,get} = fixture(t); open(first);
  const failed = get('photo-full'); failed.emit('error');
  assert.equal(get('photo-full').hidden, true);
  assert.equal(get('photo-failure').hidden, false);
  assert.equal(get('photo-source').href, first.source);
  assert.equal(get('photo-credit').textContent, first.credit);
  assert.equal(get('photo-retry')?.hidden, false);
  get('photo-retry').emit('click');
  const retried = get('photo-full');
  assert.notEqual(retried, failed);
  assert.equal(retried.src, first.asset);
  assert.equal(get('photo-failure').hidden, true);
  assert.equal(get('photo-dialog').open, true);
  retried.emit('load');
  assert.equal(retried.hidden, false);
  assert.equal(get('photo-retry').hidden, true);
  assert.equal(document.activeElement, get('photo-close'));
});

test('late events from a replaced request cannot hide or reveal the selected image', t => {
  const {open,get} = fixture(t); open(first);
  const stale = get('photo-full');
  open(second); const current = get('photo-full');
  stale.emit('load'); assert.equal(current.hidden, true);
  current.emit('load'); stale.emit('error');
  assert.equal(current.hidden, false);
  assert.equal(get('photo-failure').hidden, true);
  assert.equal(get('photo-source').href, second.source);
  assert.equal(get('photo-license').hidden, true);
  assert.equal(get('photo-license').href, undefined);
});

test('closing a pending photograph invalidates its later network completion', t => {
  const {open,get} = fixture(t); open(first);
  const pending = get('photo-full'); get('photo-dialog').close();
  pending.emit('error'); pending.emit('load');
  assert.equal(get('photo-failure').hidden, true);
  assert.equal(get('photo-full').hidden, true);
  assert.equal(get('photo-status').textContent, '');
  open(second); get('photo-full').emit('load');
  assert.equal(get('photo-full').hidden, false);
});

test('queued close events do not clear a newly reopened photograph', t => {
  const {open,get} = fixture(t); open(first);
  get('photo-dialog').open = false;
  open(second); get('photo-dialog').emit('close');
  get('photo-full').emit('load');
  assert.equal(get('photo-full').src, second.asset);
  assert.equal(get('photo-full').hidden, false);
});
