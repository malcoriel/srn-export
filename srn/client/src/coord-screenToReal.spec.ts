import Vector, { VectorF } from './utils/Vector';
import { calcScreenPosToRealPos } from './coord';

describe('screen to real', () => {
  describe('with screen 10x10m 100/100px (z=1)', () => {
    const viewPortSizeMeters = VectorF(10, 10); //m
    const viewPortSizePixels = VectorF(100, 100); //px

    describe('with camera position 0m 0m', () => {
      const cameraPos = new Vector(0, 0);
      const focus = false;

      it.each`
        mouseX | mouseY | realX   | realY  | run
        ${50}  | ${50}  | ${0}    | ${0}   | ${false}
        ${100} | ${0}   | ${5}    | ${-5}  | ${false}
        ${100} | ${90}  | ${5}    | ${4}   | ${false}
        ${0}   | ${0}   | ${-5}   | ${-5}  | ${false}
        ${0}   | ${50}  | ${-5}   | ${0}   | ${false}
        ${25}  | ${75}  | ${-2.5} | ${2.5} | ${false}
      `(
        'can convert $mouseX/$mouseY',
        ({ mouseX, mouseY, realX, realY, run }) => {
          if (focus && !run) {
            return;
          }
          expect(
            calcScreenPosToRealPos(
              cameraPos,
              viewPortSizeMeters,
              viewPortSizePixels
            )(VectorF(mouseX, mouseY))
          ).toEqual(VectorF(realX, realY));
        }
      );
    });

    describe('with camera position 5m 2.5m', () => {
      const cameraPos = new Vector(5, 2.5);
      const focus = false;

      it.each`
        mouseX | mouseY | realX   | realY  | run
        ${50}  | ${50}  | ${0}    | ${0}   | ${false}
        ${100} | ${0}   | ${5}    | ${-5}  | ${false}
        ${100} | ${90}  | ${5}    | ${4}   | ${false}
        ${0}   | ${0}   | ${-5}   | ${-5}  | ${false}
        ${0}   | ${50}  | ${-5}   | ${0}   | ${false}
        ${25}  | ${75}  | ${-2.5} | ${2.5} | ${false}
      `(
        'can convert $mouseX/$mouseY',
        ({ mouseX, mouseY, realX, realY, run }) => {
          if (focus && !run) {
            return;
          }
          expect(
            calcScreenPosToRealPos(
              cameraPos,
              viewPortSizeMeters,
              viewPortSizePixels
            )(VectorF(mouseX, mouseY))
          ).toEqual(VectorF(realX + 5, realY + 2.5));
        }
      );
    });
  });

  describe('with screen 20x20m 100/100px (z=0.5)', () => {
    const viewPortSizeMeters = VectorF(20, 20); //m
    const viewPortSizePixels = VectorF(100, 100); //px

    describe('with camera position 0m 0m', () => {
      const cameraPos = new Vector(0, 0);
      const focus = false;

      it.each`
        mouseX | mouseY | realX | realY | run
        ${50}  | ${50}  | ${0}  | ${0}  | ${false}
        ${100} | ${100} | ${10} | ${10} | ${false}
        ${75}  | ${25}  | ${5}  | ${-5} | ${false}
        ${30}  | ${60}  | ${-4} | ${2}  | ${false}
      `(
        'can convert $mouseX/$mouseY',
        ({ mouseX, mouseY, realX, realY, run }) => {
          if (focus && !run) {
            return;
          }
          expect(
            calcScreenPosToRealPos(
              cameraPos,
              viewPortSizeMeters,
              viewPortSizePixels
            )(VectorF(mouseX, mouseY))
          ).toEqual(VectorF(realX, realY));
        }
      );
    });

    describe('with camera position 5m 10m', () => {
      const cameraPos = new Vector(5, 10);
      const focus = false;

      it.each`
        mouseX | mouseY | realX | realY | run
        ${50}  | ${50}  | ${0}  | ${0}  | ${false}
        ${100} | ${100} | ${10} | ${10} | ${false}
        ${75}  | ${25}  | ${5}  | ${-5} | ${false}
        ${30}  | ${60}  | ${-4} | ${2}  | ${false}
      `(
        'can convert $mouseX/$mouseY',
        ({ mouseX, mouseY, realX, realY, run }) => {
          if (focus && !run) {
            return;
          }
          expect(
            calcScreenPosToRealPos(
              cameraPos,
              viewPortSizeMeters,
              viewPortSizePixels
            )(VectorF(mouseX, mouseY))
          ).toEqual(VectorF(realX + 5, realY + 10));
        }
      );
    });
  });

  describe('with screen 10x5m 100/50px (z=1)', () => {
    const viewPortSizeMeters = VectorF(10, 5);
    const viewPortSizePixels = VectorF(100, 50);

    describe('with camera position 0m 0m', () => {
      const cameraPos = new Vector(0, 0);
      const focus = false;

      it.each`
        mouseX | mouseY | realX | realY   | run
        ${50}  | ${25}  | ${0}  | ${0}    | ${false}
        ${50}  | ${50}  | ${0}  | ${2.5}  | ${false}
        ${100} | ${50}  | ${5}  | ${2.5}  | ${false}
        ${0}   | ${0}   | ${-5} | ${-2.5} | ${false}
        ${60}  | ${30}  | ${1}  | ${0.5}  | ${false}
      `(
        // last case is unclear, maybe realY should be 1
        'can convert $mouseX/$mouseY',
        ({ mouseX, mouseY, realX, realY, run }) => {
          if (focus && !run) {
            return;
          }
          expect(
            calcScreenPosToRealPos(
              cameraPos,
              viewPortSizeMeters,
              viewPortSizePixels
            )(VectorF(mouseX, mouseY))
          ).toEqual(VectorF(realX, realY));
        }
      );
    });
  });

  describe('with screen 100x100m 971/916px (z=1)', () => {
    const viewPortSizeMeters = VectorF(100, 100);
    const viewPortSizePixels = VectorF(971, 916);

    describe('with camera position -50m 50m', () => {
      const cameraPos = new Vector(-50, 50);
      const focus = false;

      it.each`
        mouseX | mouseY | realX | realY | run
        ${971} | ${0}   | ${0}  | ${0}  | ${false}
      `(
        // last case is unclear, maybe realY should be 1
        'can convert $mouseX/$mouseY',
        ({ mouseX, mouseY, realX, realY, run }) => {
          if (focus && !run) {
            return;
          }
          expect(
            calcScreenPosToRealPos(
              cameraPos,
              viewPortSizeMeters,
              viewPortSizePixels
            )(VectorF(mouseX, mouseY))
          ).toEqual(VectorF(realX, realY));
        }
      );
    });
  });
});

/*
Screen - y down, x right

MouseToReal(mouse xy px) - real xy m
Minimap(camera xy m + viewport wh px) - minimap xy px + minimap wh px
ClickMinimap(minimap xy px, minimap wh px) - minimap xy px

Screen 100 50px
Viewport 10 x 5m
Camera position 0 0

Mouse 50 25 = 0 0
Mouse 50 50 = 0 2.5
Mouse 100 50 = 5 2.5
Mouse 0 0 = - 5 - 2.5
Mouse 60 30 = 1 1
*/
