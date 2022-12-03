import _ from 'lodash';

export const compare = function (a: any, b: any) {
  const result = {
    different: [],
    missing_from_first: [],
    missing_from_second: [],
  };

  if (!_.isObject(a) || !_.isObject(b)) {
    return result;
  }

  _.reduce(
    a,
    (result, value, key) => {
      // eslint-disable-next-line no-prototype-builtins
      if (b.hasOwnProperty(key)) {
        // @ts-ignore
        if (_.isEqual(value, b[key])) {
          return result;
        }
        // @ts-ignore
        if (typeof a[key] !== typeof {} || typeof b[key] !== typeof {}) {
          //dead end.
          // @ts-ignore
          result.different.push(key);
          return result;
        }
        // @ts-ignore
        const deeper = compare(a[key], b[key]);
        result.different = result.different.concat(
          // @ts-ignore
          _.map(deeper.different, (sub_path) => {
            return `${key}.${sub_path}`;
          })
        );

        result.missing_from_second = result.missing_from_second.concat(
          // @ts-ignore
          _.map(deeper.missing_from_second, (sub_path) => {
            return `${key}.${sub_path}`;
          })
        );

        result.missing_from_first = result.missing_from_first.concat(
          // @ts-ignore
          _.map(deeper.missing_from_first, (sub_path) => {
            return `${key}.${sub_path}`;
          })
        );
        return result;
      }
      // @ts-ignore
      result.missing_from_second.push(key);
      return result;
    },
    result
  );

  _.reduce(
    b,
    (result, value, key) => {
      // eslint-disable-next-line no-prototype-builtins
      if (a.hasOwnProperty(key)) {
        return result;
      }
      // @ts-ignore
      result.missing_from_first.push(key);
      return result;
    },
    result
  );

  return result;
};
