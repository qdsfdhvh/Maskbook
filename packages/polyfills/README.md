# Polyfill

## Exports

- Basic: `dist/ecmascript.js` should be imported everywhere.
- DOM: `dist/dom.js` should be used in normal Web page.
- Worker: `dist/worker.js` should be used in Web Workers.

Extra:

- Intl: `dist/intl.js` provides polyfill for ES Intl API.
- Secp256k1 support in WebCrypto: `dist/secp256k1.js`

## Supporting browsers

- Safari 14+ (Released on Sept 2020)
- Chrome Last 2 versions (about 3 months) (98+ at 3/4/2022)
- Firefox Last 2 versions (about 3 months) (97+ at 3/4/2022)
- GeckoView 91 (last updated at 7/23/2021).

## Targeting ES Syntax and APIs

- Syntax: ES2020
- Library: ES2022 (with [core-js](https://github.com/zloirock/core-js)).

### Caution

Those features are not easy to polyfill.

- ES2017: SharedArrayBuffer and Atomics
- ES2018: - (Syntax) RegExp Lookbehind Assertions (Safari not supported)
- ES2020:
  - BigInt64Array (requires Safari 15)
  - BigUint64Array (requires Safari 15)
  - DataView.prototype.getBigInt64 (requires Safari 15)
  - DataView.prototype.getBigUint64 (requires Safari 15)
- ES2021:
  - WeakReference (requires Safari 15)
- ES2022:
  - ⭐ C l a s s ⭐ F i e l d s ⭐ (requires Safari 15)
  - Class initialization block (Safari not supported, Firefox 93+)

## Web APIs and Intl APIs

Check and polyfill before using.

### Simply polyfilled

- Intl.ListFormat

### Using polyfill

- navigator.clipboard (with `ClipboardItem`) (Firefox not supported)
