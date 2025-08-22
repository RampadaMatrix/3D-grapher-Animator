self.performanceNow = function() { return (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()); };
self.makeProgressReporter = function(id, type, minIntervalMs = 200) {
    let last = 0;
    return function(stage, meta) {
        const now = self.performanceNow();
        if (now - last < minIntervalMs) return;
        last = now;
        try {
            self.postMessage({ __id: id, type, progress: { stage, ...(meta || {}), ts: now } });
        } catch (_) {}
    };
};


self.addEventListener('message', function(e) {
    const { __id, type, matrix, vectors, vector } = e.data || {};
    const t0 = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
    if (__id == null) {
        try { console.warn('[worker] received message without __id:', e.data); } catch(_) {}
        return;
    }
    try { console.debug(`[worker] start #${__id} ${type}`); } catch(_) {}

    try {
        let result;
        const progress = self.makeProgressReporter(__id, type);
        
        switch(type) {
            case 'ref':
                result = computeREF(matrix, { progress });
                break;
                
            case 'rref':
                result = computeRREF(matrix, { progress });
                break;
                
            case 'determinant':
                result = calculateDeterminant(matrix, { progress });
                break;
                
            case 'inverse':
                result = calculateInverse(matrix, { progress });
                break;
                
            case 'eigenvalues':
                result = calculateEigenvalues(matrix, { progress });
                break;
                
            case 'lu':
                result = luDecomposition(matrix, { progress });
                break;
                
            case 'qr':
                result = qrDecomposition(matrix, { progress });
                break;
                
            case 'transform':
                result = { vectors: transformVectors(matrix, vectors) };
                break;
            
            case 'solve':
                result = solveLinearSystem(matrix, vector, { progress });
                break;
                
            default:
                throw new Error('Unknown operation type: ' + type);
        }
        
        const dt = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - t0;
        try { console.debug(`[worker] done  #${__id} ${type} in ${dt.toFixed ? dt.toFixed(1) : dt}ms`); } catch(_) {}
        self.postMessage({ __id, type, result });
        
    } catch (error) {
        const dt = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - t0;
        try { console.debug(`[worker] fail  #${__id} ${type} after ${dt.toFixed ? dt.toFixed(1) : dt}ms: ${error && error.message}`); } catch(_) {}
        self.postMessage({ 
            __id,
            type, 
            error: (error && error.message) ? error.message : String(error)
        });
    }
});


self.addEventListener('error', (err) => {
    try { console.error('[worker][error]', err && (err.message || err)); } catch(_) {}
});
self.addEventListener('unhandledrejection', (e) => {
    try { console.error('[worker][unhandledrejection]', e && (e.reason || e)); } catch(_) {}
});
self.addEventListener('messageerror', (e) => {
    try { console.error('[worker][messageerror]', e && (e.message || e)); } catch(_) {}
});


function transformVectors(matrix, vectors) {
    return vectors.map(v => multiplyMatrixVector(matrix, v));
}


function multiplyMatrixVector(matrix, vector) {
    const result = [];
    for (let i = 0; i < matrix.length; i++) {
        let sum = 0;
        for (let j = 0; j < vector.length; j++) {
            sum += matrix[i][j] * vector[j];
        }
        result.push(sum);
    }
    return result;
}


function computeREF(matrix, opts = {}) {
    const progress = (opts && opts.progress) || (() => {});
    const m = matrix.map(row => [...row]); 
    const rows = m.length;
    const cols = m[0].length;
    let pivot = 0;
    progress('ref:init', { rows, cols });
    
    for (let col = 0; col < cols && pivot < rows; col++) {
        
        let maxRow = pivot;
        for (let row = pivot + 1; row < rows; row++) {
            if (Math.abs(m[row][col]) > Math.abs(m[maxRow][col])) {
                maxRow = row;
            }
        }
        
        if (Math.abs(m[maxRow][col]) < 1e-10) continue;
        
        
        [m[pivot], m[maxRow]] = [m[maxRow], m[pivot]];
        
        
        for (let row = pivot + 1; row < rows; row++) {
            const factor = m[row][col] / m[pivot][col];
            for (let c = col; c < cols; c++) {
                m[row][c] -= factor * m[pivot][c];
            }
        }
        pivot++;
        progress('ref:pivot', { pivot, col });
    }
    
    return m;
}


