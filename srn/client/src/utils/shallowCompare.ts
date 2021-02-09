export function shallowEqual(
  newObj: Record<string, any>,
  prevObj: Record<string, any>
): boolean {
  if (!newObj && !prevObj) {
    return true;
  }
  if (!newObj && prevObj) {
    return false;
  }
  if (newObj && !prevObj) {
    return false;
  }
  for (const key of Object.keys(newObj)) {
    if (newObj[key] !== prevObj[key]) return false;
  }
  return true;
}
