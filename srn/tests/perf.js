const { PerformanceObserver, createHistogram } = require('perf_hooks');
const storage = global.perfStorage || {
  fnCalls: {},
};

global.perfStorage = storage;

if (process.env.ENABLE_PERF) {
  const obs = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach(({ name, duration: durationMs, type }) => {
      const duration = Number(durationMs.toFixed(0));
      if (!storage.fnCalls[name]) {
        console.log('init', name);
        storage.fnCalls[name] = {
          histogram: createHistogram(),
          callCount: 0,
        };
      }
      const item = storage.fnCalls[name];
      item.callCount += 1;
      item.histogram.record(duration);
    });
    // disconnect here actually ruins everything, so no disconnecting
  });
  obs.observe({
    entryTypes: ['measure'],
    buffered: false,
  });
}

export const flushPerfStats = () => {
  if (process.env.ENABLE_PERF) {
    console.log('perf stats');
    console.log('---------');
    for (const [name, call] of Object.entries(storage.fnCalls)) {
      console.log(`${name}: mn=${call.histogram.mean}ms (n=${call.callCount})`);
    }
    console.log('---end---');
  }
};

export const perf = require('perf_hooks').performance;

let globCallCounter = 0;
export const timerify = (fn) => async (...args) => {
  const label = fn.name;
  globCallCounter++;
  const localCounter = globCallCounter;
  const start = `${localCounter}_start`;
  perf.mark(start);
  try {
    return await fn(...args);
  } finally {
    const end = `${localCounter}_end`;
    perf.mark(end);
    perf.measure(label, start, end);
  }
};

export const timerifySync = (fn) => (...args) => {
  const label = fn.name;
  globCallCounter++;
  const localCounter = globCallCounter;
  const start = `${localCounter}_start`;
  perf.mark(start);
  try {
    return fn(...args);
  } finally {
    const end = `${localCounter}_end`;
    perf.mark(end);
    perf.measure(label, start, end);
  }
};
