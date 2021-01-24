import Vector, { VectorF } from './utils/Vector';
import { calcRealLenToScreenLen, calcRealPosToScreenPos } from './coord';

describe('real to screen', () => {
  describe('with screen 10x10m 100/100px (z=1)', () => {
    const viewPortSizeMeters = VectorF(10, 10);
    const viewPortSizePixels = VectorF(100, 100);

    describe('with camera position 0m 0m', () => {
      const cameraPos = new Vector(0, 0);
      const focus = false;

      it.each`
        realX   | realY  | screenX | screenY | run
        ${0}    | ${0}   | ${50}   | ${50}   | ${false}
        ${5}    | ${5}   | ${100}  | ${100}  | ${false}
        ${5}    | ${-5}  | ${100}  | ${0}    | ${false}
        ${5}    | ${0}   | ${100}  | ${50}   | ${false}
        ${2.5}  | ${2.5} | ${75}   | ${75}   | ${false}
        ${-2.5} | ${2.5} | ${25}   | ${75}   | ${false}
      `(
        'can convert $realX/$realY',
        ({ realX, realY, screenX, screenY, run }) => {
          if (focus && !run) {
            return;
          }
          expect(
            calcRealPosToScreenPos(
              cameraPos,
              viewPortSizeMeters,
              viewPortSizePixels
            )(VectorF(realX, realY))
          ).toEqual(VectorF(screenX, screenY));
        }
      );

      it('can convert length', () => {
        expect(
          calcRealLenToScreenLen(viewPortSizeMeters, viewPortSizePixels)(5)
        ).toEqual(50);
        expect(
          calcRealLenToScreenLen(viewPortSizeMeters, viewPortSizePixels)(10)
        ).toEqual(100);
        expect(
          calcRealLenToScreenLen(viewPortSizeMeters, viewPortSizePixels)(3)
        ).toEqual(30);
      });
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
