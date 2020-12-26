export abstract class BasicTime {
  constructor(public timeStep: number) {}
  abstract setInterval(physics: timedFn, render: timedFn): void;
}

type voidFn = () => void;
type timedFn = (elapsed: number) => void;

const startBreakableTimer = (callback: voidFn, step: number) => {
  const timer = setInterval(() => {
    try {
      callback();
    } catch (e) {
      console.log('BREAK by error, time survived:', performance.now());
      clearInterval(timer);
      throw e;
    }
  }, step);
};

export class variableDeltaTime extends BasicTime {
  setInterval(physics: timedFn, render: timedFn) {
    let lastCheck = performance.now();
    startBreakableTimer(() => {
      const currentTime = performance.now();
      const frameTime = currentTime - lastCheck;
      physics(frameTime);
      render(frameTime);
      lastCheck = currentTime;
    }, this.timeStep);
  }
}

export class semiFixedDeltaTime extends BasicTime {
  setInterval(physics: timedFn, render: timedFn) {
    let lastCheck = performance.now();
    startBreakableTimer(() => {
      const currentTime = performance.now();
      let frameTime = currentTime - lastCheck;
      while (frameTime > 0.0) {
        const deltaTime = Math.min(frameTime, this.timeStep);
        physics(deltaTime);
        render(deltaTime);
        frameTime -= deltaTime;
      }
      lastCheck = currentTime;
    }, this.timeStep);
  }
}

export class clampedSemiFixedDeltaTime extends BasicTime {
  private count: number = 0;
  setInterval(physics: timedFn, render: timedFn) {
    let lastCheck = performance.now();
    this.count = 0;
    const clampTime = 1000;

    startBreakableTimer(() => {
      this.count = 0;
    }, clampTime);

    startBreakableTimer(() => {
      const currentTime = performance.now();
      let frameTime = currentTime - lastCheck;
      while (frameTime > 0.0) {
        const deltaTime = Math.min(frameTime, this.timeStep);
        if (this.count < clampTime / this.timeStep) {
          physics(deltaTime);
          render(deltaTime);
          this.count++;
        }
        frameTime -= deltaTime;
      }
      lastCheck = currentTime;
    }, this.timeStep);
  }
}

export class decoupledTime extends BasicTime {
  private accumulator = 0;
  private count = 0;
  setInterval(physics: timedFn, render: timedFn) {
    let lastCheck = performance.now();
    this.accumulator = 0;

    const timerWork = () => {
      const currentTime = performance.now();
      const frameTime = Math.min(currentTime - lastCheck, this.timeStep);
      lastCheck = currentTime;

      this.accumulator += frameTime;

      render(frameTime);
      while (this.accumulator >= this.timeStep) {
        this.accumulator -= this.timeStep;
        physics(this.timeStep);
        this.count++;
      }
    };
    startBreakableTimer(timerWork, this.timeStep);
  }
}

export class decoupledLockedTime extends BasicTime {
  private lock = false;
  private accumulator = 0;
  private count = 0;
  setInterval(physics: timedFn, render: timedFn) {
    let lastCheck = performance.now();
    this.accumulator = 0;
    this.lock = false;

    const timerWork = () => {
      if (this.lock) {
        console.warn('skipping frame due to lock, performance problem?');
        return;
      }
      this.lock = true;
      try {
        const currentTime = performance.now();
        const frameTime = Math.min(currentTime - lastCheck, this.timeStep);
        lastCheck = currentTime;

        this.accumulator += frameTime;

        render(frameTime);
        while (this.accumulator >= this.timeStep) {
          this.accumulator -= this.timeStep;
          physics(this.timeStep);
          this.count++;
        }
      } finally {
        this.lock = false;
      }
    };
    startBreakableTimer(timerWork, this.timeStep);
  }
}

export class decoupledLockedClampedTime extends BasicTime {
  private lock = false;
  private accumulator = 0;
  private count = 0;
  private timePassed = 0;
  setInterval(physics: timedFn, render: timedFn) {
    let lastCheck = performance.now();
    this.accumulator = 0;
    this.lock = false;
    this.count = 0;

    const clampTime = 200;

    startBreakableTimer(() => {
      this.count = 0;
    }, clampTime);

    const timerWork = () => {
      if (this.lock) {
        console.warn('skipping frame due to lock, performance problem?');
        return;
      }
      this.lock = true;
      try {
        const currentTime = performance.now();
        const frameTime = Math.min(currentTime - lastCheck, this.timeStep);
        lastCheck = currentTime;

        this.accumulator += frameTime;

        this.timePassed = frameTime;
        render(frameTime);
        while (this.accumulator >= this.timeStep) {
          this.accumulator -= this.timeStep;
          if (this.count < clampTime / this.timeStep) {
            physics(this.timeStep);
            this.count++;
          }
        }
      } finally {
        this.lock = false;
      }
    };
    startBreakableTimer(timerWork, this.timeStep);
  }
}

export class vsyncedDecoupledTime extends BasicTime {
  private accumulator = 0;
  // smoother performance and lighter CPU load, but FPS occasional drops heavily due to GC
  setInterval(physics: timedFn, render: timedFn) {
    let lastCheck = performance.now();
    this.accumulator = 0;

    const timerWork = () => {
      const currentTime = performance.now();
      const frameTime = currentTime - lastCheck;
      lastCheck = currentTime;

      this.accumulator += frameTime;

      render(frameTime);
      while (this.accumulator >= this.timeStep) {
        this.accumulator -= this.timeStep;
        physics(this.timeStep);
      }
    };
    const framedWork = () => {
      try {
        timerWork();
        requestAnimationFrame(framedWork);
      } catch (e) {
        console.log('BREAK!');
        throw e;
      }
    };
    requestAnimationFrame(framedWork);
  }
}

export class vsyncedDecoupledLockedTime extends BasicTime {
  private lock = false;
  private accumulator = 0;
  // smoother performance and lighter CPU load, but FPS occasional drops heavily due to GC
  setInterval(physics: timedFn, render: timedFn) {
    let lastCheck = performance.now();
    this.accumulator = 0;
    this.lock = false;

    const timerWork = () => {
      if (this.lock) {
        console.warn('skipping frame due to lock');
        return;
      }
      try {
        this.lock = true;
        const currentTime = performance.now();
        const frameTime = currentTime - lastCheck;
        lastCheck = currentTime;

        this.accumulator += frameTime;

        render(frameTime);
        while (this.accumulator >= this.timeStep) {
          this.accumulator -= this.timeStep;
          physics(this.timeStep);
        }
      } finally {
        this.lock = false;
      }
    };
    const framedWork = () => {
      try {
        timerWork();
        requestAnimationFrame(framedWork);
      } catch (e) {
        console.log('BREAK!');
        throw e;
      }
    };
    requestAnimationFrame(framedWork);
  }
}

// TODO? clamping or scheduling of physics to avoid spiral of death when performance is not enough
// TODO? decoupled interpolated time when physics becomes too slow
// see final touch of https://gafferongames.com/post/fix_your_timestep/
// and then implementation at http://saltares.com/blog/games/fixing-your-timestep-in-libgdx-and-box2d/

export default decoupledLockedClampedTime;
