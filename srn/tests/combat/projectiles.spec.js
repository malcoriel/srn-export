import { swapGlobals, wasm } from '../util';

const makeGuideCall = (proj_spatial, proj_movement, targetSpatial) =>
  wasm.guideProjectile({
    projectile: {
      tag: 'Rocket',
      fields: {
        id: 0,
        spatial: proj_spatial,
        movement: proj_movement,
        properties: [],
        target: {
          tag: 'Ship',
          id: '9243421c5ca346f4942e5649768c8f10',
        },
        damage: 1.0,
        damage_radius: 1.0,
        guidance_acceleration: 1.0,
      },
    },
    target_spatial: targetSpatial,
    elapsed_micro: 16000,
  });

describe('combat projectiles', () => {
  beforeAll(swapGlobals);
  it('can guide a projectile correctly', () => {
    const proj_spatial = {
      position: {
        x: 0,
        y: 0,
      },
      velocity: {
        x: 0,
        y: 0,
      },
      angular_velocity: 0.0,
      rotation_rad: 0.0,
      radius: 1.0,
    };
    const proj_movement = {
      tag: 'ShipAccelerated',
      max_linear_speed: 1.0,
      max_rotation_speed: 1.0,
      linear_drag: 1.0,
      acc_linear: 1.0,
      max_turn_speed: 1.0,
      acc_angular: 1.0,
    };
    const targetSpatial = {
      position: {
        x: 1.0,
        y: 1.0,
      },
      velocity: {
        x: 0,
        y: 0,
      },
      angular_velocity: 0.0,
      rotation_rad: 0.0,
      radius: 1.0,
    };
    const result = makeGuideCall(proj_spatial, proj_movement, targetSpatial);

    expect(result.gas).toBeCloseTo(1.0); // accelerate
    expect(result.turn).toBeCloseTo(1.0); // turn counterclockwise in math coords
  });
});
