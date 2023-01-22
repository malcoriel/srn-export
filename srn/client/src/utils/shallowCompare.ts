export function shallowEqual(
  newProps: Record<string, any>,
  prevProps: Record<string, any>
): boolean {
  if (!newProps && !prevProps) {
    return true;
  }
  if (!newProps && prevProps) {
    return false;
  }
  if (newProps && !prevProps) {
    return false;
  }
  for (const key of Object.keys(newProps)) {
    if (newProps[key] !== prevProps[key]) return false;
  }
  return true;
}
