import { swapGlobals, wasm } from '../util';
const avro = require('avsc');

describe('serialization-benchmark', () => {
  beforeAll(swapGlobals);
  it('can get avro data', () => {
    const binary = wasm.avroTest();
    // console.log({ binary });
    const schemas = wasm.getAvroSchemas();
    const schema = schemas.TestV1.schema;
    const type = avro.Type.forSchema(schema);
    // console.log({ schemaFields: type.schema().fields });
    const buffer = Buffer.from(binary);
    const ser = type.toBuffer({
      a: 27,
      b: 'foo',
      c: 32,
    });
    // console.log({ ser: Uint8Array.from(ser) });
    const val = type.fromBuffer(buffer, undefined, true);
    console.log({ val });
  });
});
