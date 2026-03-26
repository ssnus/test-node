import axios from 'axios';
import { API_URL } from '../config';


class RequestQueue {
  constructor() {
    this.queue = new Map();
    this.processing = false;
  }

  add(key, requestFn) {
    if (this.queue.has(key)) {
      return this.queue.get(key);
    }

    const promise = requestFn()
      .then(result => {
        this.queue.delete(key);
        return result;
      })
      .catch(error => {
        this.queue.delete(key);
        throw error;
      });

    this.queue.set(key, promise);
    return promise;
  }

  clear() {
    this.queue.clear();
  }

  get size() {
    return this.queue.size;
  }
}

export const mutationQueue = new RequestQueue();

export const queuedPost = async (endpoint, data, dedupeKey) => {
  return mutationQueue.add(dedupeKey, () =>
    axios.post(`${API_URL}${endpoint}`, data)
  );
};
