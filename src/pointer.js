// Pointer capture throws if the pointer is already gone (e.g. a very quick tap); ignore that.
export function capture(e) {
  try {
    e.currentTarget.setPointerCapture?.(e.pointerId)
  } catch {
    // not capturable; dragging still works while the pointer stays over the element
  }
}