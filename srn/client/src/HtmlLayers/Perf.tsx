import Q from 'q';
import { mean } from 'simple-statistics';
import _ from 'lodash';
import { variableDeltaTime as Time } from '../utils/Times';

export const statsHeap: Record<string, number> = {
  timeStep: 0,
};

const buffers: Record<Measure, number[]> = {
  PhysicsFrameEvent: [],
  PhysicsFrameTime: [],
  RealFrameEvent: [],
  RenderFrameEvent: [],
  RenderFrameTime: [],
};

export enum Measure {
  PhysicsFrameTime = 'PhysicsFrameTime',
  RenderFrameTime = 'RenderFrameTime',
  PhysicsFrameEvent = 'PhysicsFrameEvent',
  RenderFrameEvent = 'RenderFrameEvent',
  RealFrameEvent = 'RealFrameEvent',
}

export enum Stat {
  AvgPhysicsFrameTime,
  AvgRenderFrameTime,
  AvgTotalFrameTime,
  JSMemUsed,
  JSMemTotal,
  PhysicsFPS,
  RenderFPS,
  RealFPS,
}

_.each(_.keys(Stat), (s) => {
  statsHeap[s] = 0;
});

const flushInterval = 1000;
let lastFlushTime: number;
let accumulatedTime = 0;

const Perf = {
  start: () => {
    const time = new Time(flushInterval);
    time.setInterval(Perf.flushBuffer, () => {});
    requestAnimationFrame(Perf.startRealFPSMeter);
  },

  startRealFPSMeter: () => {
    Perf.markEvent(Measure.RealFrameEvent);
    requestAnimationFrame(Perf.startRealFPSMeter);
  },

  measureFPSStat: function (
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
  measureAvgFrameTimeStat: (
    frameTimeMeasure: Measure,
    avgFrameTimeStat: Stat
  ) => {
    const frameTimes = buffers[frameTimeMeasure] || [];
    statsHeap[avgFrameTimeStat] = frameTimes.length ? mean(frameTimes) : 0;
    buffers[frameTimeMeasure] = [];
  },
  measureFrameStats: (
    avgFrameTimeStat: Stat,
    frameTimeMeasure: Measure,
    frameEvent: Measure,
    debugName: string,
    fpsStat: Stat,
    debug = false
  ) => {
    Perf.measureAvgFrameTimeStat(frameTimeMeasure, avgFrameTimeStat);
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
          'render',
          Stat.RenderFPS
        );
        Perf.measureFPSStat(
          Measure.RealFrameEvent,
          false,
          'real',
          Stat.RealFPS
        );
        statsHeap[Stat.AvgTotalFrameTime] =
          statsHeap[Stat.AvgRenderFrameTime] +
          statsHeap[Stat.AvgPhysicsFrameTime];

        // if (performance.memory) {
        //   statsHeap[Stats.JSMemUsed] = performance.memory.usedJSHeapSize / 1024 / 1024;
        //   statsHeap[Stats.JSMemTotal] = performance.memory.totalJSHeapSize / 1024 / 1024;
        // }
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

  markEvent: (measure: Measure) => {
    buffers[measure].push(performance.now());
  },
};

import React, { useEffect, useState } from 'react';
import './StatsPanel.css';

const formatNumber = (x: any) => {
  return Number(x).toFixed(3);
};

const STATS_REFRESH_TIME = 1000;
let StatsPanel = () => {
  const [force, setForce] = useState(0);
  useEffect(() => {
    let timer = setInterval(() => setForce(force + 1), STATS_REFRESH_TIME);
    return () => clearInterval(timer);
  }, [setForce, force]);
  return (
    <div className="stats">
      <div className="header">Debug info:</div>
      <div className="row">
        <span className="name">Time step:</span>
        <span className="value">{formatNumber(statsHeap.timeStep)}ms</span>
      </div>
      <div className="row">
        <span className="name">Avg physics frame time:</span>
        <span className="value">
          {formatNumber(statsHeap[Stat.AvgPhysicsFrameTime])}ms
        </span>
      </div>
      <div className="row">
        <span className="name">Avg render frame time:</span>
        <span className="value">
          {formatNumber(statsHeap[Stat.AvgRenderFrameTime])}ms
        </span>
      </div>
      <div className="row">
        <span className="name">Avg total frame time:</span>
        <span className="value">
          {formatNumber(statsHeap[Stat.AvgTotalFrameTime])}ms
        </span>
      </div>
      <div className="row">
        <span className="name">PhysicsFPS:</span>
        <span className="value">
          {formatNumber(statsHeap[Stat.PhysicsFPS])}
        </span>
      </div>
      <div className="row">
        <span className="name">RenderFPS:</span>
        <span className="value">{formatNumber(statsHeap[Stat.RenderFPS])}</span>
      </div>
      <div className="row">
        <span className="name">Real FPS:</span>
        <span className="value">{formatNumber(statsHeap[Stat.RealFPS])}</span>
      </div>
      {/*<div className="row">*/}
      {/*<span className="name">JS Heap:</span>*/}
      {/*<span className="value">{formatNumber(statsHeap[Stats.JSMemUsed])}/*/}
      {/*{formatNumber(statsHeap[Stats.JSMemTotal])}MB</span>*/}
      {/*</div>*/}
    </div>
  );
};

export { StatsPanel };

export { Perf };
