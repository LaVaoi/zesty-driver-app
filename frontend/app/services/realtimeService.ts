import AsyncStorage from '@react-native-async-storage/async-storage';

// Real-time service using optimized polling
class RealtimeService {
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private callbacks: Map<string, Set<Function>> = new Map();
  private isActive = false;

  // Subscribe to real-time updates
  subscribe(key: string, callback: Function, interval: number = 5000) {
    if (!this.callbacks.has(key)) {
      this.callbacks.set(key, new Set());
    }
    this.callbacks.get(key)!.add(callback);

    // Start polling if not already started
    if (!this.intervals.has(key)) {
      this.startPolling(key, interval);
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(key, callback);
    };
  }

  // Unsubscribe from updates
  unsubscribe(key: string, callback: Function) {
    const callbacks = this.callbacks.get(key);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.stopPolling(key);
      }
    }
  }

  // Start polling for a specific key
  private startPolling(key: string, interval: number) {
    if (this.intervals.has(key)) {
      return;
    }

    const poll = async () => {
      if (!this.isActive) return;

      const callbacks = this.callbacks.get(key);
      if (!callbacks || callbacks.size === 0) {
        this.stopPolling(key);
        return;
      }

      // Execute all callbacks
      callbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error(`Error in realtime callback for ${key}:`, error);
        }
      });
    };

    // Poll immediately, then at interval
    poll();
    const intervalId = setInterval(poll, interval);
    this.intervals.set(key, intervalId);
  }

  // Stop polling for a specific key
  private stopPolling(key: string) {
    const intervalId = this.intervals.get(key);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(key);
    }
    this.callbacks.delete(key);
  }

  // Activate service
  activate() {
    this.isActive = true;
  }

  // Deactivate service
  deactivate() {
    this.isActive = false;
    // Clear all intervals
    this.intervals.forEach(intervalId => clearInterval(intervalId));
    this.intervals.clear();
    this.callbacks.clear();
  }

  // Manual trigger for immediate update
  trigger(key: string) {
    const callbacks = this.callbacks.get(key);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error(`Error in manual trigger for ${key}:`, error);
        }
      });
    }
  }
}

export const realtimeService = new RealtimeService();

