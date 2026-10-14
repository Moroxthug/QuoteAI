// Large text (Settings → Display → Text size, times the phone's own font size): above this many times the design's size three columns of figures no longer fit a phone, so they stack.
export const STACK_AT = 1.4;

/** What the words are really drawn at: the app's text size choice times the system font scale. */
export const effectiveScale = (textScale: number, fontScale: number): number => textScale * (fontScale > 0 ? fontScale : 1);

export const stacksAt = (scale: number): boolean => scale >= STACK_AT;
