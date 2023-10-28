# SRN aka Star Rangers Network

## Overview

This is a pet project of Valeriy Kuzmin (@malcoriel), created purely for personal entertainment purposes.
The game is a 2d space privateer style-game, with some variety of modes to play. Obviously inspired by an old
Space Rangers game by SNK Games.

## Status

The project is in perpetual alpha state by design, with somewhat periodic releases to https://srn.malcoriel.de

## Development

### Environment needed

1. The project is primarily ran on Linux, however it may work on Windows too, and very likely will work on MacOS.
2. Rust version: rustc 1.67.0-nightly (5f3700105 2022-03-22)
3. `rustup target add wasm32-unknown-unknown` - necessary for wasm builds
3. `wasm-bindgen-cli` needed in PATH: version 0.2.83 (strictly this one)
4. `wasm-pack` needed in PATH: version 0.10.3 (may work with higher)
5. yarn v1 (may work with npm, but the lockfiles are for yarn v1)
6. `docker` is needed for releasing, and normally is not required.

### Setup

1. Run `yarn install` in the root folder, `client`, `server`, `world`, `tests`.
2. Go to root folder.
3. Run `yarn wasm-pack` to compile wasm part of the project.
4. Run `yarn wasm-pack forTests` to compile wasm for running unit tests.

### Starting debug version (default)

1. Run `yarn start-server` in the root folder (will block the console).
2. In a separate terminal, run `yarn start-client` (will also block the console and launch the browser when it's ready).
3. A browser window for http://localhost:3000 will open, where the game should be playable.

## Architecture

The project is deliberately written in rust + TS for playability in browser and rapid development of UI.

The core of the game primarily resides in server and world folders. This core is compiled into
wasm library via wasm-bindgen and exposes a set of functions that can be called either from testing
environment of node.js or from the browser.

The UI is written in Typescript, react-three-fibers and konva, with occasional GLSL for Three.js shaders. Parts of the
UI
that are underperforming are getting rewritten into Rust, although with paying a price of serialization 'bridging' for
function calls.

Server and client communicate via raw websockets with custom protocol inside the game, and via http api outside of the
game.
For example, room checking calls or api status calls are just http, while state sharing and UI input is done via
websockets.

World is a library wrapper of the server-side code into wasm, and handles primarily various argument remapping duties.

## Testing

The project contains quite a big variety of tests, although obviously with not the greatest coverage.
Tests are mostly being written on-demand, to either TDD something or ensure some brittle part to not be
broken by other parts.

### Server and shared code testing

#### In-rust

There are very few remaining tests written in rust can be run via `cargo test` in the `server` folder. They are
gradually being rewritten
into in-js tests. Tests are almost exclusively unit tests.

#### In-js

In a somewhat perverse way, the majority of testing of rust is done via jest. Through `world` exposure and
some monkey-patching of wasm-bindgen output, it is possible to run the wasm code inside jest environment. Those tests
can be run
via `yarn test` inside the `tests` folder. Tests are both integration (up to a degree of full simulation of the game
in-memory)
or unit (for testing specific exposed functions).

### Client and e2e testing

#### Unit tests

A small amount of TS logic is covered by unit tests, accessible via `yarn test` in the `client` folder.

#### Storybook components tests

Storybook is launched via `yarn storybook` in the root folder. By default, the server is not necessary. There are tests
for html components (UI section)
and three.js components (Three section). Some tests are auxiliary in a sense that they are used for resource generation,
e.g. `PlanetTextureGeneration`.

#### Storybook e2e aka functional tests

Storybook is launched via `yarn storybook` in the root folder. The functional tests require a running server.

