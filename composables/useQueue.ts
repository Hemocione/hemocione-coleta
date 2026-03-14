import { ref, computed } from 'vue'

export interface QueueItem<T> {
  id: string
  data: T
  priority: number
}

export function useQueue<T>() {
  const items = ref<QueueItem<T>[]>([])
  const isProcessing = ref(false)

  const size = computed(() => items.value.length)
  const isEmpty = computed(() => items.value.length === 0)

  function enqueue(data: T, priority = 0): string {
    const id = Math.random().toString(36).substring(2, 9)
    const item: QueueItem<T> = { id, data, priority }
    
    // Insert based on priority (higher priority = earlier in queue)
    const insertIndex = items.value.findIndex(i => i.priority < priority)
    if (insertIndex === -1) {
      items.value.push(item)
    } else {
      items.value.splice(insertIndex, 0, item)
    }
    
    return id
  }

  function dequeue(): QueueItem<T> | undefined {
    if (items.value.length === 0) return undefined
    return items.value.shift()
  }

  function remove(id: string): boolean {
    const index = items.value.findIndex(item => item.id === id)
    if (index === -1) return false
    items.value.splice(index, 1)
    return true
  }

  function clear(): void {
    items.value = []
  }

  function peek(): QueueItem<T> | undefined {
    return items.value[0]
  }

  return {
    items,
    size,
    isEmpty,
    isProcessing,
    enqueue,
    dequeue,
    remove,
    clear,
    peek,
  }
}
