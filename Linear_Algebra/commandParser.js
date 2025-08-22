
class CommandParser {
    constructor(sceneObjects, linearAlgebraEngine) {
        this.sceneObjects = sceneObjects;
        this.engine = linearAlgebraEngine;
        this.variables = {};
    }

    
    _uniqueName(base) {
        let name = base;
        let idx = 0;
        const exists = (n) => !!(this.sceneObjects && this.sceneObjects[n]);
        if (!exists(name)) return name;
        do { idx++; name = `${base}${idx}`; } while (exists(name));
        return name;
    }

    
    async _timeWorker(label, fn) {
        const t0 = (performance && performance.now ? performance.now() : Date.now());
        try {
            const res = await fn();
            const dt = ((performance && performance.now ? performance.now() : Date.now()) - t0).toFixed(1);
            console.debug(`[parser][worker] ${label} ok in ${dt}ms`);
            return res;
        } catch (e) {
            const dt = ((performance && performance.now ? performance.now() : Date.now()) - t0).toFixed(1);
            console.warn(`[parser][worker] ${label} failed in ${dt}ms:`, e?.message || e);
            throw e;
        }
    }

    
    splitTopLevel(expr, operators) {
        const parts = [];
        let depth = 0; 
        let start = 0;
        for (let i = 0; i < expr.length; i++) {
            const ch = expr[i];
            if (ch === '(' || ch === '[') depth++;
            else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
            else if (depth === 0 && operators.includes(ch)) {
                if (i === 0) continue; 
                parts.push(expr.slice(start, i));
                start = i; 
            }
        }
        parts.push(expr.slice(start));
        return parts.filter(p => p.length > 0);
    }

    parse(command) {
        command = command.trim();
        
        const assignmentMatch = command.match(/^([a-zA-Z_]\w*)\s*=(?!=)\s*(.+)$/);
        
        if (assignmentMatch) {
            const varName = assignmentMatch[1];
            let expression = assignmentMatch[2].trim();
            const result = this.evaluateExpression(expression);
            
            return this.formatResult(varName, result);
        }
        
        
        const result = this.evaluateExpression(command);
        let displayName = result.name || command;
        
        if (result.type === 'plane' && !result.name) {
            const m = command.match(/^\s*([a-zA-Z_]\w*)\s*==\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*$/);
            if (m) {
                displayName = this._uniqueName(`P${m[1]}`);
            }
        }
        return this.formatResult(displayName, result);
    }

    
    async parseAsync(command) {
        command = command.trim();
        
        const assignmentMatch = command.match(/^([a-zA-Z_]\w*)\s*=(?!=)\s*(.+)$/);
        if (assignmentMatch) {
            const varName = assignmentMatch[1];
            let expression = assignmentMatch[2].trim();
            const result = await this.evaluateExpressionAsync(expression);
            return this.formatResult(varName, result);
        }
        const result = await this.evaluateExpressionAsync(command);
        let displayName = result.name || command;
        if (result.type === 'plane' && !result.name) {
            const m = command.match(/^\s*([a-zA-Z_]\w*)\s*==\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*$/);
            if (m) {
                displayName = this._uniqueName(`P${m[1]}`);
            }
        }
        return this.formatResult(displayName, result);
    }

