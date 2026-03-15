import { describe, it, expect, beforeEach } from 'vitest'
import { useQueue } from '~/composables/useQueue'

describe('useQueue', () => {
  let queue: ReturnType<typeof useQueue<string>>

  beforeEach(() => {
    queue = useQueue<string>()
  })

  describe('initial state', () => {
    it('should start with empty queue', () => {
      expect(queue.isEmpty.value).toBe(true)
      expect(queue.size.value).toBe(0)
      expect(queue.items.value).toEqual([])
    })

    it('should not be processing initially', () => {
      expect(queue.isProcessing.value).toBe(false)
    })
  })

  describe('enqueue', () => {
    it('should add item to queue', () => {
      const id = queue.enqueue('test-item')
      
      expect(queue.size.value).toBe(1)
      expect(queue.isEmpty.value).toBe(false)
      expect(typeof id).toBe('string')
    })

    it('should add multiple items', () => {
      queue.enqueue('item-1')
      queue.enqueue('item-2')
      queue.enqueue('item-3')
      
      expect(queue.size.value).toBe(3)
    })

    it('should respect priority order', () => {
      queue.enqueue('low-priority', 1)
      queue.enqueue('high-priority', 10)
      queue.enqueue('medium-priority', 5)
      
      const items = queue.items.value
      expect(items[0].data).toBe('high-priority')
      expect(items[1].data).toBe('medium-priority')
      expect(items[2].data).toBe('low-priority')
    })

    it('should return unique ids', () => {
      const id1 = queue.enqueue('item-1')
      const id2 = queue.enqueue('item-2')
      
      expect(id1).not.toBe(id2)
    })
  })

  describe('dequeue', () => {
    it('should return undefined when queue is empty', () => {
      const item = queue.dequeue()
      expect(item).toBeUndefined()
    })

    it('should remove and return first item', () => {
      queue.enqueue('first')
      queue.enqueue('second')
      
      const item = queue.dequeue()
      
      expect(item?.data).toBe('first')
      expect(queue.size.value).toBe(1)
    })

    it('should dequeue in priority order', () => {
      queue.enqueue('low', 1)
      queue.enqueue('high', 10)
      
      const item = queue.dequeue()
      expect(item?.data).toBe('high')
    })
  })

  describe('peek', () => {
    it('should return undefined when queue is empty', () => {
      const item = queue.peek()
      expect(item).toBeUndefined()
    })

    it('should return first item without removing it', () => {
      queue.enqueue('first')
      queue.enqueue('second')
      
      const item = queue.peek()
      
      expect(item?.data).toBe('first')
      expect(queue.size.value).toBe(2)
    })
  })

  describe('remove', () => {
    it('should return false when item not found', () => {
      const result = queue.remove('non-existent-id')
      expect(result).toBe(false)
    })

    it('should remove item by id and return true', () => {
      const id = queue.enqueue('item-to-remove')
      
      const result = queue.remove(id)
      
      expect(result).toBe(true)
      expect(queue.size.value).toBe(0)
    })

    it('should only remove specific item', () => {
      const id1 = queue.enqueue('item-1')
      queue.enqueue('item-2')
      
      queue.remove(id1)
      
      expect(queue.size.value).toBe(1)
      expect(queue.items.value[0].data).toBe('item-2')
    })
  })

  describe('clear', () => {
    it('should remove all items', () => {
      queue.enqueue('item-1')
      queue.enqueue('item-2')
      queue.enqueue('item-3')
      
      queue.clear()
      
      expect(queue.size.value).toBe(0)
      expect(queue.isEmpty.value).toBe(true)
    })

    it('should work on empty queue', () => {
      queue.clear()
      expect(queue.size.value).toBe(0)
    })
  })
})