function solveLinearSystem(A, b, opts = {}) {
    const progress = (opts && opts.progress) || (() => {});
    if (!Array.isArray(A) || A.length === 0 || !Array.isArray(A[0]) || A.length !== A[0].length) {
        throw new Error('solve expects a square matrix A');
    }
    if (!Array.isArray(b) || b.length !== A.length) {
        throw new Error('solve expects RHS vector b with length equal to rows of A');
    }
    const n = A.length;
    
    const aug = A.map((row, i) => {
        const r = row.slice();
        r.push(b[i]);
        return r;
    });
    const tol = 1e-10;
    
    for (let i = 0; i < n; i++) {
        progress('solve:col', { i, n });
        
        let pivotRow = i;
        for (let r = i + 1; r < n; r++) {
            if (Math.abs(aug[r][i]) > Math.abs(aug[pivotRow][i])) pivotRow = r;
        }
        if (Math.abs(aug[pivotRow][i]) < tol) {
            throw new Error('Matrix is singular or ill-conditioned');
        }
        if (pivotRow !== i) {
            [aug[i], aug[pivotRow]] = [aug[pivotRow], aug[i]];
        }
        
        const pv = aug[i][i];
        for (let j = i; j <= n; j++) aug[i][j] /= pv;
        
        for (let r = i + 1; r < n; r++) {
            const factor = aug[r][i];
            if (Math.abs(factor) < tol) continue;
            for (let j = i; j <= n; j++) aug[r][j] -= factor * aug[i][j];
        }
    }
    
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j < n; j++) sum += aug[i][j] * x[j];
        x[i] = aug[i][n] - sum;
    }
    return x;
}


function computeRREF(matrix, opts = {}) {
    const progress = (opts && opts.progress) || (() => {});
    const m = computeREF(matrix, { progress });
    const rows = m.length;
    const cols = m[0].length;
    progress('rref:init', { rows, cols });
    
    for (let row = rows - 1; row >= 0; row--) {
        
        let pivotCol = -1;
        for (let col = 0; col < cols; col++) {
            if (Math.abs(m[row][col]) > 1e-10) {
                pivotCol = col;
                break;
            }
        }
        
        if (pivotCol === -1) continue;
        
        
        const pivotVal = m[row][pivotCol];
        for (let col = 0; col < cols; col++) {
            m[row][col] /= pivotVal;
        }
        
        
        for (let r = row - 1; r >= 0; r--) {
            const factor = m[r][pivotCol];
            for (let col = 0; col < cols; col++) {
                m[r][col] -= factor * m[row][col];
            }
        }
        progress('rref:row', { row });
    }
    
    return m;
}


function calculateDeterminant(matrix, opts = {}) {
    const progress = (opts && opts.progress) || (() => {});
    const n = matrix.length;
    
    if (n === 1) return matrix[0][0];
    
    if (n === 2) {
        return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
    }
    
    if (n === 3) {
        return matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1])
             - matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0])
             + matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);
    }
    
    
    const { L, U } = luDecomposition(matrix, { progress });
    let det = 1;
    for (let i = 0; i < n; i++) {
        det *= U[i][i];
        progress('det:diag', { i, n });
    }
    return det;
}


function calculateInverse(matrix, opts = {}) {
    const progress = (opts && opts.progress) || (() => {});
    const n = matrix.length;
    const det = calculateDeterminant(matrix, { progress });
    
    if (Math.abs(det) < 1e-10) {
        throw new Error('Matrix is singular (non-invertible)');
    }
    
    
    const aug = matrix.map((row, i) => [
        ...row,
        ...Array(n).fill(0).map((_, j) => i === j ? 1 : 0)
    ]);
    
    
    for (let i = 0; i < n; i++) {
        progress('inv:row', { i, n });
        
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
                maxRow = k;
            }
        }
        
        
        [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
        
        
        const pivot = aug[i][i];
        for (let j = 0; j < 2 * n; j++) {
            aug[i][j] /= pivot;
        }
        
        
        for (let k = 0; k < n; k++) {
            if (k !== i) {
                const factor = aug[k][i];
                for (let j = 0; j < 2 * n; j++) {
                    aug[k][j] -= factor * aug[i][j];
                }
            }
        }
    }
    
    
    return aug.map(row => row.slice(n));
}


