import Q from 'q';
import { mean } from 'simple-statistics';
import _ from 'lodash';
import React, { useEffect, useState } from 'react';
import { variableDeltaTime as Time } from '../utils/Times';
import './StatsPanel.css';
import { useToggleHotkey } from '../utils/hotkeyHooks';

export const DEV_PERF_COUNTERS_ENABLED = true;

export const PERF_COUNTERS_ENABLED =
  process.env.NODE_ENV === 'production' ? false : DEV_PERF_COUNTERS_ENABLED;

export const statsHeap: Record<string, number> = {
  timeStep: 0,
};

const buffers: Record<Measure, number[]> = {
  SlowUpdateFrameEvent: [],
  SlowUpdateFrameTime: [],
  SocketFrameEvent: [],
  SocketFrameTime: [],
  PhysicsFrameEvent: [],
  PhysicsFrameTime: [],
  RealFrameEvent: [],
  RenderFrameEvent: [],
  RenderFrameTime: [],
  RootComponentRender: [],
  SyncedStateUpdate: [],
  DesyncedStateUpdate: [],
  NetStateEmitChangeTime: [],
  ServerStateSize: [],
  WasmStateSize: [],
};

let counters: Record<string, number> = {};

export enum Measure {
  PhysicsFrameTime = 'PhysicsFrameTime',
  RenderFrameTime = 'RenderFrameTime',
  SlowUpdateFrameTime = 'SlowUpdateFrameTime',
  PhysicsFrameEvent = 'PhysicsFrameEvent',
  RenderFrameEvent = 'RenderFrameEvent',
  SlowUpdateFrameEvent = 'SlowUpdateFrameEvent',
  SocketFrameEvent = 'SocketFrameEvent',
  SocketFrameTime = 'SocketFrameTime',
  RealFrameEvent = 'RealFrameEvent',
  RootComponentRender = 'RootComponentRender',
  DesyncedStateUpdate = 'DesyncedStateUpdate',
  SyncedStateUpdate = 'SyncedStateUpdate',
  NetStateEmitChangeTime = 'NetStateEmitChangeTime',
  ServerStateSize = 'ServerStateSize',
  WasmStateSize = 'WasmStateSize',
}

export enum Stat {
  AvgPhysicsFrameTime,
  AvgRenderFrameTime,
  AvgSlowUpdateFrameTime,
  AvgSocketFrameTime,
  AvgTotalFrameTime,
  PhysicsFPS,
  RenderFPS,
  SlowUpdateFPS,
  SocketFPS,
  RealFPS,
  AvgNetStateEmitChangeTime,
  AvgServerStateSize,
  AvgWasmStateSize,
}

_.each(_.keys(Stat), (s) => {
  statsHeap[s] = 0;
});

const flushInterval = 1000;
let lastFlushTime: number;
let accumulatedTime = 0;

