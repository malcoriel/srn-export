import { useState } from 'react';

const NAMESPACE = 'SRN-v1';

const makeKey = (key: string) => `${NAMESPACE}_${key}`;
// https://usehooks.com/useLocalStorage/
export const useLocalStorage = <T>(
  itemKey: string,
  initialValue: T | null
): [T | null, (val: T | null) => void] => {
  const key = makeKey(itemKey);
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`ls get failure for key ${key}`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | null) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.log(`ls set failure for key ${key}`, error);
    }
  };

  return [storedValue, setValue];
};
