<template>
  <div
    class="image-viewer-root"
    :class="{ 'is-dragging': isDragging }"
    @wheel.prevent="handleWheel"
    @dblclick.prevent="resetView"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerUp"
  >
    <div class="image-wrapper" :style="wrapperStyle">
      <img
        :src="src"
        :alt="alt"
        class="image-content"
        draggable="false"
        @error="handleError"
        @load="handleLoad"
      />
    </div>
    <div v-if="error" class="error-message">
      Failed to load image
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  src: string;
  alt?: string;
}>();

const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
const isDragging = ref(false);
const error = ref(false);

const startX = ref(0);
const startY = ref(0);
const lastX = ref(0);
const lastY = ref(0);

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

const wrapperStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
}));

function handleWheel(e: WheelEvent) {
  const delta = -Math.sign(e.deltaY) * 0.1;
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale.value + delta * scale.value));
  
  // Calculate cursor position relative to the image center to zoom towards cursor
  // This is a simplified version, keeping zoom centered for now to avoid complexity with offset calculation
  // relative to the transformed element without getting bounding client rects constantly.
  // For a robust implementation we would need getBoundingClientRect().
  
  // Let's implement cursor-centered zoom properly:
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Center of container
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  
  // Cursor offset from center
  const dx = x - cx;
  const dy = y - cy;
  
  // Adjust translate to keep the point under cursor stable
  // old_pos = (point - translate) / old_scale
  // new_pos = (point - new_translate) / new_scale
  // we want old_pos == new_pos => (point - translate) / old_scale = (point - new_translate) / new_scale
  // point - new_translate = (point - translate) * (new_scale / old_scale)
  // new_translate = point - (point - translate) * (new_scale / old_scale)
  
  // Here point is (dx, dy) relative to center, and translate is (translateX, translateY)
  translateX.value = dx - (dx - translateX.value) * (newScale / scale.value);
  translateY.value = dy - (dy - translateY.value) * (newScale / scale.value);
  
  scale.value = newScale;
}

function handlePointerDown(e: PointerEvent) {
  isDragging.value = true;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  startX.value = e.clientX;
  startY.value = e.clientY;
  lastX.value = translateX.value;
  lastY.value = translateY.value;
}

function handlePointerMove(e: PointerEvent) {
  if (!isDragging.value) return;
  const dx = e.clientX - startX.value;
  const dy = e.clientY - startY.value;
  translateX.value = lastX.value + dx;
  translateY.value = lastY.value + dy;
}

function handlePointerUp(e: PointerEvent) {
  isDragging.value = false;
  (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
}

function resetView() {
  scale.value = 1;
  translateX.value = 0;
  translateY.value = 0;
}

function handleError() {
  error.value = true;
}

function handleLoad() {
  error.value = false;
}
</script>

<style scoped>
.image-viewer-root {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background: #0f172a;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.image-viewer-root.is-dragging {
  cursor: grabbing;
}

.image-wrapper {
  transform-origin: 50% 50%; /* Zoom from center context */
  will-change: transform;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-content {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  pointer-events: none; /* Let pointer events pass to container for drag */
  user-select: none;
}

.error-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #f87171;
  background: rgba(0, 0, 0, 0.7);
  padding: 8px 16px;
  border-radius: 4px;
}
</style>
