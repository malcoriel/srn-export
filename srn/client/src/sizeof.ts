import { UnreachableCaseError } from 'ts-essentials';

export const sizeOf = (obj: any) => {
  let bytes = 0;
  if (obj !== null && obj !== undefined) {
    const type = typeof obj;
    switch (type) {
      case 'undefined':
        bytes += 0;
        break;
      case 'number':
        bytes += 8;
        break;
      case 'string':
        bytes += obj.length * 2;
        break;
      case 'function':
        break;
      case 'symbol':
        break;
      case 'bigint':
        break;
      case 'boolean':
        bytes += 4;
        break;
      case 'object': {
        const objClass = Object.prototype.toString.call(obj).slice(8, -1);
        if (objClass === 'Object' || objClass === 'Array') {
          // eslint-disable-next-line no-restricted-syntax
          for (const key in obj) {
            // eslint-disable-next-line no-prototype-builtins
            if (!obj.hasOwnProperty(key)) continue;
            sizeOf(obj[key]);
          }
        } else bytes += obj.toString().length * 2;
        break;
      }
      default:
        throw new UnreachableCaseError(type);
    }
  }
  return bytes;
};
