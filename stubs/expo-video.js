// No-op stub for expo-video — prevents Android SimpleCache duplicate-instance crash.
// This project does not use video playback.
module.exports = {
  VideoView: () => null,
  useVideoPlayer: () => ({}),
};
