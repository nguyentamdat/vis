import { ref, watch, type Ref } from 'vue';
import { StorageKeys, storageGetJSON, storageSetJSON } from '../utils/storageKeys';

function load(): string[] {
  return storageGetJSON<string[]>(StorageKeys.state.visibleProjects) ?? [];
}

function persist(ids: string[]) {
  storageSetJSON(StorageKeys.state.visibleProjects, ids);
}

export function useVisibleProjects() {
  const visibleIds: Ref<string[]> = ref(load());
  const isFilterActive = ref(visibleIds.value.length > 0);

  watch(visibleIds, (ids) => {
    isFilterActive.value = ids.length > 0;
    persist(ids);
  }, { deep: true });

  function isVisible(projectId: string): boolean {
    if (visibleIds.value.length === 0) return true;
    return visibleIds.value.includes(projectId);
  }

  function toggle(projectId: string) {
    const idx = visibleIds.value.indexOf(projectId);
    if (idx >= 0) {
      visibleIds.value.splice(idx, 1);
    } else {
      visibleIds.value.push(projectId);
    }
  }

  function showAll() {
    visibleIds.value = [];
  }

  function setVisible(ids: string[]) {
    visibleIds.value = [...ids];
  }

  return {
    visibleIds,
    isFilterActive,
    isVisible,
    toggle,
    showAll,
    setVisible,
  };
}