function calculateEigenvalues(matrix, opts = {}) {
    const n = matrix.length;
    if (!Array.isArray(matrix) || n === 0 || matrix[0].length !== n) {
        throw new Error('eigenvalues expects a square matrix');
    }
    const progress = (opts && opts.progress) || (() => {});
    const maxIter = (opts && typeof opts.maxIter === 'number') ? opts.maxIter : 100;
    let A = matrix.map(row => row.slice());
    for (let iter = 0; iter < maxIter; iter++) {
        const { Q, R } = qrDecomposition(A, { progress });
        A = multiplyMatrices(R, Q);
        progress('eig:iter', { iter, maxIter });
    }
    
    return A.map((row, i) => row[i]);
}


function luDecomposition(matrix, opts = {}) {
    const progress = (opts && opts.progress) || (() => {});
    const n = matrix.length;
    const L = Array(n).fill(0).map(() => Array(n).fill(0));
    const U = Array(n).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
        progress('lu:row', { i, n });
        
        for (let k = i; k < n; k++) {
            let sum = 0;
            for (let j = 0; j < i; j++) {
                sum += L[i][j] * U[j][k];
            }
            U[i][k] = matrix[i][k] - sum;
        }
        
        
        for (let k = i; k < n; k++) {
            if (i === k) {
                L[i][i] = 1;
            } else {
                let sum = 0;
                for (let j = 0; j < i; j++) {
                    sum += L[k][j] * U[j][i];
                }
                L[k][i] = (matrix[k][i] - sum) / U[i][i];
            }
        }
    }
    
    return { L, U };
}


function qrDecomposition(matrix, opts = {}) {
    const progress = (opts && opts.progress) || (() => {});
    const m = matrix.length;
    const n = matrix[0].length;
    const R = matrix.map(row => row.slice());
    
    let Q = Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => (i === j ? 1 : 0)));

    for (let j = 0; j < Math.min(m, n); j++) {
        progress('qr:col', { j, m, n });
        
        const x = [];
        for (let i = j; i < m; i++) x.push(R[i][j]);
        const normx = Math.sqrt(x.reduce((s, v) => s + v * v, 0));
        if (normx === 0) continue;
        x[0] = x[0] >= 0 ? x[0] + normx : x[0] - normx;
        const normu = Math.sqrt(x.reduce((s, v) => s + v * v, 0));
        const u = x.map(v => v / (normu || 1));

        
        for (let col = j; col < n; col++) {
            let s = 0;
            for (let i = j; i < m; i++) s += u[i - j] * R[i][col];
            for (let i = j; i < m; i++) R[i][col] -= 2 * s * u[i - j];
        }

        
        for (let col = 0; col < m; col++) {
            let s = 0;
            for (let i = j; i < m; i++) s += u[i - j] * Q[i][col];
            for (let i = j; i < m; i++) Q[i][col] -= 2 * s * u[i - j];
        }
    }

    
    Q = transpose(Q);
    
    return { Q, R };
}


function dotProduct(a, b) {
    return a.reduce((sum, ai, i) => sum + ai * b[i], 0);
}


function multiplyMatrices(A, B) {
    const p = A.length;
    const q = A[0].length;
    const r = B[0].length;
    const C = Array.from({ length: p }, () => Array(r).fill(0));
    for (let i = 0; i < p; i++) {
        for (let k = 0; k < q; k++) {
            const aik = A[i][k];
            for (let j = 0; j < r; j++) {
                C[i][j] += aik * B[k][j];
            }
        }
    }
    return C;
}

function transpose(M) {
    const rows = M.length, cols = M[0].length;
    const T = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) T[j][i] = M[i][j];
    }
    return T;
}