const time = new Time(flushInterval);
let frameRequest: number | undefined;
const Perf = {
  start: () => {
    time.setInterval(Perf.flushBuffer, () => {});
    frameRequest = requestAnimationFrame(Perf.startRealFPSMeter);
  },

  stop: () => {
    time.clearIntervals();
    if (frameRequest) {
      cancelAnimationFrame(frameRequest);
    }
  },

  startRealFPSMeter: () => {
    Perf.markEvent(Measure.RealFrameEvent);
    frameRequest = requestAnimationFrame(Perf.startRealFPSMeter);
  },

  measureFPSStat(
    frameEvent: Measure,
    debug: boolean,
    debugName: string,
    fpsStat: Stat
  ) {
    const frameEvents = buffers[frameEvent] || [];
    const newFrameEvents = [];
    const measuredFrameEvents = [];
    let leftTimeEvensCount = 0;
    for (let i = 0; i < frameEvents.length; ++i) {
      const frameHappenedAt = frameEvents[i];
      if (frameHappenedAt < lastFlushTime) {
        // do not measure, somehow we missed it, do not keep
        leftTimeEvensCount++;
      } else if (frameHappenedAt < lastFlushTime + flushInterval) {
        // what we measure, do not keep
        measuredFrameEvents.push(frameHappenedAt);
      } else {
        // happened later, do not measure, but keep
        newFrameEvents.push(frameHappenedAt);
      }
    }
    if (debug)
      console.log(
        debugName,
        measuredFrameEvents.length,
        newFrameEvents.length,
        leftTimeEvensCount
      );
    statsHeap[fpsStat] = measuredFrameEvents.length / (flushInterval / 1000);
    buffers[frameEvent] = newFrameEvents;
  },
  measureMean: (measure: Measure, avgFrameTimeStat: Stat) => {
    const frameTimes = buffers[measure] || [];
    statsHeap[avgFrameTimeStat] = frameTimes.length ? mean(frameTimes) : 0;
    buffers[measure] = [];
  },
  measureFrameStats: (
    avgFrameTimeStat: Stat,
    frameTimeMeasure: Measure,
    frameEvent: Measure,
    debugName: string,
    fpsStat: Stat,
    debug = false
  ) => {
    Perf.measureMean(frameTimeMeasure, avgFrameTimeStat);
    Perf.measureFPSStat(frameEvent, debug, debugName, fpsStat);
  },
  flushBuffer: (timeElapsed: number) => {
    accumulatedTime += timeElapsed;
    if (accumulatedTime >= flushInterval) {
      try {
        Perf.measureFrameStats(
          Stat.AvgPhysicsFrameTime,
          Measure.PhysicsFrameTime,
          Measure.PhysicsFrameEvent,
          'physics',
          Stat.PhysicsFPS
        );
        Perf.measureFrameStats(
          Stat.AvgRenderFrameTime,
          Measure.RenderFrameTime,
          Measure.RenderFrameEvent,
          'periodic action on every frame',
          Stat.RenderFPS
        );
        Perf.measureMean(
          Measure.NetStateEmitChangeTime,
          Stat.AvgNetStateEmitChangeTime
        );
        Perf.measureMean(Measure.ServerStateSize, Stat.AvgServerStateSize);
        Perf.measureMean(Measure.WasmStateSize, Stat.AvgWasmStateSize);
        Perf.measureFrameStats(
          Stat.AvgSlowUpdateFrameTime,
          Measure.SlowUpdateFrameTime,
          Measure.SlowUpdateFrameEvent,
          'slow render',
          Stat.SlowUpdateFPS
        );
        Perf.measureFrameStats(
          Stat.AvgSocketFrameTime,
          Measure.SocketFrameTime,
          Measure.SocketFrameEvent,
          'socket message handling',
          Stat.SocketFPS
        );
        Perf.measureFPSStat(
          Measure.RealFrameEvent,
          false,
          'real',
          Stat.RealFPS
        );
        statsHeap[Stat.AvgTotalFrameTime] =
          statsHeap[Stat.AvgRenderFrameTime] +
          statsHeap[Stat.AvgPhysicsFrameTime] +
          statsHeap[Stat.AvgSlowUpdateFrameTime] +
          statsHeap[Stat.AvgSocketFrameTime];
      } catch (e) {
        console.error(e);
      } finally {
        lastFlushTime = performance.now();
      }
    }
  },

  usingMeasure: (measure: Measure, fn: () => any) => {
    const start = `${measure}-start`;
    const end = `${measure}-end`;
    performance.mark(start);
    const called = fn();
    if (called && called.then) {
      Q(called).finally(() => performance.mark(end));
    } else {
      performance.mark(end);
    }
    performance.measure(measure, start, end);
    const value = _.get(performance.getEntriesByName(measure), '0.duration');
    if (value) {
      buffers[measure] = buffers[measure] || [];
      buffers[measure].push(value);
    }

    performance.clearMarks(start);
    performance.clearMarks(end);
    performance.clearMeasures(measure);
    return value;
  },

  markEvent: (measure: Measure, value: number = performance.now()) => {
    buffers[measure].push(value);
  },
  markCounter: (name: string) => {
    counters[name] = counters[name] || 0;
    counters[name]++;
  },

  // measure must be unique! if they intersect, it's a mess
  markArtificialTiming: (measure: string) => {
    const start = `${measure}-start`;
    const end = `${measure}-end`;
    performance.mark(start);
    setTimeout(() => {
      try {
        performance.mark(end);
        performance.measure(measure, start, end);
      } catch (e) {
        console.warn(e);
      } finally {
        performance.clearMarks(start);
        performance.clearMarks(end);
        performance.clearMeasures(measure);
      }
    }, 0);
  },
};

export const formatNumber = (x: any) => {
  return Number(x).toFixed(3);
};

const STATS_REFRESH_TIME = 5000;
const StatsPanel = () => {
  const [shown] = useToggleHotkey('shift+f', false, 'show FPS & stats');
  const [force, setForce] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setForce(force + 1), STATS_REFRESH_TIME);
    return () => clearInterval(timer);
  }, [setForce, force]);

  if (!shown) return null;

  return (
    <div className="stats panel aux-panel">
      <div className="header">Debug info:</div>
      <div className="row">
        <span className="name">Avg render frame time:</span>
        <span className="value">
          {formatNumber(statsHeap[Stat.AvgRenderFrameTime])}
          ms
        </span>
      </div>
      <div className="row">
        <span className="name">Emit change time:</span>
        <span className="value">
          {formatNumber(statsHeap[Stat.AvgNetStateEmitChangeTime])}
          ms
        </span>
      </div>
      <div className="row">
        <span className="name">Avg slow update frame time:</span>
        <span className="value">
          {formatNumber(statsHeap[Stat.AvgSlowUpdateFrameTime])}
          ms
        </span>
      </div>
      <div className="row">
        <span className="name">Slow updates:</span>
        <span className="value">
          {formatNumber(statsHeap[Stat.SlowUpdateFPS])}
        </span>
      </div>
      <div className="row">
        <span className="name">State size from server</span>
        <span className="value">
          {formatNumber(statsHeap[Stat.AvgServerStateSize] / 1024)}KiB
        </span>
      </div>
    </div>
  );
};

export { StatsPanel };

export { Perf };

let lastFlush = performance.now();
// @ts-ignore
window.flushPerfCounters = () => {
  console.log('time', (performance.now() - lastFlush).toFixed(0), 'ms');
  lastFlush = performance.now();
  console.log(counters);
  counters = {};
};
