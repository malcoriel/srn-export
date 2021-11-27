export const suppressEvent = (e: any) => {
  if (e && e.preventDefault) {
    try {
      e.preventDefault.call(e);
    } catch (e) {
      console.error(e);
    }
  }

  if (e && e.stopPropagation) {
    try {
      e.stopPropagation.call(e);
    } catch (e) {
      console.error(e);
    }
  }

  if (e && e.sourceEvent) {
    const prevDef = e.sourceEvent.preventDefault;
    const stopProp = e.sourceEvent.stopPropagation;
    if (prevDef) {
      try {
        prevDef.call(e.sourceEvent);
      } catch (e) {
        console.error(e);
      }
    }
    if (stopProp) {
      try {
        stopProp.call(e.sourceEvent);
      } catch (e) {
        console.error(e);
      }
    }
  }
};
