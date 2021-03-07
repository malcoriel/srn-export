import { useState } from 'react';

const NAMESPACE = 'SRN-v1';

const makeLSKey = (key: string) => `${NAMESPACE}_${key}`;

const setLSValueImpl = <T>(key: string, valueToStore: T) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(valueToStore));
  } catch (e) {
    console.warn(`ls set failure for key ${key}`, e);
  }
};

const extractLSValueImpl = <T>(key: string, initialValue: T) => {
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  } catch (error) {
    console.warn(`ls get failure for key ${key}`, error);
    return initialValue;
  }
};

export const extractLSValue = <T>(key: string, initialValue: T): T => {
  return extractLSValueImpl(makeLSKey(key), initialValue);
};

export const setLSValue = <T>(key: string, valueToStore: T) => {
  setLSValueImpl(makeLSKey(key), valueToStore);
};

export const deleteLSValue = (key: string) => {
  localStorage.removeItem(makeLSKey(key));
};

// https://usehooks.com/useLocalStorage/
export const useLocalStorage = <T>(
  itemKey: string,
  initialValue: T
): [T, (val: T) => void] => {
  const key = makeLSKey(itemKey);
  const [storedValue, setStoredValue] = useState<T>(() => {
    return extractLSValueImpl(key, initialValue);
  });

  const setValue = (value: T | null) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      setLSValueImpl(key, valueToStore);
    } catch (error) {
      console.log(`ls set failure for key ${key}`, error);
    }
  };

  return [storedValue, setValue];
};
