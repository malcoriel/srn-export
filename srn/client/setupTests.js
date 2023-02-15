// necessary for world/pkg
import 'regenerator-runtime/runtime';
// Polyfill for encoding which isn't present globally in jsdom
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
// jest expect message
import '@alex_neo/jest-expect-message';
