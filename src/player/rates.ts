// Web Speech supports rates from 0.1 to 10; expose quarter steps in the player.
export const playbackRates = Array.from({ length: 40 }, (_, index) => (index + 1) / 4);
