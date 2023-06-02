import {
  createStateWithAShip,
  genStateOpts,
  swapGlobals,
  updateWorld,
  wasm,
} from '../util';

const mockProjMovement = {
  tag: 'ShipAccelerated',
  max_linear_speed: 1.0,
  max_rotation_speed: 1.0,
  linear_drag: 1.0,
  acc_linear: 1.0,
  brake_acc: 1.0,
  max_turn_speed: 1.0,
  acc_angular: 1.0,
};

function makeGuideCall(proj_pos, proj_vel, proj_rot, targetPos) {
  return wasm.guideProjectile({
    projectile: {
      tag: 'Rocket',
      fields: {
        id: 0,
        spatial: {
          position: proj_pos,
          velocity: proj_vel,
          angular_velocity: 0.0,
          rotation_rad: proj_rot,
          radius: 1.0,
        },
        movement: mockProjMovement,
        properties: [],
        target: {
          tag: 'Ship',
          id: '9243421c5ca346f4942e5649768c8f10',
        },
        damage: 1.0,
        damage_radius: 1.0,
        guidance_acceleration: 1.0,
        to_clean: false,
      },
    },
    target_spatial: {
      position: targetPos,
      velocity: {
        x: 0,
        y: 0,
      },
      angular_velocity: 0.0,
      rotation_rad: 0.0,
      radius: 1.0,
    },
    elapsed_micro: 16000,
  });
}

function expectPropertyPresence(props, propName) {
  expect(props).toEqual(
    expect.arrayContaining([expect.objectContaining({ tag: propName })])
  );
}

function mockRocket(position, lifetime) {
  return {
    tag: 'Rocket',
    fields: {
      id: 1,
      spatial: {
        position,
        velocity: {
          x: 0.0,
          y: 0.0,
        },
        angular_velocity: 0.0,
        rotation_rad: 0,
        radius: 1.0,
      },
      movement: mockProjMovement,
      properties: [
        {
          tag: 'Lifetime',
          fields: {
            progress_normalized: 0.0,
            remaining_ticks: lifetime,
            max_ticks: lifetime,
          },
        },
      ],
      damage: 1.0,
      damage_radius: 5.0,
      to_clean: false,
    },
  };
}

describe('combat projectiles', () => {
  beforeAll(swapGlobals);
  describe('approach', () => {
    xit('can turn towards target', () => {
      const counterClockwise = makeGuideCall(
        {
          x: 0,
          y: 0,
        },
        {
          x: 0,
          y: 0,
        },
        0.0,
        {
          x: 1.0,
          y: 1.0,
        }
      );

      expect(counterClockwise.gas).toBeCloseTo(0.0);
      expect(counterClockwise.turn).toBeCloseTo(1.0); // turn counterclockwise in math coords
      const clockwise = makeGuideCall(
        {
          x: 0,
          y: 0,
        },
        {
          x: 0,
          y: 0,
        },
        Math.PI / 2,
        {
          x: 1.0,
          y: 1.0,
        }
      );

      expect(clockwise.gas).toBeCloseTo(0.0);
      expect(clockwise.turn).toBeCloseTo(-1.0);
    });

    xit('can stay on course', () => {
      const result = makeGuideCall(
        {
          x: 0,
          y: 0,
        },
        {
          x: Math.sqrt(2),
          y: Math.sqrt(2),
        },
        Math.PI / 4,
        {
          x: 1.0,
          y: 1.0,
        }
      );

      expect(result.gas).toBeCloseTo(0.0); // no accelerate since already max speed
      expect(result.turn).toBeCloseTo(0.0); // no turn because ideal direction and velocity
    });

    xit('can turn for 90 deg angles', () => {
      const clockwise = makeGuideCall(
        {
          x: 0,
          y: 0,
        },
        {
          x: Math.sqrt(2),
          y: Math.sqrt(2),
        },
        Math.PI * 0.75,
        {
          x: 1.0,
          y: 1.0,
        }
      );

      expect(clockwise.gas).toBeCloseTo(-1); // decelerate to not desync further
      expect(clockwise.turn).toBeCloseTo(-1); // turn clockwise in math coords
      const counterClockwise = makeGuideCall(
        {
          x: 0,
          y: 0,
        },
        {
          x: Math.sqrt(2),
          y: Math.sqrt(2),
        },
        -Math.PI * 0.25,
        {
          x: 1.0,
          y: 1.0,
        }
      );

      expect(counterClockwise.gas).toBeCloseTo(-1); // decelerate to not desync further
      expect(counterClockwise.turn).toBeCloseTo(1); // turn counter-clockwise in math coords
    });

    xit('can turn for 90 deg angles but for different positions', () => {
      const clockwise = makeGuideCall(
        {
          x: 0,
          y: 1,
        },
        {
          x: Math.sqrt(2),
          y: Math.sqrt(2),
        },
        Math.PI * 0.25,
        {
          x: 1.0,
          y: 0.0,
        }
      );

      expect(clockwise.gas).toBeCloseTo(-1); // decelerate to not desync further
      expect(clockwise.turn).toBeCloseTo(-1); // turn clockwise in math coords

      const counterclockwise = makeGuideCall(
        {
          x: 0,
          y: -1,
        },
        {
          x: Math.sqrt(2),
          y: -Math.sqrt(2),
        },
        -Math.PI * 0.25,
        {
          x: 1.0,
          y: 0.0,
        }
      );

      expect(counterclockwise.gas).toBeCloseTo(-1); // decelerate to not desync further
      expect(counterclockwise.turn).toBeCloseTo(1); // turn counter-clockwise in math coords
    });

    it('can expire after specified time + 3s', () => {
      const { state } = createStateWithAShip('Sandbox');
      state.locations[0].projectiles.push(
        mockRocket(
          {
            x: -100.0,
            y: -100.0,
          },
          1e6
        )
      );
      const stillAlive = updateWorld(state, 900);
      expect(stillAlive.locations[0].projectiles.length).toEqual(1);
      const decaying = updateWorld(stillAlive, 200);
      expect(decaying.locations[0].projectiles.length).toEqual(1);
      expectPropertyPresence(
        decaying.locations[0].projectiles[0].fields.properties,
        'Decays'
      );
      const expired = updateWorld(decaying, 3000);
      expect(expired.locations[0].projectiles.length).toEqual(0);
    });
    it('can blow up another missile with explosion', () => {
      let state = wasm.seedWorld({
        seed: 'projectiles',
        mode: 'Sandbox',
        gen_state_opts: genStateOpts({ system_count: 1 }),
      });
      state.locations[0].projectiles.push(
        mockRocket(
          {
            x: 100.0,
            y: 0.0,
          },
          1e6
        )
      );
      state.locations[0].projectiles.push(
        mockRocket(
          {
            x: 105.0,
            y: 0.0,
          },
          1e6
        )
      );
      state = updateWorld(state, 5000);
      expect(state.locations[0].projectiles.length).toEqual(0);
    });
  });
});
