import { swapGlobals, wasm } from '../util';
import * as util from 'util';

const { performance } = require('perf_hooks');
const avro = require('avsc');

describe('serialization-benchmark', () => {
  beforeAll(swapGlobals);
  let avroTypeTest;
  let avroTypeState;
  beforeAll(() => {
    const schemas = wasm.getAvroSchemas();
    const registry = {};
    avroTypeTest = avro.Type.forSchema(schemas.Test_V1);
    avroTypeState = avro.Type.forSchema(schemas.Vec2f64_V1, { registry });
    avro.Type.forSchema(schemas.SpatialProps_V1, { registry });
  });

  const callTestAvro = (value, state = false) => {
    const targetType = state ? avroTypeState : avroTypeTest;
    const ser = targetType.toBuffer(value);
    const binary = (state ? wasm.avroTestState : wasm.avroTest)(ser);
    return targetType.fromBuffer(Buffer.from(binary), undefined, false);
  };

  const callTestJson = (value, state = false) => {
    return (state ? wasm.jsonTestState : wasm.jsonTest)(value);
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
    const millis = stressTestMillis(() => callTestAvro(testVal));
    console.log(
      `avro avg for ${ITER_COUNT} iter for test value is ${(
        millis * 1000
      ).toFixed(0)}mcs`
    );
  });

  it('can stress test json', () => {
    const millis = stressTestMillis(() => callTestJson(testVal));
    console.log(
      `json avg for ${ITER_COUNT} iter for test value is ${(
        millis * 1000
      ).toFixed(0)}mcs`
    );
  });
});
