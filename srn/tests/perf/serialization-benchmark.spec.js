import { swapGlobals, wasm } from '../util';

const avro = require('avsc');

describe('serialization-benchmark', () => {
  beforeAll(swapGlobals);
  it('can modify data with avro', () => {
    const schemas = wasm.getAvroSchemas();
    const schema = schemas.TestV1.schema;
    const type = avro.Type.forSchema(schema);
    const ser = type.toBuffer({
      a: 27,
      b: 'foo',
      c: 32,
    });
    const binary = wasm.avroTest(ser);
    const val = type.fromBuffer(Buffer.from(binary), undefined, false);
    console.log({ val });
  });
});
