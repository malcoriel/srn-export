// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
// necessary for react-three/drei
// @ts-ignore
window.URL.createObjectURL = () => {};
// necessary for react-sprint
window.ResizeObserver = require('resize-observer-polyfill');
// some weird react complain, also duplicated in __mocks__
jest.mock('scheduler', () => require('scheduler/unstable_mock'));

// necessary for world/pkg
import 'regenerator-runtime/runtime';
