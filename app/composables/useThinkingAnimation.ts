import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { Ref } from 'vue';

const THINKING_FRAMES = ['', '.', '..', '...'];

export function useThinkingAnimation(isThinking: Ref<boolean>, busyDescendantLabels: Ref<string[]>) {
  const thinkingIndex = ref(0);
  const thinkingSuffix = ref('');
  let thinkingTimer: number | undefined;

  const thinkingDisplayText = computed(() => {
    const labels = busyDescendantLabels.value;
    if (!isThinking.value) {
      if (labels.length === 0) return '\u{1F7E2} Idle';
      const list = labels.slice(0, 5).join(', ');
      const overflow = labels.length > 5 ? ` +${labels.length - 5}` : '';
      return `\u{1F7E2} Idle \u{00b7} \u{1F916} ${list}${overflow}`;
    }
    const total = Math.max(1, 1 + labels.length);
    const heads = '\u{1F914}'.repeat(Math.min(total, 8));
    if (labels.length === 0) return `${heads} Thinking${thinkingSuffix.value}`;
    const list = labels.slice(0, 5).join(', ');
    const overflow = labels.length > 5 ? ` +${labels.length - 5}` : '';
    return `${heads} Thinking${thinkingSuffix.value} \u{00b7} ${list}${overflow}`;
  });

  watch(
    isThinking,
    (active) => {
      if (!active) {
        if (thinkingTimer !== undefined) {
          window.clearInterval(thinkingTimer);
          thinkingTimer = undefined;
        }
        thinkingIndex.value = 0;
        thinkingSuffix.value = '';
        return;
      }

      thinkingIndex.value = 0;
      thinkingSuffix.value = THINKING_FRAMES[thinkingIndex.value] ?? '';
      if (thinkingTimer !== undefined) window.clearInterval(thinkingTimer);
      thinkingTimer = window.setInterval(() => {
        thinkingIndex.value = (thinkingIndex.value + 1) % THINKING_FRAMES.length;
        thinkingSuffix.value = THINKING_FRAMES[thinkingIndex.value] ?? '';
      }, 350);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    if (thinkingTimer !== undefined) {
      window.clearInterval(thinkingTimer);
    }
  });

  return {
    thinkingDisplayText,
  };
}
