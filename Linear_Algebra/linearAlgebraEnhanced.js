

class LinearAlgebraEngine {
    constructor() {
        this.precision = 6; 
        this.tolerance = 1e-10; 
    }

    
    scalarMultiplyMatrix(scalar, matrix) {
        return matrix.map(row => row.map(val => val * scalar));
    }

    scalarDivideMatrix(matrix, scalar) {
        if (Math.abs(scalar) < this.tolerance) {
            throw new Error("Division by zero.");
        }
        return matrix.map(row => row.map(val => val / scalar));
    }

    
    determinant(matrix) {
        const n = matrix.length;
        if (n === 0 || n !== matrix[0].length) {
            throw new Error("Determinant requires a square matrix.");
        }

        if (n === 1) return matrix[0][0];
        if (n === 2) return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
        if (n === 3) {
            return (
                matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
                matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
                matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0])
            );
        }
        return 0;
    }

    qrDecomposition(matrix) {
        const m = matrix.length;
        const n = matrix[0].length;
        const Q = Array(m).fill().map(() => Array(n).fill(0));
        const R = Array(n).fill().map(() => Array(n).fill(0));
        
        const cols = this.transpose(matrix);

        for (let j = 0; j < n; j++) {
            let v = cols[j];
            for (let i = 0; i < j; i++) {
                const qi = this.transpose(Q)[i];
                const rij = this.dotProduct(qi, v);
                R[i][j] = rij;
                v = v.map((val, k) => val - rij * qi[k]);
            }
            const norm = Math.sqrt(this.dotProduct(v, v));
            R[j][j] = norm;
            if (norm > this.tolerance) {
                const qj = v.map(val => val / norm);
                for (let i = 0; i < m; i++) {
                    Q[i][j] = qj[i];
                }
            }
        }
        return { Q, R };
    }
    
    eigenDecomposition(matrix, maxIterations = 100) {
        const n = matrix.length;
        if (n !== matrix[0].length) throw new Error("Eigen decomposition requires a square matrix.");
        
        let A = matrix.map(row => [...row]);
        let Q_total = this.identityMatrix(n);
        
        for (let iter = 0; iter < maxIterations; iter++) {
            const { Q, R } = this.qrDecomposition(A);
            A = this.matrixMultiply(R, Q);
            Q_total = this.matrixMultiply(Q_total, Q);
        }
        
        const values = A.map((row, i) => row[i]);
        const vectors = this.transpose(Q_total);
        
        return { values, vectors };
    }

    svd(matrix) {
        const At = this.transpose(matrix);
        const AtA = this.matrixMultiply(At, matrix);
        const eigenAtA = this.eigenDecomposition(AtA);
        const singularValues = eigenAtA.values.map(v => Math.sqrt(Math.max(0, v))).sort((a, b) => b - a);
        const V = eigenAtA.vectors;
        const Vt = this.transpose(V);
        const U_cols = [];
        for (let i = 0; i < singularValues.length; i++) {
            if (singularValues[i] > this.tolerance) {
                const vi = V[i];
                const ui = this.matrixVectorMultiply(matrix, vi).map(val => val / singularValues[i]);
                U_cols.push(ui);
            }
        }
        const U = this.transpose(U_cols);
        return { U, S: singularValues, Vt: Vt };
    }

    rank(matrix) {
        const { S } = this.svd(matrix);
        return S.filter(s => Math.abs(s) > this.tolerance).length;
    }

    isSymmetric(matrix) {
        const n = matrix.length;
        if (n === 0 || n !== matrix[0].length) return false;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (Math.abs(matrix[i][j] - matrix[j][i]) > this.tolerance) {
                    return false;
                }
            }
        }
        return true;
    }

    rref(matrix) {
        let mat = matrix.map(r => [...r]);
        let lead = 0;
        const rowCount = mat.length;
        const colCount = mat[0].length;
        for (let r = 0; r < rowCount; r++) {
            if (colCount <= lead) return mat;
            let i = r;
            while (Math.abs(mat[i][lead]) < this.tolerance) {
                i++;
                if (rowCount === i) {
                    i = r;
                    lead++;
                    if (colCount === lead) return mat;
                }
            }
            [mat[i], mat[r]] = [mat[r], mat[i]];
            let val = mat[r][lead];
            for (let j = 0; j < colCount; j++) mat[r][j] /= val;
            for (let i = 0; i < rowCount; i++) {
                if (i === r) continue;
                val = mat[i][lead];
                for (let j = 0; j < colCount; j++) mat[i][j] -= val * mat[r][j];
            }
            lead++;
        }
        return mat;
    }

    nullSpace(matrix) {
        const rrefMatrix = this.rref(matrix);
        const rowCount = rrefMatrix.length;
        const colCount = rrefMatrix[0].length;
        const nullspaceBasis = [];
        const pivotColumns = [], freeColumns = [];
        let lead = 0;
        for (let r = 0; r < rowCount && lead < colCount; r++) {
            while (lead < colCount && Math.abs(rrefMatrix[r][lead]) < this.tolerance) {
                freeColumns.push(lead);
                lead++;
            }
            if (lead < colCount) pivotColumns.push(lead);
            lead++;
        }
        while (lead < colCount) {
            freeColumns.push(lead);
            lead++;
        }
        for (const freeCol of freeColumns) {
            const basisVector = Array(colCount).fill(0);
            basisVector[freeCol] = 1;
            for (let i = 0; i < pivotColumns.length; i++) {
                const pivotCol = pivotColumns[i];
                basisVector[pivotCol] = -rrefMatrix[i][freeCol];
            }
            nullspaceBasis.push(basisVector);
        }
        return nullspaceBasis;
    }

    matrixInverse(m) {
        const n = m.length;
        if (n === 0 || n !== m[0].length) {
            throw new Error("Inverse requires a square matrix.");
        }
        
        const I = this.identityMatrix(n);
        const A = m.map((row, i) => [...row, ...I[i]]);

        
        for (let col = 0; col < n; col++) {
            
            let pivot = col;
            for (let r = col + 1; r < n; r++) {
                if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
            }
            if (Math.abs(A[pivot][col]) < this.tolerance) return null; 
            if (pivot !== col) {
                [A[pivot], A[col]] = [A[col], A[pivot]];
            }

            
            const pv = A[col][col];
            for (let j = 0; j < 2 * n; j++) A[col][j] /= pv;

            
            for (let r = 0; r < n; r++) {
                if (r === col) continue;
                const factor = A[r][col];
                if (Math.abs(factor) < this.tolerance) continue;
                for (let j = 0; j < 2 * n; j++) A[r][j] -= factor * A[col][j];
            }
        }
        
        return A.map(row => row.slice(n));
    }

    projectOnSubspace(v, basis) {
        const A = this.transpose(basis);
        const At = basis;
        const AtA = this.matrixMultiply(At, A);
        const AtA_inv = this.matrixInverse(AtA);
        if (!AtA_inv) throw new Error("Could not project: basis vectors may be linearly dependent.");
        const Atv = this.matrixVectorMultiply(At, v);
        const coeffs = this.matrixVectorMultiply(AtA_inv, Atv);
        return this.matrixVectorMultiply(A, coeffs);
    }
    
    leastSquares(A, b) {
        const basis = this.transpose(A);
        return this.projectOnSubspace(b, basis);
    }

    gramSchmidt(vectors) {
        const orthogonal = [];
        for (const v of vectors) {
            let u = [...v];
            for (const o of orthogonal) {
                const proj_comp = this.projection(v, o);
                u = u.map((val, i) => val - proj_comp[i]);
            }
            const norm = Math.sqrt(this.dotProduct(u, u));
            if (norm > this.tolerance) {
                orthogonal.push(u.map(val => val / norm));
            }
        }
        return orthogonal;
    }

    projection(v, onto) {
        const dot = this.dotProduct(v, onto);
        const normSq = this.dotProduct(onto, onto);
        if (normSq < this.tolerance) return Array(v.length).fill(0);
        const scalar = dot / normSq;
        return onto.map(val => scalar * val);
    }
    
    dotProduct(v1, v2) {
        return v1.reduce((sum, val, i) => sum + val * v2[i], 0);
    }
    
    crossProduct(v1, v2) {
        return [ v1[1] * v2[2] - v1[2] * v2[1], v1[2] * v2[0] - v1[0] * v2[2], v1[0] * v2[1] - v1[1] * v2[0] ];
    }
    
    matrixMultiply(A, B) {
        const m = A.length, n = B[0].length, p = B.length;
        if (A[0].length !== p) throw new Error("Matrix dimensions are not compatible.");
        const C = Array(m).fill().map(() => Array(n).fill(0));
        for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) for (let k = 0; k < p; k++) C[i][j] += A[i][k] * B[k][j];
        return C;
    }
    
    matrixVectorMultiply(A, v) {
        return A.map(row => this.dotProduct(row, v));
    }
    
    transpose(matrix) {
        if (matrix.length === 0) return [];
        return matrix[0].map((_, i) => matrix.map(row => row[i]));
    }

    matrixAdd(A, B) {
        if (A.length !== B.length || A[0].length !== B[0].length) {
            throw new Error("Matrices must have the same dimensions to be added.");
        }
        return A.map((row, i) => row.map((val, j) => val + B[i][j]));
    }

    matrixSubtract(A, B) {
        if (A.length !== B.length || A[0].length !== B[0].length) {
            throw new Error("Matrices must have the same dimensions to be subtracted.");
        }
        return A.map((row, i) => row.map((val, j) => val - B[i][j]));
    }
    
    identityMatrix(n) {
        return Array(n).fill().map((_, i) => Array(n).fill().map((_, j) => i === j ? 1 : 0));
    }
}

window.LinearAlgebraEngine = LinearAlgebraEngine;
