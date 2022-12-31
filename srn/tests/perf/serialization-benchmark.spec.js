import { swapGlobals, wasm } from '../util';

const { performance } = require('perf_hooks');
const avro = require('avsc');

describe('serialization-benchmark', () => {
  beforeAll(swapGlobals);
  let avroTypeTest;
  let avroTypeState;
  beforeAll(() => {
    const schemas = wasm.getAvroSchemas();
    const registry = {};
    for (const schema of schemas) {
      // avro_schemas generation is done in such a way that the structure entries here are topologically sorted
      avro.Type.forSchema(schema, { registry });
    }
    avroTypeTest = avro.Type.forSchema(registry.test);
    avroTypeState = avro.Type.forSchema(registry.Vec2f64);
  });

  let accumulatedTransferredBytes = 0;

  const callTestAvro = (value, state = false) => {
    const targetType = state ? avroTypeState : avroTypeTest;
    const ser = targetType.toBuffer(value);
    accumulatedTransferredBytes += Buffer.byteLength(ser);
    const binary = (state ? wasm.avroTestState : wasm.avroTest)(ser);
    const resBuffer = Buffer.from(binary);
    accumulatedTransferredBytes += Buffer.byteLength(resBuffer);
    return targetType.fromBuffer(resBuffer, undefined, true);
  };

  let inSize = 0;
  let outSize = 0;

  const callTestJson = (value, state = false) => {
    if (!inSize) {
      inSize = JSON.stringify(value).length;
    }
    accumulatedTransferredBytes += inSize;
    const res = (state ? wasm.jsonTestState : wasm.jsonTest)(value);
    if (!outSize) {
      outSize = JSON.stringify(res).length;
    }
    accumulatedTransferredBytes += outSize;
    return res;
  };

  const testVal = {
    a: 27,
    b: 'foo',
    c: 32,
  };

  const testState = {
    x: 5,
    y: 0,
  };

  it('can modify data with avro', () => {
    const val = callTestAvro(testVal);
    expect(val.a).toEqual(72);
  });

  it('can modify state with avro', () => {
    const val = callTestAvro(testState, true);
    expect(val.x).toEqual(10);
  });

  it('can modify data with json', () => {
    const val = callTestJson(testVal);
    expect(val.a).toEqual(72);
  });

  const ITER_COUNT = 1000;

  function stressTestMillis(testFn) {
    const now = performance.now();
    for (let i = 0; i < ITER_COUNT; i++) {
      testFn();
    }
    const end = performance.now();
    return (end - now) / ITER_COUNT;
  }

  it('can stress test avro', () => {
    accumulatedTransferredBytes = 0;
    const millis = stressTestMillis(() => callTestAvro(testVal));
    console.log(
      `avro avg for ${ITER_COUNT} iter for test value is ${(
        millis * 1000
      ).toFixed(0)}mcs`,
      `bytes transferred=${accumulatedTransferredBytes}`
    );
  });

  it('can stress test json', () => {
    accumulatedTransferredBytes = 0;
    inSize = 0;
    outSize = 0;
    const millis = stressTestMillis(() => callTestJson(testVal));
    console.log(
      `json avg for ${ITER_COUNT} iter for test value is ${(
        millis * 1000
      ).toFixed(0)}mcs`,
      `bytes transferred=${accumulatedTransferredBytes}`
    );
  });
});
