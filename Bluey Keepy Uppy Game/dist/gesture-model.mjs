const ROOT = new URL('./', import.meta.url);
let loading;

// Model, JavaScript and WebAssembly are all served from this project.
export function loadGestureModel() {
  if (!loading) loading = (async () => {
    const { FilesetResolver, GestureRecognizer } = await import('./vendor/mediapipe/vision_bundle.mjs');
    const vision = await FilesetResolver.forVisionTasks(new URL('vendor/mediapipe/wasm', ROOT).href);
    const model = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: { modelAssetPath: new URL('assets/models/gesture_recognizer.task', ROOT).href, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: .5,
      minHandPresenceConfidence: .5,
      minTrackingConfidence: .5,
      cannedGesturesClassifierOptions: { maxResults: 1, scoreThreshold: .65 },
    });
    return { model };
  })().catch(error => { loading = null; throw error; });
  return loading;
}