    evaluateExpression(expr) {
        expr = expr.trim();

        
        if (/^\([^()]*\)$/.test(expr) || /^\[[\s\S]*\]$/.test(expr)) {
            return this.getVariable(expr);
        }

        
        {
            const eqIdx = this.findTopLevelEquality(expr);
            if (eqIdx >= 0) {
                const leftStr = expr.slice(0, eqIdx).trim();
                const rightStr = expr.slice(eqIdx + 2).trim();
                const left = this.evaluateExpression(leftStr);
                const right = this.evaluateExpression(rightStr);
                if (left.type === 'vector' && right.type === 'scalar') {
                    const normal = left.value.slice();
                    const offset = Number(right.value) || 0;
                    const latex = `$$${(left.name||'n')} \\cdot x = ${offset.toFixed(3)}$$`;
                    const base = (/^[a-zA-Z_]\w*$/.test(leftStr) ? leftStr : (left.name && /^[a-zA-Z_]\w*$/.test(left.name) ? left.name : null));
                    const suggestedName = base ? this._uniqueName(`P${base}`) : undefined;
                    return { type: 'plane', value: { normal, offset }, latex, visualize: { type: 'plane', normal, offset }, name: suggestedName };
                }
            }
        }

        
        const memberMatch = expr.match(/^([a-zA-Z_]\w*)\.(x|y|z)$/);
        if (memberMatch) {
            const base = this.getVariable(memberMatch[1]);
            if (base.type !== 'vector') throw new Error('Named components apply to vectors only.');
            const idx = { x: 0, y: 1, z: 2 }[memberMatch[2]];
            if (base.value.length <= idx) throw new Error(`Vector has no '${memberMatch[2]}' component.`);
            return { type: 'scalar', value: +base.value[idx] };
        }

        
        let outerParts = this.splitTopLevel(expr, ['⊗']);
        if (outerParts.length === 2 && outerParts[0] !== '') {
            const left = this.evaluateExpression(outerParts[0]);
            const right = this.evaluateExpression(outerParts[1].substring(1));
            if (left.type !== 'vector' || right.type !== 'vector') throw new Error('Outer product requires two vectors.');
            const rows = left.value.length, cols = right.value.length;
            const M = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => left.value[i] * right.value[j]));
            return { type: 'matrix', value: M };
        }

        
        {
            let depth = 0; let dotIndex = -1; let valid = true;
            for (let i = 0; i < expr.length; i++) {
                const ch = expr[i];
                if (ch === '(' || ch === '[') depth++;
                else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
                else if (depth === 0 && ch === '.') {
                    
                    const isDecimal = (i>0 && /\d/.test(expr[i-1])) && (i+1<expr.length && /\d/.test(expr[i+1]));
                    if (isDecimal) { valid = false; break; }
                    if (dotIndex !== -1) { valid = false; break; }
                    dotIndex = i;
                }
            }
            if (valid && dotIndex > 0 && dotIndex < expr.length - 1) {
                const leftStr = expr.slice(0, dotIndex).trim();
                const rightStr = expr.slice(dotIndex + 1).trim();
                if (leftStr && rightStr) {
                    const left = this.evaluateExpression(leftStr);
                    const right = this.evaluateExpression(rightStr);
                    if (left.type === 'vector' && right.type === 'vector') {
                        const val = this.engine.dotProduct(left.value, right.value);
                        return { type: 'scalar', value: val };
                    }
                }
            }
        }

        
        let powParts = this.splitTopLevel(expr, ['^']);
        if (powParts.length === 2 && powParts[0] !== '') {
            const base = this.evaluateExpression(powParts[0]);
            let expStr = powParts[1].substring(1).trim();
            
            if (/^\(.+\)$/.test(expStr)) expStr = expStr.slice(1, -1).trim();
            const expVal = this.evaluateExpression(expStr);
            if (expVal.type !== 'scalar') throw new Error('Exponent must be a scalar.');
            const k = Math.round(expVal.value);
            if (Math.abs(k - expVal.value) > 1e-9) throw new Error('Only integer exponents are supported.');
            if (base.type !== 'matrix') throw new Error('Exponentiation is supported for matrices only.');
            
            const A = base.value;
            if (!A || A.length === 0 || A.length !== A[0].length) throw new Error('Matrix power requires a square matrix.');
            if (k === -1) {
                const inv = this.engine.matrixInverse(A);
                if (!inv) throw new Error('Matrix is singular (non-invertible).');
                return { type: 'matrix', value: inv };
            } else if (k === 0) {
                return { type: 'matrix', value: this.engine.identityMatrix(A.length) };
            } else if (k > 0) {
                
                let result = this.engine.identityMatrix(A.length);
                let baseMat = A.map(row => row.slice());
                let exp = k;
                while (exp > 0) {
                    if (exp & 1) result = this.engine.matrixMultiply(result, baseMat);
                    exp >>= 1;
                    if (exp > 0) baseMat = this.engine.matrixMultiply(baseMat, baseMat);
                }
                return { type: 'matrix', value: result };
            } else {
                
                const inv = this.engine.matrixInverse(A);
                if (!inv) throw new Error('Matrix is singular (non-invertible).');
                let result = this.engine.identityMatrix(A.length);
                let baseMat = inv;
                let exp = -k;
                while (exp > 0) {
                    if (exp & 1) result = this.engine.matrixMultiply(result, baseMat);
                    exp >>= 1;
                    if (exp > 0) baseMat = this.engine.matrixMultiply(baseMat, baseMat);
                }
                return { type: 'matrix', value: result };
            }
        }

        
        let parts = this.splitTopLevel(expr, ['+', '-']);
        if (parts.length > 1 && parts[0] !== '') {
            let result = this.evaluateExpression(parts[0]);
            for (let i = 1; i < parts.length; i++) {
                const op = parts[i][0];
                const term = this.evaluateExpression(parts[i].substring(1));
                if (op === '+') result = this.add(result, term);
                else if (op === '-') result = this.subtract(result, term);
            }
            return result;
        }

        
        parts = this.splitTopLevel(expr, ['*', '/']);
        if (parts.length > 1 && parts[0] !== '') {
            let result = this.evaluateExpression(parts[0]);
            for (let i = 1; i < parts.length; i++) {
                const op = parts[i][0];
                const term = this.evaluateExpression(parts[i].substring(1));
                if (op === '*') result = this.multiply(result, term);
                else if (op === '/') result = this.divide(result, term);
            }
            return result;
        }
        
        
        const implicitMatch = expr.match(/^(\d+\.?\d*)\s*([a-zA-Z_]\w*)$/);
        if (implicitMatch) {
            const scalar = this.getVariable(implicitMatch[1]);
            const variable = this.getVariable(implicitMatch[2]);
            return this.multiply(scalar, variable);
        }

        
        const unaryMatch = expr.match(/^-(.+)$/);
        if (unaryMatch) {
            const variable = this.evaluateExpression(unaryMatch[1]);
            if (variable.type === 'scalar') {
                return { type: 'scalar', value: -variable.value };
            }
            return this.multiply({ type: 'scalar', value: -1 }, variable);
        }

        
        const funcNameMatch = expr.match(/^([a-zA-Z_]\w*)\s*\(/);
        if (funcNameMatch && expr.endsWith(')')) {
            const openIdx = expr.indexOf('(');
            let depth = 0;
            let valid = true;
            for (let i = openIdx; i < expr.length; i++) {
                const ch = expr[i];
                if (ch === '(') depth++;
                else if (ch === ')') depth--;
                if (depth < 0) { valid = false; break; }
                
                if (depth === 0 && i < expr.length - 1) { valid = false; break; }
            }
            if (valid && depth === 0) {
                const funcName = funcNameMatch[1];
                const argString = expr.slice(openIdx + 1, -1);
                return this.evaluateFunction(funcName, argString);
            }
        }
        
        if (expr.endsWith(']')) {
            let depth = 0; let open = -1;
            for (let i = expr.length - 1; i >= 0; i--) {
                const ch = expr[i];
                if (ch === ']') depth++;
                else if (ch === '[') {
                    depth--;
                    if (depth === 0) { open = i; break; }
                }
            }
            if (open > 0) {
                const baseStr = expr.slice(0, open).trim();
                const idxStr = expr.slice(open + 1, -1).trim();
                const base = this.evaluateExpression(baseStr);
                const idxParts = this.splitTopLevel(idxStr, [',']).map(a => (a[0] === ',' ? a.slice(1) : a).trim()).filter(Boolean);
                if (base.type === 'vector') {
                    if (idxParts.length !== 1) throw new Error('Vector indexing expects one index.');
                    const iVal = this.evaluateExpression(idxParts[0]);
                    if (iVal.type !== 'scalar') throw new Error('Index must be a scalar.');
                    const i = Math.floor(iVal.value) - 1;
                    if (i < 0 || i >= base.value.length) throw new Error('Vector index out of range.');
                    return { type: 'scalar', value: +base.value[i] };
                } else if (base.type === 'matrix') {
                    if (idxParts.length !== 2) throw new Error('Matrix indexing expects two indices [row, col].');
                    const rVal = this.evaluateExpression(idxParts[0]);
                    const cVal = this.evaluateExpression(idxParts[1]);
                    if (rVal.type !== 'scalar' || cVal.type !== 'scalar') throw new Error('Indices must be scalars.');
                    const r = Math.floor(rVal.value) - 1;
                    const c = Math.floor(cVal.value) - 1;
                    if (r < 0 || r >= base.value.length || c < 0 || c >= (base.value[0]?.length || 0)) throw new Error('Matrix index out of range.');
                    return { type: 'scalar', value: +base.value[r][c] };
                }
            }
        }

        return this.getVariable(expr);
    }

    
    async evaluateFunctionAsync(funcName, args) {
        funcName = funcName.toLowerCase();
        let argList = this.splitTopLevel(args, [','])
            .map(a => (a[0] === ',' ? a.slice(1) : a).trim())
            .filter(a => a.length > 0);

        
        if (funcName === 'proj' && argList.length === 1 && args.includes('.')) {
            const dotParts = this.splitTopLevel(args, ['.'])
                .map(a => (a[0] === '.' ? a.slice(1) : a).trim())
                .filter(a => a.length > 0);
            if (
                dotParts.length === 2 &&
                dotParts.every(tok => /^(?:[a-zA-Z_]\w*|\([^]*\)|\[[^]*\])$/.test(tok))
            ) {
                argList = dotParts;
            }
        }

        switch (funcName) {
            case 'inv': {
                const matrixVar = this.getVariable(argList[0]);
                if (matrixVar.type !== 'matrix') throw new Error("inv() requires a matrix argument.");
                const A = matrixVar.value;
                if (!A || A.length === 0 || A.length !== A[0].length) throw new Error('Inverse requires a square matrix.');
                const inv = window.computationManager
                    ? await this._timeWorker('inverse()', () => window.computationManager.inverse(A))
                    : this.engine.matrixInverse(A);
                if (!inv) throw new Error('Matrix is singular (non-invertible).');
                return { type: 'matrix', value: inv, latex: `$$${matrixVar.name}^{-1} = ${this.matrixToLatex(inv).replace(/^\$\$|\$\$/g,'') }$$` };
            }
            case 'solve': {
                if (argList.length < 2 || argList.length > 3) throw new Error("solve() requires 2 or 3 arguments.");
                const Avar = this.getVariable(argList[0]);
                const Bvar = this.getVariable(argList[1]);
                
                if (Avar.type === 'plane' && Bvar.type === 'plane') {
                    const planes = [Avar, Bvar];
                    if (argList.length === 3) {
                        const Cvar = this.getVariable(argList[2]);
                        if (Cvar.type !== 'plane') throw new Error('When using 3 args with planes, all must be planes.');
                        planes.push(Cvar);
                        
                        const N = planes.map(p => p.value.normal.slice(0,3));
                        const d = planes.map(p => +p.value.offset);
                        
                        const det = this.engine.determinant(N);
                        if (Math.abs(det) < 1e-9) {
                            const msg = `Three planes do not meet at a single point (degenerate or line intersection).`;
                            return { type: 'intersection', value: { kind: 'none_or_line' }, rawOutput: msg, latex: `$$\\text{${msg}}$$`, visualize: { type: 'plane_intersection_degenerate', planes: planes.map(p=>({ normal:p.value.normal, offset:p.value.offset, name:p.name })) } };
                        }
                        const Ninv = this.engine.matrixInverse(N);
                        const x = this.engine.matrixVectorMultiply(Ninv, d);
                        const msg = `Intersection point: (${x.map(v=>v.toFixed(3)).join(', ')})`;
                        return { type: 'point', value: x, rawOutput: msg, latex: `$$\\text{Intersection point: }(${x.map(v=>v.toFixed(3)).join(', ')})$$`, visualize: { type: 'plane_intersection_point', point: x, planes: planes.map(p=>({ normal:p.value.normal, offset:p.value.offset, name:p.name })) } };
                    } else {
                        
                        const n1All = Avar.value.normal.map(Number);
                        const n2All = Bvar.value.normal.map(Number);
                        const d1 = +Avar.value.offset;
                        const d2 = +Bvar.value.offset;
                        const dim = Math.min(n1All.length, n2All.length);
                        if (n1All.length !== n2All.length) {
                            const msg = `Plane dimensions differ (${n1All.length} vs ${n2All.length}); cannot intersect.`;
                            return { type: 'error', error: msg };
                        }
                        if (dim !== 3) {
                            
                            const A = [ n1All.slice(), n2All.slice() ]; 
                            const dvec = [d1, d2];
                            
                            const Aug = A.map((row, i) => [...row, dvec[i]]);
                            const R = this.engine.rref(Aug);
                            const n = A[0].length;
                            const inconsistent = R.some(row => row.slice(0, n).every(v => Math.abs(v) < 1e-9) && Math.abs(row[n]) > 1e-9);
                            if (inconsistent) {
                                const msg = `No solution: planes are inconsistent in R^${dim}.`;
                                return { type: 'intersection', value: { kind: 'none' }, rawOutput: msg, latex: `$$\\text{${msg}}$$` };
                            }
                            
                            const rank = this.engine.rank(A);
                            let x_p = Array(dim).fill(0);
                            if (rank > 0) {
                                const At = this.engine.transpose(A);
                                const AAt = this.engine.matrixMultiply(A, At); 
                                const inv = this.engine.matrixInverse(AAt);
                                if (inv) {
                                    const temp = this.engine.matrixVectorMultiply(inv, dvec); 
                                    x_p = this.engine.matrixVectorMultiply(At, temp); 
                                } else {
                                    
                                    const r = (Math.hypot(...A[0]) > 1e-12) ? A[0] : A[1];
                                    const d_equiv = (Math.hypot(...A[0]) > 1e-12) ? dvec[0] : dvec[1];
                                    const norm2 = this.engine.dotProduct(r, r);
                                    if (norm2 > 1e-12) x_p = r.map(v => (d_equiv / norm2) * v);
                                }
                            }
                            
                            const basis = this.engine.nullSpace(A);
                            
                            const fmtVec = (vec) => `\\begin{pmatrix} ${vec.map(v=>Number(v).toFixed(2)).join(' \\\\ ')} \\end{pmatrix}`;
                            const lhs = `x = \\begin{pmatrix} ${Array.from({length: dim}, (_,i)=>`x_{${i+1}}`).join(' \\\\ ')} \\end{pmatrix}`;
                            const xp = fmtVec(x_p);
                            const paramSym = (i) => {
                                const base = ['s','t','u','v','w','p','q','r'];
                                return i < base.length ? base[i] : `t_{${i-base.length+1}}`;
                            };
                            const terms = basis.map((b,i) => `${paramSym(i)} \\begin{pmatrix} ${b.map(v=>Number(v).toFixed(2)).join(' \\\\ ')} \\end{pmatrix}`);
                            const rhs = [xp, ...terms].join(' \\; + \\; ');
                            const latex = `$$${lhs} = ${rhs}$$`;
                            const msg = `Affine solution in R^${dim}: ${basis.length} free parameter(s).`;
                            const parameters = basis.map((_,i)=>paramSym(i));
                            return { type: 'affine_subspace', value: { particular: x_p, basis, dim, parameters }, rawOutput: msg, latex };
                        }
                        
                        const n1 = n1All.slice(0,3);
                        const n2 = n2All.slice(0,3);
                        const cross = this.engine.crossProduct(n1, n2);
                        const dirNorm = Math.hypot(cross[0], cross[1], cross[2]);
                        if (dirNorm < 1e-9) {
                            
                            
                            let k = 0; let aligned = false;
                            const idx = [0,1,2].find(i => Math.abs(n1[i]) > 1e-9);
                            if (idx !== undefined) {
                                k = n2[idx]/n1[idx];
                                aligned = [0,1,2].every(i => Math.abs(n1[i]*k - n2[i]) < 1e-8);
                            }
                            if (aligned && Math.abs(d1*k - d2) < 1e-8) {
                                const msg = `Planes ${Avar.name} and ${Bvar.name} coincide (infinitely many intersections).`;
                                return { type: 'intersection', value: { kind: 'coincident' }, rawOutput: msg, latex: `$$\\text{${msg}}$$`, visualize: { type: 'plane_intersection_coincident', planes: [Avar.name, Bvar.name] } };
                            }
                            const msg = `Planes ${Avar.name} and ${Bvar.name} are parallel (no intersection line).`;
                            return { type: 'intersection', value: { kind: 'parallel' }, rawOutput: msg, latex: `$$\\text{${msg}}$$`, visualize: { type: 'plane_intersection_parallel', planes: [Avar.name, Bvar.name] } };
                        }
                        const v = cross; 
                        
                        const n2xv = this.engine.crossProduct(n2, v);
                        const vxn1 = this.engine.crossProduct(v, n1);
                        const numerator = [
                            d1*n2xv[0] + d2*vxn1[0],
                            d1*n2xv[1] + d2*vxn1[1],
                            d1*n2xv[2] + d2*vxn1[2]
                        ];
                        const denom = this.engine.dotProduct(n1, n2xv);
                        if (Math.abs(denom) < 1e-12) {
                            const msg = `Intersection line could not be determined (degenerate configuration).`;
                            return { type: 'intersection', value: { kind: 'degenerate' }, rawOutput: msg, latex: `$$\\text{${msg}}$$`, visualize: { type: 'plane_intersection_degenerate', planes: [Avar.name, Bvar.name] } };
                        }
                        const p0 = numerator.map(c => c/denom);
                        const msg = `Line solution: x = p0 + t*v`;
                        
                        const p0Latex = this.vectorToLatex(p0, 'p_0').replace(/^\$\$|\$\$/g,'');
                        const vLatex = this.vectorToLatex(v, 'v').replace(/^\$\$|\$\$/g,'');
                        const sysLatex = `$$x = p_0 + t\\, v$$`;
                        const latex = `${sysLatex}${this.matrixToLatex ? '' : ''}`.replace(/\n/g,'') + `$$${p0Latex}$$$$${vLatex}$$`;
                        return { type: 'line', value: { point: p0, direction: v }, rawOutput: msg, latex, visualize: { type: 'plane_intersection_line', point: p0, direction: v, planes: [Avar.name, Bvar.name] } };
                    }
                }
                if (Avar.type !== 'matrix') throw new Error('First argument of solve() must be a matrix A.');
                const A = Avar.value;
                if (!Array.isArray(A) || A.length === 0 || !Array.isArray(A[0])) throw new Error('Invalid matrix A for solve().');
                const m = A.length, n = A[0].length;
                
                let rhsCols = [];
                if (Bvar.type === 'vector') {
                    if (Bvar.value.length !== m) throw new Error('b length must equal number of rows of A.');
                    rhsCols = [Bvar.value.slice()];
                } else if (Bvar.type === 'matrix') {
                    const B = Bvar.value;
                    if (B.length !== m) throw new Error('RHS matrix row count must equal rows of A.');
                    const k = (B[0] || []).length;
                    for (let j = 0; j < k; j++) {
                        const col = [];
                        for (let i = 0; i < m; i++) col.push(B[i][j]);
                        rhsCols.push(col);
                    }
                } else {
                    throw new Error('Second argument of solve() must be a vector or a matrix.');
                }

                const useWorker = !!window.computationManager;
                const sols = [];
                
                if (m === n && useWorker) {
                    for (let j = 0; j < rhsCols.length; j++) {
                        const bcol = rhsCols[j];
                        const x = await this._timeWorker(`solve() col ${j+1}/${rhsCols.length}`,
                            () => window.computationManager.solve(A, bcol, { maxTotalMs: 60000 }));
                        sols.push(x);
                    }
                } else {
                    for (let j = 0; j < rhsCols.length; j++) {
                        const x = this.engine.leastSquares(A, rhsCols[j]);
                        sols.push(x);
                    }
                }

                
                if (rhsCols.length === 1) {
                    const x = sols[0];
                    const result = { type: 'vector', value: x };
                    
                    if (n <= 3 && m <= 3) {
                        const steps = [];
                        steps.push(`$$A = ${this.matrixToLatex(A).replace(/^\$\$|\$\$/g,'')}\,,\ b = ${this.vectorToLatex(rhsCols[0]).replace(/^\$\$|\$\$/g,'')}$$`);
                        if (m === n) steps.push('$$A\\ x = b\ \Rightarrow\ x = A^{-1} b\ (via\ elimination)$$');
                        else steps.push('$$\text{Least squares solution via normal equations}$$');
                        result.steps = steps;
                    }
                    if (m !== n) {
                        result.visualize = { type: 'least_squares', matrix: A, b: rhsCols[0], result: x };
                    }
                    return result;
                } else {
                    
                    const X = Array.from({ length: sols[0].length }, (_, i) => sols.map(col => col[i]));
                    const latex = `$$X = ${this.matrixToLatex(X).replace(/^\$\$|\$\$/g,'')}$$`;
                    return { type: 'matrix', value: X, latex };
                }
            }
            case 'rref': {
                if (argList.length === 0) throw new Error("rref() requires at least one argument.");
                let A;
                if (argList.length === 1) {
                    const first = this.getVariable(argList[0]);
                    if (first.type === 'matrix') {
                        A = first.value;
                    } else if (first.type === 'vector') {
                        
                        const col = first.value.slice();
                        A = col.map(v => [v]);
                    } else {
                        throw new Error("rref() expects a matrix or vector arguments.");
                    }
                } else {
                    
                    const columns = argList.map(name => {
                        const v = this.getVariable(name);
                        if (v.type === 'vector') return v.value.slice();
                        if (v.type === 'matrix') {
                            const M = v.value;
                            const rows = M.length, cols = (M[0]||[]).length;
                            if (cols !== 1) throw new Error(`'${name}' must be a single-column matrix to be used as a column.`);
                            const col = [];
                            for (let i=0;i<rows;i++) col.push(M[i][0]);
                            return col;
                        }
                        throw new Error(`'${name}' is not a vector or single-column matrix.`);
                    });
                    const rows = columns[0].length;
                    if (!columns.every(c => c.length === rows)) {
                        throw new Error('All input vectors/columns must have the same dimension.');
                    }
                    
                    A = Array.from({ length: rows }, (_, i) => columns.map(col => col[i]));
                }
                const R = window.computationManager
                    ? await this._timeWorker('rref()', () => window.computationManager.rref(A))
                    : this.engine.rref(A);
                return { type: 'matrix', value: R };
            }
            case 'det': {
                const matrixVar = this.getVariable(argList[0]);
                if (matrixVar.type !== 'matrix') throw new Error("det() requires a matrix argument.");
                const M = matrixVar.value;
                const detValue = window.computationManager
                    ? await this._timeWorker('determinant()', () => window.computationManager.determinant(M))
                    : this.engine.determinant(M);
                let steps = [];
                if (Array.isArray(M) && M.length === 2 && M[0].length === 2) {
                    const [[a,b],[c,d]] = M;
                    steps = [
                        `$$det(${matrixVar.name}) = \\begin{vmatrix} ${a} & ${b} \\ ${c} & ${d} \\end{vmatrix}$$`,
                        `$$= (${a}\\cdot${d}) - (${b}\\cdot${c})$$`,
                        `$$= ${(a*d).toFixed(3)} - ${(b*c).toFixed(3)}$$`,
                        `$$= ${(a*d - b*c).toFixed(3)}$$`
                    ];
                } else if (Array.isArray(M) && M.length === 3 && M[0].length === 3) {
                    const [[a,b,c],[d,e,f],[g,h,i]] = M;
                    steps = [
                        `$$det(${matrixVar.name}) = \\begin{vmatrix} ${a} & ${b} & ${c} \\ ${d} & ${e} & ${f} \\ ${g} & ${h} & ${i} \\end{vmatrix}$$`,
                        `$$= ${a}\\,\\begin{vmatrix} ${e} & ${f} \\ ${h} & ${i} \\end{vmatrix} - ${b}\\,\\begin{vmatrix} ${d} & ${f} \\ ${g} & ${i} \\end{vmatrix} + ${c}\\,\\begin{vmatrix} ${d} & ${e} \\ ${g} & ${h} \\end{vmatrix}$$`,
                        `$$= ${a}(${(e*i - f*h).toFixed(3)}) - ${b}(${(d*i - f*g).toFixed(3)}) + ${c}(${(d*h - e*g).toFixed(3)})$$`,
                        `$$= ${(a*(e*i - f*h) - b*(d*i - f*g) + c*(d*h - e*g)).toFixed(3)}$$`
                    ];
                }
                return { type: 'scalar', value: detValue, latex: `$$det(${matrixVar.name}) = ${detValue.toFixed(3)}$$`, visualize: { type: 'determinant', matrix: M, det: detValue }, steps };
            }
            case 'lu': {
                const matrixVar = this.getVariable(argList[0]);
                if (matrixVar.type !== 'matrix') throw new Error("lu() requires a matrix argument.");
                const { L, U } = window.computationManager
                    ? await this._timeWorker('lu()', () => window.computationManager.lu(matrixVar.value))
                    : (this.engine.luDecomposition ? this.engine.luDecomposition(matrixVar.value) : (()=>{ throw new Error('Worker unavailable and engine.luDecomposition not implemented.'); })());
                const steps = [
                    `$$LU\\ decomposition\\ of\\ ${matrixVar.name || 'A'}:$$`,
                    this.matrixToLatex(L, 'L'),
                    this.matrixToLatex(U, 'U')
                ];
                return { type: 'matrix_decomposition', value: { L, U }, steps, latex: `${this.matrixToLatex(L, 'L')}${this.matrixToLatex(U, 'U')}` };
            }
            case 'qr': {
                const matrixVar = this.getVariable(argList[0]);
                if (matrixVar.type !== 'matrix') throw new Error("qr() requires a matrix argument.");
                const out = window.computationManager
                    ? await this._timeWorker('qr()', () => window.computationManager.qr(matrixVar.value))
                    : (this.engine.qrDecomposition ? this.engine.qrDecomposition(matrixVar.value) : (()=>{ throw new Error('Worker unavailable and engine.qrDecomposition not implemented.'); })());
                const { Q, R } = out;
                const steps = [
                    `$$QR\\ decomposition\\ of\\ ${matrixVar.name || 'A'}:$$`,
                    this.matrixToLatex(Q, 'Q'),
                    this.matrixToLatex(R, 'R')
                ];
                const transposeToColumns = (M) => {
                    const rows = M.length, cols = M[0].length;
                    const colsArr = [];
                    for (let j=0;j<cols;j++){ const col=[]; for (let i=0;i<rows;i++) col.push(M[i][j]); colsArr.push(col); }
                    return colsArr;
                };
                const original = transposeToColumns(matrixVar.value);
                const final = transposeToColumns(Q);
                return { type: 'matrix_decomposition', value: { Q, R }, steps, latex: `${this.matrixToLatex(Q, 'Q')}${this.matrixToLatex(R, 'R')}` , visualize: { type: 'qr', Q, R, name: matrixVar.name || 'A' } };
            }
            case 'solve': {
                if (argList.length < 2 || argList.length > 3) throw new Error("solve() requires 2 or 3 arguments.");
                const Aarg = this.getVariable(argList[0]);
                const Barg = this.getVariable(argList[1]);
                if (Aarg.type === 'plane' && Barg.type === 'plane') {
                    if (argList.length === 3) {
                        const Carg = this.getVariable(argList[2]);
                        if (Carg.type !== 'plane') throw new Error('When using 3 args with planes, all must be planes.');
                        const N = [Aarg.value.normal.slice(0,3), Barg.value.normal.slice(0,3), Carg.value.normal.slice(0,3)];
                        const d = [ +Aarg.value.offset, +Barg.value.offset, +Carg.value.offset ];
                        const det = this.engine.determinant(N);
                        if (Math.abs(det) < 1e-9) {
                            const msg = `Three planes do not meet at a single point (degenerate or line intersection).`;
                            return { type: 'intersection', value: { kind: 'none_or_line' }, rawOutput: msg, latex: `$$\\text{${msg}}$$`, visualize: { type: 'plane_intersection_degenerate', planes: [Aarg.name, Barg.name, Carg.name] } };
                        }
                        const inv = this.engine.matrixInverse(N);
                        const x = this.engine.matrixVectorMultiply(inv, d);
                        const msg = `Intersection point: (${x.map(v=>v.toFixed(3)).join(', ')})`;
                        return { type: 'point', value: x, rawOutput: msg, latex: `$$\\text{Intersection point: }(${x.map(v=>v.toFixed(3)).join(', ')})$$`, visualize: { type: 'plane_intersection_point', point: x, planes: [Aarg.name, Barg.name, Carg.name] } };
                    } else {
                        const n1 = Aarg.value.normal.map(Number);
                        const n2 = Barg.value.normal.map(Number);
                        const d1 = +Aarg.value.offset;
                        const d2 = +Barg.value.offset;
                        const v = this.engine.crossProduct(n1, n2);
                        const dirNorm = Math.hypot(v[0], v[1], v[2]);
                        if (dirNorm < 1e-9) {
                            let k = 0; let aligned = false;
                            const idx = [0,1,2].find(i => Math.abs(n1[i]) > 1e-9);
                            if (idx !== undefined) { k = n2[idx]/n1[idx]; aligned = [0,1,2].every(i => Math.abs(n1[i]*k - n2[i]) < 1e-8); }
                            if (aligned && Math.abs(d1*k - d2) < 1e-8) { const msg = `Planes ${Aarg.name} and ${Barg.name} coincide (infinitely many intersections).`; return { type: 'intersection', value: { kind: 'coincident' }, rawOutput: msg, latex: `$$\\text{${msg}}$$`, visualize: { type: 'plane_intersection_coincident', planes: [Aarg.name, Barg.name] } }; }
                            const msg = `Planes ${Aarg.name} and ${Barg.name} are parallel (no intersection line).`;
                            return { type: 'intersection', value: { kind: 'parallel' }, rawOutput: msg, latex: `$$\\text{${msg}}$$`, visualize: { type: 'plane_intersection_parallel', planes: [Aarg.name, Barg.name] } };
                        }
                        const n2xv = this.engine.crossProduct(n2, v);
                        const vxn1 = this.engine.crossProduct(v, n1);
                        const numerator = [ d1*n2xv[0] + d2*vxn1[0], d1*n2xv[1] + d2*vxn1[1], d1*n2xv[2] + d2*vxn1[2] ];
                        const denom = this.engine.dotProduct(n1, n2xv);
                        if (Math.abs(denom) < 1e-12) { const msg = `Intersection line could not be determined (degenerate configuration).`; return { type: 'intersection', value: { kind: 'degenerate' }, rawOutput: msg, latex: `$$\\text{${msg}}$$`, visualize: { type: 'plane_intersection_degenerate', planes: [Aarg.name, Barg.name] } }; }
                        const p0 = numerator.map(c => c/denom);
                        const msg = `Line solution: x = p0 + t*v`;
                        const p0Latex = this.vectorToLatex(p0, 'p_0').replace(/^\$\$|\$\$/g,'');
                        const vLatex = this.vectorToLatex(v, 'v').replace(/^\$\$|\$\$/g,'');
                        const sysLatex = `$$x = p_0 + t\\, v$$`;
                        const latex = `${sysLatex}` + `$$${p0Latex}$$$$${vLatex}$$`;
                        return { type: 'line', value: { point: p0, direction: v }, rawOutput: msg, latex, visualize: { type: 'plane_intersection_line', point: p0, direction: v, planes: [Aarg.name, Barg.name] } };
                    }
                }
                const matrixVar = Aarg;
                const vectorVar = Barg;
                if (matrixVar.type !== 'matrix') throw new Error("First argument of solve() must be a matrix.");
                if (vectorVar.type !== 'vector') throw new Error("Second argument of solve() must be a vector.");
                const A = matrixVar.value;
                const b = vectorVar.value;
                if (!Array.isArray(A) || A.length === 0 || !Array.isArray(A[0])) throw new Error('Invalid matrix for solve().');
                if (!Array.isArray(b) || b.length !== A.length) throw new Error('Vector length must equal number of rows of A.');
                let x;
                if (window.computationManager) {
                    try {
                        x = await this._timeWorker('solve()', () => window.computationManager.solve(A, b));
                    } catch (_) {
                        x = this.engine.leastSquares(A, b);
                    }
                } else {
                    x = this.engine.leastSquares(A, b);
                }
                return { type: 'vector', value: x, visualize: { type: 'least_squares', matrix: A, b, result: x } };
            }
            case 'gramschmidt':
            case 'gram_schmidt': {
                
                let columns = [];
                if (argList.length === 1) {
                    const A = this.getVariable(argList[0]);
                    if (A.type !== 'matrix') throw new Error('gramschmidt() expects a matrix or a list of vectors.');
                    const M = A.value;
                    const rows = M.length, cols = M[0].length;
                    for (let j=0;j<cols;j++){ const col=[]; for (let i=0;i<rows;i++) col.push(M[i][j]); columns.push(col); }
                } else {
                    const vecs = this.getVectorArgs(argList);
                    columns = vecs.map(v => v.value.slice());
                }
                
                const steps = [`$$Gram\\text{-}Schmidt\\ process$$`];
                const U = [];
                const dot = (a,b)=>a.reduce((s,ai,i)=>s+ai*b[i],0);
                const sub = (a,b)=>a.map((ai,i)=>ai-b[i]);
                const mul = (a,scalar)=>a.map(ai=>ai*scalar);
                const norm = (a)=>Math.sqrt(dot(a,a));
                const original = columns.map(col => col.slice());
                for (let k=0;k<columns.length;k++){
                    let v = columns[k].slice();
                    let textParts = [`$$u_{${k+1}} = v_{${k+1}}`];
                    for (let i=0;i<k;i++){
                        const proj = dot(v, U[i]);
                        v = sub(v, mul(U[i], proj));
                        textParts.push(`- \\langle v_{${k+1}}, u_{${i+1}} \\rangle u_{${i+1}}`);
                    }
                    const n = norm(v);
                    if (n < 1e-10) throw new Error('Vectors are linearly dependent; cannot normalize zero vector.');
                    const uk = mul(v, 1/n);
                    U.push(uk);
                    const latexVec = (vec) => `\\begin{pmatrix} ${vec.map(x=>x.toFixed(3)).join(' \\\\ ')} \\end{pmatrix}`;
                    steps.push(`${textParts.join(' ')} \\Rightarrow \\hat{u}_{${k+1}} = \\frac{u_{${k+1}}}{\\|u_{${k+1}}\\|} = ${latexVec(uk)}$$`);
                }
                const final = U;
                const latex = U.map((u,i)=>this.vectorToLatex(u, `u_${i+1}`)).join('');
                return { type: 'orthonormal_basis', value: U, steps, latex, visualize: { type: 'gram_schmidt', original, final } };
            }
            default:
                
                return this.evaluateFunction(funcName, args);
        }
    }

    async evaluateExpressionAsync(expr) {
        expr = expr.trim();

        if (/^\([^()]*\)$/.test(expr) || /^\[[\s\S]*\]$/.test(expr)) {
            return this.getVariable(expr);
        }

        
        {
            const eqIdx = this.findTopLevelEquality(expr);
            if (eqIdx >= 0) {
                const leftStr = expr.slice(0, eqIdx).trim();
                const rightStr = expr.slice(eqIdx + 2).trim();
                const left = await this.evaluateExpressionAsync(leftStr);
                const right = await this.evaluateExpressionAsync(rightStr);
                if (left.type === 'vector' && right.type === 'scalar') {
                    const normal = left.value.slice();
                    const offset = Number(right.value) || 0;
                    const latex = `$$${(left.name||'n')} \\cdot x = ${offset.toFixed(3)}$$`;
                    const base = (/^[a-zA-Z_]\\w*$/.test(leftStr) ? leftStr : (left.name && /^[a-zA-Z_]\\w*$/.test(left.name) ? left.name : null));
                    const suggestedName = base ? this._uniqueName(`P${base}`) : undefined;
                    return { type: 'plane', value: { normal, offset }, latex, visualize: { type: 'plane', normal, offset }, name: suggestedName };
                }
            }
        }

        
        {
            const memberMatch = expr.match(/^([a-zA-Z_]\w*)\.(x|y|z)$/);
            if (memberMatch) {
                const base = this.getVariable(memberMatch[1]);
                if (base.type !== 'vector') throw new Error('Named components apply to vectors only.');
                const idx = { x: 0, y: 1, z: 2 }[memberMatch[2]];
                if (base.value.length <= idx) throw new Error(`Vector has no '${memberMatch[2]}' component.`);
                return { type: 'scalar', value: +base.value[idx] };
            }
        }

        
        {
            const outerParts = this.splitTopLevel(expr, ['⊗']);
            if (outerParts.length === 2 && outerParts[0] !== '') {
                const left = await this.evaluateExpressionAsync(outerParts[0]);
                const right = await this.evaluateExpressionAsync(outerParts[1].substring(1));
                if (left.type !== 'vector' || right.type !== 'vector') throw new Error('Outer product requires two vectors.');
                const rows = left.value.length, cols = right.value.length;
                const M = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => left.value[i] * right.value[j]));
                return { type: 'matrix', value: M };
            }
        }

        
        {
            let depth = 0; let dotIndex = -1; let valid = true;
            for (let i = 0; i < expr.length; i++) {
                const ch = expr[i];
                if (ch === '(' || ch === '[') depth++;
                else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
                else if (depth === 0 && ch === '.') {
                    const isDecimal = (i>0 && /\d/.test(expr[i-1])) && (i+1<expr.length && /\d/.test(expr[i+1]));
                    if (isDecimal) { valid = false; break; }
                    if (dotIndex !== -1) { valid = false; break; }
                    dotIndex = i;
                }
            }
            if (valid && dotIndex > 0 && dotIndex < expr.length - 1) {
                const leftStr = expr.slice(0, dotIndex).trim();
                const rightStr = expr.slice(dotIndex + 1).trim();
                if (leftStr && rightStr) {
                    const left = await this.evaluateExpressionAsync(leftStr);
                    const right = await this.evaluateExpressionAsync(rightStr);
                    if (left.type === 'vector' && right.type === 'vector') {
                        const val = this.engine.dotProduct(left.value, right.value);
                        return { type: 'scalar', value: val };
                    }
                }
            }
        }

        let powParts = this.splitTopLevel(expr, ['^']);
        if (powParts.length === 2 && powParts[0] !== '') {
            const base = await this.evaluateExpressionAsync(powParts[0]);
            let expStr = powParts[1].substring(1).trim();
            if (/^\(.+\)$/.test(expStr)) expStr = expStr.slice(1, -1).trim();
            const expVal = await this.evaluateExpressionAsync(expStr);
            if (expVal.type !== 'scalar') throw new Error('Exponent must be a scalar.');
            const k = Math.round(expVal.value);
            if (Math.abs(k - expVal.value) > 1e-9) throw new Error('Only integer exponents are supported.');
            if (base.type !== 'matrix') throw new Error('Exponentiation is supported for matrices only.');
            const A = base.value;
            if (!A || A.length === 0 || A.length !== A[0].length) throw new Error('Matrix power requires a square matrix.');
            if (k === -1) {
                
                const inv = (window.computationManager?
                    await this._timeWorker('inverse(A) for power -1', () => window.computationManager.inverse(A))
                    : this.engine.matrixInverse(A));
                if (!inv) throw new Error('Matrix is singular (non-invertible).');
                return { type: 'matrix', value: inv };
            } else if (k === 0) {
                return { type: 'matrix', value: this.engine.identityMatrix(A.length) };
            } else if (k > 0) {
                let result = this.engine.identityMatrix(A.length);
                let baseMat = A.map(row => row.slice());
                let exp = k;
                while (exp > 0) {
                    if (exp & 1) result = this.engine.matrixMultiply(result, baseMat);
                    exp >>= 1;
                    if (exp > 0) baseMat = this.engine.matrixMultiply(baseMat, baseMat);
                }
                return { type: 'matrix', value: result };
            } else {
                const inv = (window.computationManager?
                    await this._timeWorker('inverse(A) for negative power', () => window.computationManager.inverse(A))
                    : this.engine.matrixInverse(A));
                if (!inv) throw new Error('Matrix is singular (non-invertible).');
                let result = this.engine.identityMatrix(A.length);
                let baseMat = inv;
                let exp = -k;
                while (exp > 0) {
                    if (exp & 1) result = this.engine.matrixMultiply(result, baseMat);
                    exp >>= 1;
                    if (exp > 0) baseMat = this.engine.matrixMultiply(baseMat, baseMat);
                }
                return { type: 'matrix', value: result };
            }
        }

        let parts = this.splitTopLevel(expr, ['+', '-']);
        if (parts.length > 1 && parts[0] !== '') {
            let result = await this.evaluateExpressionAsync(parts[0]);
            for (let i = 1; i < parts.length; i++) {
                const op = parts[i][0];
                const term = await this.evaluateExpressionAsync(parts[i].substring(1));
                if (op === '+') result = this.add(result, term);
                else if (op === '-') result = this.subtract(result, term);
            }
            return result;
        }

        parts = this.splitTopLevel(expr, ['*', '/']);
        if (parts.length > 1 && parts[0] !== '') {
            let result = await this.evaluateExpressionAsync(parts[0]);
            for (let i = 1; i < parts.length; i++) {
                const op = parts[i][0];
                const term = await this.evaluateExpressionAsync(parts[i].substring(1));
                if (op === '*') result = this.multiply(result, term);
                else if (op === '/') result = this.divide(result, term);
            }
            return result;
        }

        const implicitMatch = expr.match(/^(\d+\.?\d*)\s*([a-zA-Z_]\w*)$/);
        if (implicitMatch) {
            const scalar = this.getVariable(implicitMatch[1]);
            const variable = this.getVariable(implicitMatch[2]);
            return this.multiply(scalar, variable);
        }

        const unaryMatch = expr.match(/^-(.+)$/);
        if (unaryMatch) {
            const variable = await this.evaluateExpressionAsync(unaryMatch[1]);
            if (variable.type === 'scalar') {
                return { type: 'scalar', value: -variable.value };
            }
            return this.multiply({ type: 'scalar', value: -1 }, variable);
        }

        const funcNameMatch = expr.match(/^([a-zA-Z_]\w*)\s*\(/);
        if (funcNameMatch && expr.endsWith(')')) {
            const openIdx = expr.indexOf('(');
            let depth = 0;
            let valid = true;
            for (let i = openIdx; i < expr.length; i++) {
                const ch = expr[i];
                if (ch === '(') depth++;
                else if (ch === ')') depth--;
                if (depth < 0) { valid = false; break; }
                if (depth === 0 && i < expr.length - 1) { valid = false; break; }
            }
            if (valid && depth === 0) {
                const funcName = funcNameMatch[1];
                const argString = expr.slice(openIdx + 1, -1);
                return await this.evaluateFunctionAsync(funcName, argString);
            }
        }

        return this.getVariable(expr);
    }

    evaluateFunction(funcName, args) {
        funcName = funcName.toLowerCase();
        
        
        let argList = this.splitTopLevel(args, [','])
            .map(a => (a[0] === ',' ? a.slice(1) : a).trim())
            .filter(a => a.length > 0);

        
        if (funcName === 'proj' && argList.length === 1 && args.includes('.')) {
            const dotParts = this.splitTopLevel(args, ['.'])
                .map(a => (a[0] === '.' ? a.slice(1) : a).trim())
                .filter(a => a.length > 0);
            
            if (
                dotParts.length === 2 &&
                dotParts.every(tok => /^(?:[a-zA-Z_]\w*|\([^]*\)|\[[^]*\])$/.test(tok))
            ) {
                argList = dotParts;
            }
        }

        switch (funcName) {
            case 'inv': {
                const matrixVar = this.getVariable(argList[0]);
                if (matrixVar.type !== 'matrix') throw new Error("inv() requires a matrix argument.");
                const A = matrixVar.value;
                if (!A || A.length === 0 || A.length !== A[0].length) throw new Error('Inverse requires a square matrix.');
                const inv = this.engine.matrixInverse(A);
                if (!inv) throw new Error('Matrix is singular (non-invertible).');
                
                return { type: 'matrix', value: inv, latex: `$$${matrixVar.name}^{-1} = ${this.matrixToLatex(inv).replace(/^\$\$|\$\$/g,'') }$$` };
            }
            case 'rref': {
                const matrixVar = this.getVariable(argList[0]);
                if (matrixVar.type !== 'matrix') throw new Error("rref() requires a matrix argument.");
                const R = this.engine.rref(matrixVar.value);
                return { type: 'matrix', value: R };
            }
            case 'dot': {
                const [v1, v2] = this.getVectorArgs(argList, 2);
                const result = this.engine.dotProduct(v1.value, v2.value);
                const [a1,a2,a3] = v1.value.map(n => +n);
                const [b1,b2,b3] = v2.value.map(n => +n);
                const m1 = a1*b1, m2 = a2*b2, m3 = a3*b3;
                const steps = [
                    `$$${v1.name} = \\begin{pmatrix} ${a1} \\\\ ${a2} \\\\ ${a3} \\end{pmatrix},\quad ${v2.name} = \\begin{pmatrix} ${b1} \\\\ ${b2} \\\\ ${b3} \\end{pmatrix}$$`,
                    `$$${v1.name} \\cdot ${v2.name} = ${a1}\\cdot${b1} + ${a2}\\cdot${b2} + ${a3}\\cdot${b3}$$`,
                    `$$= ${m1.toFixed(3)} + ${m2.toFixed(3)} + ${m3.toFixed(3)}$$`,
                    `$$= ${(m1+m2+m3).toFixed(3)}$$`
                ];
                return { type: 'scalar', value: result, latex: `$$${v1.name} \\cdot ${v2.name} = ${result.toFixed(3)}$$`, steps };
            }
            case 'det': {
                const matrixVar = this.getVariable(argList[0]);
                if (matrixVar.type !== 'matrix') throw new Error("det() requires a matrix argument.");
                const M = matrixVar.value;
                const detValue = this.engine.determinant(M);
                let steps = [];
                if (Array.isArray(M) && M.length === 2 && M[0].length === 2) {
                    const [[a,b],[c,d]] = M;
                    steps = [
                        `$$det(${matrixVar.name}) = \begin{vmatrix} ${a} & ${b} \\ ${c} & ${d} \end{vmatrix}$$`,
                        `$$= (${a}\\cdot${d}) - (${b}\\cdot${c})$$`,
                        `$$= ${(a*d).toFixed(3)} - ${(b*c).toFixed(3)}$$`,
                        `$$= ${(a*d - b*c).toFixed(3)}$$`
                    ];
                } else if (Array.isArray(M) && M.length === 3 && M[0].length === 3) {
                    const [[a,b,c],[d,e,f],[g,h,i]] = M;
                    
                    steps = [
                        `$$det(${matrixVar.name}) = \begin{vmatrix} ${a} & ${b} & ${c} \\ ${d} & ${e} & ${f} \\ ${g} & ${h} & ${i} \end{vmatrix}$$`,
                        `$$= ${a}\,\begin{vmatrix} ${e} & ${f} \\ ${h} & ${i} \end{vmatrix} - ${b}\,\begin{vmatrix} ${d} & ${f} \\ ${g} & ${i} \end{vmatrix} + ${c}\,\begin{vmatrix} ${d} & ${e} \\ ${g} & ${h} \end{vmatrix}$$`,
                        `$$= ${a}(${(e*i - f*h).toFixed(3)}) - ${b}(${(d*i - f*g).toFixed(3)}) + ${c}(${(d*h - e*g).toFixed(3)})$$`,
                        `$$= ${(a*(e*i - f*h) - b*(d*i - f*g) + c*(d*h - e*g)).toFixed(3)}$$`
                    ];
                }
                return { type: 'scalar', value: detValue, latex: `$$det(${matrixVar.name}) = ${detValue.toFixed(3)}$$`, visualize: { type: 'determinant', matrix: M, det: detValue }, steps };
            }
            case 'eigen': {
                const matrixVar = this.getVariable(argList[0]);
                if (matrixVar.type !== 'matrix') throw new Error("eigen() requires a matrix argument.");
                const { values, vectors } = this.engine.eigenDecomposition(matrixVar.value);
                return { type: 'eigen_decomposition', latex: `$$Eigenvalues(\\lambda): ${values.map(v => v.toFixed(2)).join(', ')}$$`, visualize: { type: 'eigenvectors', matrix: matrixVar.value, values, vectors } };
            }
            case 'cross': {
                const [v1, v2] = this.getVectorArgs(argList, 2);
                const result = this.engine.crossProduct(v1.value, v2.value);
                const [a1,a2,a3] = v1.value.map(n => +n);
                const [b1,b2,b3] = v2.value.map(n => +n);
                const cx = a2*b3 - a3*b2;
                const cy = -(a1*b3 - a3*b1);
                const cz = a1*b2 - a2*b1;
                const steps = [
                    `$$${v1.name}\\times${v2.name} = \begin{vmatrix} \mathbf{i} & \mathbf{j} & \mathbf{k} \\ ${a1} & ${a2} & ${a3} \\ ${b1} & ${b2} & ${b3} \end{vmatrix}$$`,
                    `$$= ( ${a2}\\cdot${b3} - ${a3}\\cdot${b2} )\,\mathbf{i} - ( ${a1}\\cdot${b3} - ${a3}\\cdot${b1} )\,\mathbf{j} + ( ${a1}\\cdot${b2} - ${a2}\\cdot${b1} )\,\mathbf{k}$$`,
                    `$$= ( ${ (a2*b3).toFixed(3)} - ${(a3*b2).toFixed(3)} )\,\mathbf{i} - ( ${(a1*b3).toFixed(3)} - ${(a3*b1).toFixed(3)} )\,\mathbf{j} + ( ${(a1*b2).toFixed(3)} - ${(a2*b1).toFixed(3)} )\,\mathbf{k}$$`,
                    `$$= ${cx.toFixed(3)}\,\mathbf{i} + ${cy.toFixed(3)}\,\mathbf{j} + ${cz.toFixed(3)}\,\mathbf{k}$$`
                ];
                return { type: 'vector', value: result, steps };
            }
            case 'proj': {
                if (argList.length !== 2) throw new Error("proj() requires exactly two arguments (use 'proj(a,b)' or 'proj(a.b)').");
                const v1 = this.getVariable(argList[0]);
                const v2 = this.getVariable(argList[1]);
                if (v1.type !== 'vector') throw new Error("First argument of proj() must be a vector.");
                if (v2.type === 'vector') {
                    const result = this.engine.projection(v1.value, v2.value);
                    return { type: 'vector', value: result, visualize: { type: 'projection', from: v1.value, onto: v2.value, result: result } };
                } else if (v2.type === 'matrix') {
                    const basis = this.engine.transpose(v2.value);
                    const result = this.engine.projectOnSubspace(v1.value, basis);
                    return { type: 'vector', value: result, visualize: { type: 'subspace_projection', from: v1.value, subspaceBasis: basis, result: result } };
                } else throw new Error("Second argument of proj() must be a vector or a matrix.");
            }
            case 'norm': {
                 const [v1] = this.getVectorArgs(argList, 1);
                 const [x,y,z] = v1.value.map(n => +n);
                 const sumsq = x*x + y*y + z*z;
                 const result = Math.sqrt(sumsq);
                 const steps = [
                    `$$\\lVert ${v1.name} \\rVert = \\sqrt{x^2 + y^2 + z^2}$$`,
                    `$$= \\sqrt{(${x})^2 + (${y})^2 + (${z})^2}$$`,
                    `$$= \\sqrt{${(x*x).toFixed(3)} + ${(y*y).toFixed(3)} + ${(z*z).toFixed(3)}}$$`,
                    `$$= \\sqrt{${sumsq.toFixed(3)}}$$`
                 ];
                 return { type: 'scalar', value: result, latex: `$$\\lVert${v1.name}\\rVert = ${result.toFixed(3)}$$`, steps };
            }
            case 'span': {
                const vectors = this.getVectorArgs(argList);
                if (vectors.length === 0) throw new Error("span() requires at least one vector.");
                return { type: 'span', vectors: vectors.map(v => v.value), latex: `$$span\\{${vectors.map(v => v.name).join(', ')}\\}$$`, visualize: { type: 'span', vectors: vectors.map(v => v.value) } };
            }
            case 'solve': {
                if (argList.length !== 2) throw new Error("solve() requires two arguments: solve(A, b)");
                const matrixVar = this.getVariable(argList[0]);
                const vectorVar = this.getVariable(argList[1]);
                if (matrixVar.type !== 'matrix' || vectorVar.type !== 'vector') throw new Error("Usage: solve(Matrix, vector)");
                const A = matrixVar.value;
                const b = vectorVar.value;
                if (!Array.isArray(A) || A.length === 0 || !Array.isArray(A[0])) throw new Error('Invalid matrix for solve().');
                if (!Array.isArray(b) || b.length !== A.length) throw new Error('Vector length must equal number of rows of A.');
                const x = this.engine.leastSquares(A, b);
                return { type: 'vector', value: x, visualize: { type: 'least_squares', matrix: A, b, result: x } };
            }
            case 'leastsquares': {
                const matrixVar = this.getVariable(argList[0]);
                const vectorVar = this.getVariable(argList[1]);
                if (matrixVar.type !== 'matrix' || vectorVar.type !== 'vector') throw new Error("Usage: leastsquares(Matrix, vector)");
                const result = this.engine.leastSquares(matrixVar.value, vectorVar.value);
                return { type: 'vector', value: result, visualize: { type: 'least_squares', matrix: matrixVar.value, b: vectorVar.value, result: result } };
            }
            case 'orthcomp': {
                const target = this.getVariable(argList[0]);
                let basis, complement;
                if (target.type === 'vector') {
                    basis = [target.value];
                    const temp = Math.abs(target.value[0]) > 0.1 ? [0,1,0] : [1,0,0];
                    const p1 = this.engine.crossProduct(target.value, temp);
                    const p2 = this.engine.crossProduct(target.value, p1);
                    complement = [p1,p2];
                } else if (target.type === 'matrix') {
                    basis = this.engine.transpose(target.value);
                    if (basis.length !== 2) throw new Error("Orthogonal complement is only visualized for planes (from 3x2 matrices).");
                    complement = [this.engine.crossProduct(basis[0], basis[1])];
                } else throw new Error("orthcomp() requires a vector or matrix argument.");
                return { type: 'orthogonal_complement', latex: `$$Orthogonal\\,complement\\,of\\,${target.name}$$`, visualize: { type: 'orthogonal_complement', basis: basis, complement: complement } };
            }
            case 'gramschmidt': {
                const vectors = this.getVectorArgs(argList);
                if (vectors.length < 2) throw new Error("Gram-Schmidt requires at least two vectors.");
                const originalVectors = vectors.map(v => v.value);
                const orthonormalVectors = this.engine.gramSchmidt(originalVectors);
                return { type: 'orthonormal_basis', value: orthonormalVectors, visualize: { type: 'gram_schmidt', original: originalVectors, final: orthonormalVectors } };
            }
            case 'rank': {
                const matrixVar = this.getVariable(argList[0]);
                if (matrixVar.type !== 'matrix') throw new Error("rank() requires a matrix argument.");
                const rankValue = this.engine.rank(matrixVar.value);
                return { type: 'scalar', value: rankValue, latex: `$$rank(${matrixVar.name}) = ${rankValue}$$`, visualize: { type: 'rank', matrix: matrixVar.value } };
            }
            case 'svd': {
                const matrixVar = this.getVariable(argList[0]);
                if (matrixVar.type !== 'matrix') throw new Error("svd() requires a matrix argument.");
                const { U, S, Vt } = this.engine.svd(matrixVar.value);
                return { type: 'svd_decomposition', latex: `$$SVD\\,of\\,${matrixVar.name}:\\,see\\,visualization$$`, visualize: { type: 'svd', U, S, Vt } };
            }
            case 'quadric': {
                const matrixVar = this.getVariable(argList[0]);
                if (matrixVar.type !== 'matrix') throw new Error("quadric() requires a matrix argument.");
                if (!this.engine.isSymmetric(matrixVar.value)) throw new Error("Quadric surface visualization requires a symmetric matrix.");
                return { type: 'quadric_surface', latex: `$$Visualizing\\,x^T${matrixVar.name}x=1$$`, visualize: { type: 'quadric', matrix: matrixVar.value } };
            }
            case 'colspace': {
                const matrixVar = this.getVariable(argList[0]);
                if (matrixVar.type !== 'matrix') throw new Error("colspace() requires a matrix argument.");
                return { type: 'column_space', latex: `$$Column\\,Space\\,of\\,${matrixVar.name}$$`, visualize: { type: 'column_space', matrix: matrixVar.value } };
            }
            case 'nullspace': {
                const matrixVar = this.getVariable(argList[0]);
                if (matrixVar.type !== 'matrix') throw new Error("nullspace() requires a matrix argument.");
                const basis = this.engine.nullSpace(matrixVar.value);
                return { type: 'null_space', latex: `$$Null\\,Space\\,Basis\\,of\\,${matrixVar.name}$$`, visualize: { type: 'null_space', basis: basis } };
            }
            case 'basis': {
                const show = args.toLowerCase() === 'on' || args === 'true' || args === '1';
                return { type: 'basis_toggle', latex: `$$Basis\\,vectors\\,${show ? 'shown' : 'hidden'}$$`, visualize: { type: 'basis', show: show } };
            }
            case 'transform': {
                const matrixVar = this.getVariable(argList[0]);
                if (matrixVar.type !== 'matrix') throw new Error("transform() requires a matrix argument.");
                return { type: 'transformation', latex: `$$Applying\\,transformation\\,with\\,${matrixVar.name}$$`, visualize: { type: 'transformation', matrix: matrixVar.value } };
            }
            case 'reset': {
                 return { type: 'transformation', latex: `$$Resetting\\,grid$$`, visualize: { type: 'transformation', matrix: [[1,0,0],[0,1,0],[0,0,1]] } };
            }
            default:
                throw new Error(`Unknown function '${funcName}'`);
        }
    }

    
    parseMatrixLiteral(content, name = null) {
        let matrix;
        const hasNestedBrackets = content.includes('[');
        if (!hasNestedBrackets) {
            
            
            if (content.includes(';')) {
                
                const rowTokens = this.splitTopLevel(content, [';'])
                    .map(a => (a[0] === ';' ? a.slice(1) : a).trim())
                    .filter(Boolean);
                const rows = rowTokens.map(tok => {
                    const res = this.evaluateExpression(tok);
                    if (!res || res.type !== 'vector') throw new Error(`'${tok}' did not evaluate to a vector`);
                    return res.value.slice();
                });
                
                const cols = rows[0]?.length || 0;
                if (!rows.every(r => r.length === cols)) throw new Error('Row vectors must have equal length.');
                matrix = rows;
            } else {
                
                const colTokens = this.splitTopLevel(content, [','])
                    .map(a => (a[0] === ',' ? a.slice(1) : a).trim())
                    .filter(Boolean);
                const cols = colTokens.map(tok => {
                    const res = this.evaluateExpression(tok);
                    if (!res || res.type !== 'vector') throw new Error(`'${tok}' did not evaluate to a vector`);
                    return res.value.slice();
                });
                
                const rowsLen = cols[0]?.length || 0;
                if (!cols.every(c => c.length === rowsLen)) throw new Error('Column vectors must have equal length.');
                matrix = this.engine.transpose(cols);
            }
        } else {
            
            
            const rows = [];
            let depth = 0, start = 0;
            for (let i = 0; i < content.length; i++) {
                const ch = content[i];
                if (ch === '[') {
                    if (depth === 0) start = i + 1; 
                    depth++;
                } else if (ch === ']') {
                    depth--;
                    if (depth === 0) {
                        const rowInner = content.slice(start, i);
                        
                        const cellTokens = this.splitTopLevel(rowInner, [','])
                            .map(a => (a[0] === ',' ? a.slice(1) : a).trim())
                            .filter(Boolean);
                        const rowVals = cellTokens.map(tok => {
                            const res = this.evaluateExpression(tok);
                            if (res.type !== 'scalar') throw new Error('Matrix cells must be scalars.');
                            return +res.value;
                        });
                        rows.push(rowVals);
                    }
                }
            }
            if (rows.length === 0) throw new Error('Invalid matrix literal.');
            const cols = rows[0].length;
            if (!rows.every(r => r.length === cols)) throw new Error('All rows must have the same number of columns.');
            matrix = rows;
        }
        if (!Array.isArray(matrix) || !Array.isArray(matrix[0])) throw new Error('Invalid matrix format.');
        const creationMethod = content.includes(';') ? 'rows' : 'columns';
        const steps = name ? [`$$Created\,matrix\,${name}\,(${creationMethod})$$`] : undefined;
        return { type: 'matrix', name: name, value: matrix, steps };
    }

    add(a, b) {
        if (a.type === 'vector' && b.type === 'vector') return { type: 'vector', value: a.value.map((v, i) => v + b.value[i]) };
        throw new Error(`Cannot add ${a.type} and ${b.type}`);
    }

    subtract(a, b) {
        if (a.type === 'vector' && b.type === 'vector') return { type: 'vector', value: a.value.map((v, i) => v - b.value[i]) };
        throw new Error(`Cannot subtract ${b.type} from ${a.type}`);
    }

    multiply(a, b) {
        if (a.type === 'scalar' && b.type === 'vector') return { type: 'vector', value: b.value.map(v => v * a.value) };
        if (a.type === 'vector' && b.type === 'scalar') return { type: 'vector', value: a.value.map(v => v * b.value) };
        if (a.type === 'scalar' && b.type === 'matrix') return { type: 'matrix', value: this.engine.scalarMultiplyMatrix(a.value, b.value) };
        if (a.type === 'matrix' && b.type === 'scalar') return { type: 'matrix', value: this.engine.scalarMultiplyMatrix(b.value, a.value) };
        if (a.type === 'matrix' && b.type === 'vector') return { type: 'vector', value: this.engine.matrixVectorMultiply(a.value, b.value) };
        if (a.type === 'matrix' && b.type === 'matrix') return { type: 'matrix', value: this.engine.matrixMultiply(a.value, b.value) };
        throw new Error(`Cannot multiply ${a.type} and ${b.type}`);
    }

    divide(a, b) {
        if (a.type === 'vector' && b.type === 'scalar') return { type: 'vector', value: a.value.map(v => v / b.value) };
        if (a.type === 'matrix' && b.type === 'scalar') return { type: 'matrix', value: this.engine.scalarDivideMatrix(a.value, b.value) };
        throw new Error(`Cannot divide ${a.type} by ${b.type}.`);
    }

    getVariable(name) {
        if (typeof name !== 'string') throw new Error("Invalid variable name provided.");
        name = name.trim();
        
        
        if (this.sceneObjects[name]) {
            const obj = this.sceneObjects[name];
            if (obj.type === 'vector') {
                
                if (Array.isArray(obj.raw)) {
                    return { type: 'vector', name: name, value: obj.raw.slice() };
                }
                
                const v = obj.value;
                if (Array.isArray(v)) {
                    return { type: 'vector', name: name, value: v.slice() };
                }
                if (v && typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number') {
                    
                    return { type: 'vector', name: name, value: [v.x, v.z, v.y] };
                }
                
                return { type: 'vector', name: name, value: [] };
            }
            if (obj.type === 'matrix') {
                return { type: 'matrix', name: name, value: obj.value };
            }
            if (obj.type === 'plane') {
                const n = Array.isArray(obj.normal) ? obj.normal.slice() : [0,0,1];
                const d = Number(obj.offset) || 0;
                return { type: 'plane', name: name, value: { normal: n, offset: d } };
            }
        }
        
        
        let match = name.match(/^\(([^]*)\)$/);
        if (match) {
            
            const inner = match[1];
            const parts = this.splitTopLevel(inner, [','])
                .map(a => (a[0] === ',' ? a.slice(1) : a).trim())
                .filter(a => a.length > 0);
            const values = parts.map(tok => {
                const res = this.evaluateExpression(tok);
                if (res.type !== 'scalar') throw new Error('Vector components must be scalars.');
                return +res.value;
            });
            return { type: 'vector', value: values };
        }
        
        match = name.match(/^\[(.+)\]$/);
        if (match) {
            return this.parseMatrixLiteral(match[1].trim());
        }
        
        const num = parseFloat(name);
        if (!isNaN(num)) {
            return { type: 'scalar', value: num };
        }
        
        throw new Error(`Variable '${name}' not found`);
    }


    getVectorArgs(argList, expectedCount = null) {
        if (expectedCount && argList.length !== expectedCount) {
            throw new Error(`Expected ${expectedCount} vector arguments, but got ${argList.length}`);
        }
        return argList.map(name => {
            const v = this.getVariable(name);
            if (v.type !== 'vector') throw new Error(`'${name}' is not a vector`);
            return v;
        });
    }

    vectorToLatex(vector, name = '') {
        const values = vector.map(v => v.toFixed(2)).join(' \\\\ ');
        const latex = `\\begin{pmatrix} ${values} \\end{pmatrix}`;
        return name ? `$$${name} = ${latex}$$` : `$$${latex}$$`;
    }

    matrixToLatex(matrix, name = '') {
        const rows = matrix.map(row => 
            row.map(v => v.toFixed(2)).join(' & ')
        ).join(' \\\\ ');
        const latex = `\\begin{pmatrix} ${rows} \\end{pmatrix}`;
        return name ? `$$${name} = ${latex}$$` : `$$${latex}$$`;
    }


        preprocess(command) {
        
        
        command = command.replace(/(\(|\[)[^()\[\]]*(\)|\])/g, (match) => {
            return match.replace(/\s/g, '');
        });

        
        command = command.replace(/([\+\-\*\/])/g, ' $1 ');
        
        
        command = command.replace(/(\d+\.?\d*)\s*([a-zA-Z_]\w*)/g, '$1 * $2');
        
        
        command = command.replace(/(^|[\(\=\+\-\*\/])\s*-\s*([a-zA-Z_]\w*)/g, '$1 -1 * $2');

        
        return command.trim().replace(/\s+/g, ' ');
    }
    
    formatResult(name, result) {
        
        let latex = result.latex || '';
        let rawOutput = result.rawOutput || '';
        
        if (result.type === 'vector') {
            latex = this.vectorToLatex(result.value, name);
            rawOutput = `${name}=[${result.value.map(v => v.toFixed(2)).join(',')}]`;
        }
        else if (result.type === 'matrix') {
            latex = this.matrixToLatex(result.value, name);
            
            const rows = result.value.map(row => `[${row.map(v => v.toFixed(2)).join(',')}]`);
            rawOutput = `${name}=[${rows.join(',')}]`;
        }
        else if (result.type === 'plane') {
            const n = Array.isArray(result.value?.normal) ? result.value.normal : [];
            const d = Number(result.value?.offset) || 0;
            const nList = n.map(v => (Number(v)||0).toFixed(2)).join(', ');
            
            latex = `$$${name} : (${nList}) \\cdot x = ${d.toFixed(3)}$$`;
            
            rawOutput = `${name}: n=(${nList}), d=${d.toFixed(3)}`;
        }

        const response = {
            success: true,
            type: result.type,
            value: result.value,
            latex: latex,
            rawOutput: rawOutput,
            visualize: result.visualize,
            steps: result.steps
        };
        if (name) response.name = name;
        return response;
    }

    
    findTopLevelEquality(expr) {
        let depthPar = 0, depthBr = 0;
        for (let i = 0; i < expr.length - 1; i++) {
            const c = expr[i];
            if (c === '(') depthPar++;
            else if (c === ')') depthPar = Math.max(0, depthPar - 1);
            else if (c === '[') depthBr++;
            else if (c === ']') depthBr = Math.max(0, depthBr - 1);
            else if (c === '=' && expr[i+1] === '=' && depthPar === 0 && depthBr === 0) {
                return i;
            }
        }
        return -1;
    }
}
