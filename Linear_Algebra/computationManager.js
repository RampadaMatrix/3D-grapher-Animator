
(function(){
  class ComputationManager {
    constructor() {
      this.worker = null;
      this.pending = new Map();
      this.reqId = 1;
      this.timeoutMs = 15000; 
      
      this.globalOnProgress = null;
      this._ensureWorker();
    }

    _ensureWorker() {
      try {
        if (this.worker) return; 
        this._initWorker();
      } catch (e) {
        console.error('Failed to initialize worker:', e);
      }
    }

    _initWorker() {
      this.worker = new Worker('worker.js');
      this.worker.onmessage = (e) => {
        const { __id, type, result, error, progress } = e.data || {};
        if (!__id) {
          console.warn('[worker<-main] received message without __id:', e.data);
          return;
        }
        if (!this.pending.has(__id)) {
          console.warn(`[worker<-main] unknown or stale id #${__id}; possibly timed out/canceled.`, e.data);
          return;
        }
        const entry = this.pending.get(__id);
        const now = (performance && performance.now ? performance.now() : Date.now());

        
        if (progress) {
          const { timer, startedAt, deadlineAt, type: pendingType, onProgress } = entry;
          const remainingToDeadline = (deadlineAt || (startedAt + this.timeoutMs)) - now;
          if (remainingToDeadline <= 0) {
            
            clearTimeout(timer);
            this.pending.delete(__id);
            console.warn(`[worker timeout] #${__id} ${pendingType} exceeded hard deadline`);
            try { entry.reject(new Error(`Worker timeout (deadline) for ${pendingType}`)); } catch(_) {}
            this._restartWorker(`deadline timeout on ${pendingType} (#${__id})`);
            return;
          }
          const extendMs = Math.max(100, Math.min(this.timeoutMs, remainingToDeadline));
          clearTimeout(timer);
          entry.timer = setTimeout(() => {
            this.pending.delete(__id);
            console.warn(`[worker timeout] #${__id} ${pendingType} exceeded ${extendMs}ms window (deadline in ${(remainingToDeadline/1000).toFixed(1)}s)`);
            try { entry.reject(new Error(`Worker timeout for ${pendingType}`)); } catch(_) {}
            this._restartWorker(`timeout on ${pendingType} (#${__id})`);
          }, extendMs);
          this.pending.set(__id, entry);
          try { console.debug(`[worker progress] #${__id} ${type}`, progress); } catch(_) {}
          if (typeof onProgress === 'function') {
            try { onProgress(progress); } catch(_) {}
          }
          return; 
        }

        
        const { resolve, reject, timer, startedAt, type: pendingType } = entry;
        clearTimeout(timer);
        this.pending.delete(__id);
        const dur = now - (startedAt || 0);
        if (error) {
          console.debug(`[worker<-main] #${__id} ${pendingType} errored after ${dur.toFixed(1)}ms:`, error);
          reject(new Error(error));
        } else {
          console.debug(`[worker<-main] #${__id} ${pendingType} completed in ${dur.toFixed(1)}ms`);
          resolve({ type, result });
        }
      };
      this.worker.onerror = (err) => {
        console.error('[worker error]', err);
        this._restartWorker('worker error');
      };
      this.worker.onmessageerror = (err) => {
        console.error('[worker messageerror]', err);
        this._restartWorker('messageerror');
      };
    }

    _restartWorker(reason = 'restart') {
      try {
        if (this.worker) {
          this.worker.terminate();
        }
      } catch (_) {}
      this.worker = null;
      const error = new Error(`Worker restarted: ${reason}`);
      this._rejectAllPending(error);
      
      try {
        this._initWorker();
        console.warn('[worker] restarted due to:', reason);
      } catch (e) {
        console.error('Failed to restart worker:', e);
      }
    }

    _send(type, payload, opts = {}) {
      if (!this.worker) return Promise.reject(new Error('Worker not available'));
      const id = this.reqId++;
      return new Promise((resolve, reject) => {
        const startedAt = (performance && performance.now ? performance.now() : Date.now());
        const maxTotalMs = Number.isFinite(opts.maxTotalMs) && opts.maxTotalMs > 0 ? opts.maxTotalMs : (this.timeoutMs * 4);
        const deadlineAt = startedAt + maxTotalMs;
        const onProgress = (typeof opts.onProgress === 'function') ? opts.onProgress : (typeof this.globalOnProgress === 'function' ? this.globalOnProgress : null);
        const timer = setTimeout(() => {
          this.pending.delete(id);
          console.warn(`[worker timeout] #${id} ${type} exceeded ${this.timeoutMs}ms`);
          try { reject(new Error(`Worker timeout for ${type}`)); } catch(_) {}
          
          this._restartWorker(`timeout on ${type} (#${id})`);
        }, this.timeoutMs);
        this.pending.set(id, { resolve, reject, timer, startedAt, type, deadlineAt, onProgress });
        console.debug(`[main->worker] #${id} ${type}`, payload && Object.keys(payload));
        this.worker.postMessage({ __id: id, type, ...payload });
      });
    }

    
    setOnProgress(cb) {
      if (cb == null || typeof cb === 'function') {
        this.globalOnProgress = cb || null;
      }
    }

    setTimeoutMs(ms) {
      const n = Number(ms);
      if (Number.isFinite(n) && n > 0) this.timeoutMs = n;
    }

    cancelAll(label = 'canceled') {
      
      this._restartWorker(label || 'canceled');
    }

    _rejectAllPending(error) {
      this.pending.forEach(({ reject, timer, type }, id) => {
        clearTimeout(timer);
        try { reject(error); } catch(_) {}
        console.warn(`[worker cancel] #${id} ${type}: ${error.message}`);
      });
      this.pending.clear();
    }

    
    ref(matrix, opts) { return this._send('ref', { matrix }, opts).then(r => r.result); }
    rref(matrix, opts) { return this._send('rref', { matrix }, opts).then(r => r.result); }
    determinant(matrix, opts) { return this._send('determinant', { matrix }, opts).then(r => r.result); }
    inverse(matrix, opts) { return this._send('inverse', { matrix }, opts).then(r => r.result); }
    eigenvalues(matrix, opts) { return this._send('eigenvalues', { matrix }, opts).then(r => r.result); }
    lu(matrix, opts) { return this._send('lu', { matrix }, opts).then(r => r.result); }
    qr(matrix, opts) { return this._send('qr', { matrix }, opts).then(r => r.result); }
    transform(matrix, vectors, opts) { return this._send('transform', { matrix, vectors }, opts).then(r => r.result); }
    solve(matrix, vector, opts) { return this._send('solve', { matrix, vector }, opts).then(r => r.result); }
  }

  
  window.computationManager = new ComputationManager();
})();
