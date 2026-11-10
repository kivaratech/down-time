import React, { useRef } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const SNAP_MS = 180;

// Furthest the image may be dragged along one axis at a given zoom: half of
// the overflow, so an edge of the zoomed image can reach the viewport edge but
// never pull past it. At 1x there is no overflow and the image stays centred.
function clampOffset(offset: number, scale: number, viewportSize: number): number {
  "worklet";
  const limit = Math.max(0, (viewportSize * (scale - 1)) / 2);
  return Math.min(limit, Math.max(-limit, offset));
}

type Props = {
  source: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  /** Fired on a single tap while the image is not zoomed (e.g. to dismiss). */
  onSingleTap?: () => void;
};

/**
 * An image that fills its container and can be zoomed:
 *  - pinch to zoom in/out around the fingers (1x–5x),
 *  - drag to move around while zoomed,
 *  - double-tap to zoom in on a spot, double-tap again to reset.
 *
 * Must be rendered inside a GestureHandlerRootView. A React Native <Modal> is
 * a separate native root, so a modal needs its own GestureHandlerRootView
 * around this component — the one in app/_layout.tsx does not reach into it.
 *
 * Shared values are read/written with .get()/.set() (not .value) to stay
 * compatible with the React Compiler, which this app has enabled.
 */
export default function ZoomableImage({ source, style, onSingleTap }: Props) {
  const viewportRef = useRef<View>(null);
  const viewportW = useSharedValue(0);
  const viewportH = useSharedValue(0);
  // Where the viewport sits in the window. Only used on web: there the gesture
  // library reports the pinch focal point in window coordinates, while iOS and
  // Android report it relative to this view (so these stay 0 on native).
  const windowX = useSharedValue(0);
  const windowY = useSharedValue(0);

  const scale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);

  // Snapshot taken when a pinch starts; updates are computed from it so the
  // image tracks the fingers exactly instead of accumulating rounding drift.
  const startScale = useSharedValue(1);
  const startOffsetX = useSharedValue(0);
  const startOffsetY = useSharedValue(0);
  const startFocalX = useSharedValue(0);
  const startFocalY = useSharedValue(0);
  // True while two fingers are pinching. The one-finger drag stands down for
  // that stretch so the two gestures never write the offset in the same frame.
  const pinching = useSharedValue(false);

  function onLayout(e: LayoutChangeEvent) {
    viewportW.set(e.nativeEvent.layout.width);
    viewportH.set(e.nativeEvent.layout.height);
    if (Platform.OS === "web") {
      viewportRef.current?.measureInWindow((x, y) => {
        windowX.set(x);
        windowY.set(y);
      });
    }
  }

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      pinching.set(true);
      startScale.set(scale.get());
      startOffsetX.set(offsetX.get());
      startOffsetY.set(offsetY.get());
      // Focal point measured from the viewport centre, which is the origin
      // the scale transform is applied around.
      startFocalX.set(e.focalX - windowX.get() - viewportW.get() / 2);
      startFocalY.set(e.focalY - windowY.get() - viewportH.get() / 2);
    })
    .onUpdate((e) => {
      // When one finger lifts, the reported focal point jumps to the finger
      // that is still down. Ignore those frames or the image would lurch.
      if (e.numberOfPointers < 2) return;

      const from = startScale.get();
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, from * e.scale));
      const ratio = next / from;
      const focalX = e.focalX - windowX.get() - viewportW.get() / 2;
      const focalY = e.focalY - windowY.get() - viewportH.get() / 2;

      // Keep the spot of the photo that was under the fingers at the start
      // under the fingers now (this also lets a two-finger drag move it).
      const nextX = focalX - ratio * (startFocalX.get() - startOffsetX.get());
      const nextY = focalY - ratio * (startFocalY.get() - startOffsetY.get());

      scale.set(next);
      offsetX.set(clampOffset(nextX, next, viewportW.get()));
      offsetY.set(clampOffset(nextY, next, viewportH.get()));
    })
    .onEnd(() => {
      // Close enough to unzoomed: settle exactly at 1x, centred.
      if (scale.get() < MIN_SCALE + 0.05) {
        scale.set(withTiming(MIN_SCALE, { duration: SNAP_MS }));
        offsetX.set(withTiming(0, { duration: SNAP_MS }));
        offsetY.set(withTiming(0, { duration: SNAP_MS }));
      }
    })
    .onFinalize(() => {
      pinching.set(false);
    });

  const pan = Gesture.Pan()
    // One finger only — with two fingers down the pinch handles movement.
    .maxPointers(1)
    // Applies each frame's movement (changeX/Y) rather than the total since
    // touch-down, so a drag that overlaps a pinch picks up from wherever the
    // pinch left the image instead of snapping back to a stale start point.
    .onChange((e) => {
      const current = scale.get();
      if (pinching.get() || current <= MIN_SCALE) return;
      offsetX.set(clampOffset(offsetX.get() + e.changeX, current, viewportW.get()));
      offsetY.set(clampOffset(offsetY.get() + e.changeY, current, viewportH.get()));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    // The single tap below can't fire until this window has passed without a
    // second tap, so keep it short (default is 500ms) or dismissing feels laggy.
    .maxDelay(250)
    .onEnd((e, success) => {
      if (!success) return;
      if (scale.get() > MIN_SCALE) {
        scale.set(withTiming(MIN_SCALE, { duration: SNAP_MS }));
        offsetX.set(withTiming(0, { duration: SNAP_MS }));
        offsetY.set(withTiming(0, { duration: SNAP_MS }));
        return;
      }
      // Zoom in on the tapped spot: starting from 1x/centred, the point at
      // `tap` (measured from the centre) stays put when offset = tap * (1 - s).
      const tapX = e.x - viewportW.get() / 2;
      const tapY = e.y - viewportH.get() / 2;
      const targetX = clampOffset(tapX * (1 - DOUBLE_TAP_SCALE), DOUBLE_TAP_SCALE, viewportW.get());
      const targetY = clampOffset(tapY * (1 - DOUBLE_TAP_SCALE), DOUBLE_TAP_SCALE, viewportH.get());
      scale.set(withTiming(DOUBLE_TAP_SCALE, { duration: SNAP_MS }));
      offsetX.set(withTiming(targetX, { duration: SNAP_MS }));
      offsetY.set(withTiming(targetY, { duration: SNAP_MS }));
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    // Runs on the JS thread so it can call the React callback directly.
    .runOnJS(true)
    .onEnd((_e, success) => {
      if (success && scale.get() <= MIN_SCALE) onSingleTap?.();
    });

  // Pinch and drag may run together; a tap only counts if neither took over.
  // Exclusive makes the single tap wait until a double tap has been ruled out.
  const gesture = Gesture.Race(
    Gesture.Simultaneous(pinch, pan),
    Gesture.Exclusive(doubleTap, singleTap),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.get() },
      { translateY: offsetY.get() },
      { scale: scale.get() },
    ],
  }));

  return (
    <View ref={viewportRef} style={[styles.viewport, style]} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        {/* The detector sits on a fixed, untransformed layer the size of the
            viewport, so focal and tap coordinates are always in viewport
            space whatever the zoom. Only the layer inside it is transformed. */}
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
            <Image source={source} style={styles.image} resizeMode="contain" />
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    alignSelf: "stretch",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
