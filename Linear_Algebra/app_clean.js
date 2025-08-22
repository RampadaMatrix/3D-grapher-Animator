

let scene, camera, renderer, controls;
let sceneMeshes = {};
let sceneMeshes2D = {};
let sceneObjects = {};
let temporaryVisuals = new THREE.Group(), temporaryVisuals2D = new THREE.Group();
let intersectionVisuals = new THREE.Group();
let is2DMode = false;
let currentGridSize = 10;
let gridHelper, gridHelper2D;
let hoveredObject = null;
let hoveredObjectPrevious = null;
let hoverTooltip, hoverTooltipContent;
let hoverHideTimeout = null;
const HOVER_HIDE_DELAY_MS = 120;
const HOVER_INTERVAL_MS = 50;
let nextPlaneColorIndex = 0;


const PLANE_COLORS = [
    { base: 0x3b82f6, name: 'Blue' },      
    { base: 0xef4444, name: 'Red' },       
    { base: 0x10b981, name: 'Emerald' },   
    { base: 0xf59e0b, name: 'Amber' },     
    { base: 0x8b5cf6, name: 'Violet' },    
    { base: 0xf97316, name: 'Orange' },    
    { base: 0x06b6d4, name: 'Cyan' },      
    { base: 0xec4899, name: 'Pink' },      
    { base: 0x84cc16, name: 'Lime' },      
    { base: 0x6366f1, name: 'Indigo' }     
];


const PLANE_PATTERNS = [
    'solid',
    'diagonal',
    'grid',
    'dots',
    'waves'
];

let transformationGrid, axesHelper;
let transformationGrid2D, axesHelper2D;
let mainGridPlane = null; 
let currentGridDivisions = 20;
let gridLabels = [];
let gridLabels2D = [];
let raycaster, mouse;
let isDragging = false, selectedVectorKey = null;
let dragPlane = new THREE.Plane();
let basisVectors = new THREE.Group();
let basisVectors2D = new THREE.Group();

let vectorOrigins = {};
const availableColors = [0xff6b6b, 0x51cf66, 0x339af0, 0xfab005, 0xcc5de8, 0x22b8cf];
let nextColorIndex = 0;

const AXIS_COLOR_X = new THREE.Color(0xfb7185); 
const AXIS_COLOR_Y = new THREE.Color(0x60a5fa); 
const AXIS_COLOR_Z = new THREE.Color(0x4ade80); 
let currentEditKey = null;
let createMode = null;

let multiOverlayEnabled = true; 
let axisTicks3D = null; 


const ENABLE_3D_ENHANCEMENTS = false;


const ENH = {
    axisTicks: false,        
    dashedHelpers: true,     
    labels: true,            
    spanExplorer: false,     
    spanGrid: false,         
    vectorLabels: false      
};

function enh(name) {
    
    return ENABLE_3D_ENHANCEMENTS || !!(ENH && ENH[name]);
}


function visualizePlaneIntersectionLine(point, direction, planes) {
    
    if (is2DMode) { addTextLabel('Intersection line shown in 3D mode only', new THREE.Vector3(0, 2, 0), '#f59e0b', 14); return; }
    maybeClearTemporaryVisuals();
    const [px, py, pz] = point;
    const [vx, vy, vz] = direction;
    
    const p0 = new THREE.Vector3(px, pz, py);
    const v = new THREE.Vector3(vx, vz, vy).normalize();
    const L = 20; 
    const a = p0.clone().add(v.clone().multiplyScalar(-L));
    const b = p0.clone().add(v.clone().multiplyScalar(L));
    const geom = new THREE.BufferGeometry().setFromPoints([a, b]);
    const blendedColor = blendPlaneColors(planes);
    const mat = new THREE.LineBasicMaterial({ color: blendedColor, linewidth: 3 });
    const line = new THREE.Line(geom, mat);
    line.renderOrder = 9990;
    if (line.material) { line.material.depthTest = false; }
    
    line.userData = { role: 'intersection_line' };

    
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), new THREE.MeshBasicMaterial({ color: blendedColor }));
    dot.position.copy(p0);
    dot.renderOrder = 9991;
    if (dot.material) { dot.material.depthTest = false; }
    dot.userData = { role: 'intersection_point' };

    
    const label = planes && planes.length ? `Intersection line of ${planes.join(' ∩ ')}` : 'Intersection line';
    const colorHex = '#' + blendedColor.toString(16).padStart(6, '0');
    const text = addTextLabel(label, p0.clone().add(new THREE.Vector3(0.2, 0.2, 0)), colorHex, 18);
    text.renderOrder = 9992;

    
    const intGroup = new THREE.Group();
    intGroup.userData = {
        type: 'intersection_line',
        planes: planes || [],
        point: Array.isArray(point) ? point.slice(0,3) : undefined,
        direction: Array.isArray(direction) ? direction.slice(0,3) : undefined
    };
    intGroup.renderOrder = 9990;
    intGroup.add(line);
    intGroup.add(dot);
    intGroup.add(text);
    temporaryVisuals.add(intGroup);
}

function visualizePlaneIntersectionPoint(point, planes) {
    if (is2DMode) { addTextLabel('Intersection point shown in 3D mode only', new THREE.Vector3(0, 2, 0), '#f59e0b', 14); return; }
    maybeClearTemporaryVisuals();
    const [px, py, pz] = point;
    const p = new THREE.Vector3(px, pz, py);
    const blendedColor = blendPlaneColors(planes);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 24), new THREE.MeshBasicMaterial({ color: blendedColor }));
    sphere.position.copy(p);
    sphere.renderOrder = 9991;
    if (sphere.material) { sphere.material.depthTest = false; }
    sphere.userData = { role: 'intersection_point' };

    const label = planes && planes.length ? `Intersection point of ${planes.join(' ∩ ')}` : 'Intersection point';
    const colorHex = '#' + blendedColor.toString(16).padStart(6, '0');
    const text = addTextLabel(label, p.clone().add(new THREE.Vector3(0.2, 0.2, 0)), colorHex, 18);
    text.renderOrder = 9992;

    const intGroup = new THREE.Group();
    intGroup.userData = {
        type: 'intersection_point',
        planes: planes || [],
        point: Array.isArray(point) ? point.slice(0,3) : undefined
    };
    intGroup.renderOrder = 9990;
    intGroup.add(sphere);
    intGroup.add(text);
    temporaryVisuals.add(intGroup);
}


function autoDetectPlaneIntersections() {
    
    Object.keys(sceneObjects).forEach(key => {
        if (key.startsWith('L_') || key.startsWith('P_')) {
            delete sceneObjects[key];
        }
    });
    
    
    const planes = [];
    Object.entries(sceneObjects).forEach(([key, obj]) => {
        if (obj.type === 'plane' && obj.visible) {
            const dim = Number(obj.dim || (Array.isArray(obj.normal) ? obj.normal.length : 0));
            if (dim === 3) {
                planes.push({ key, obj });
            }
        }
    });
    
    if (planes.length < 2) return; 
    
    
    for (let i = 0; i < planes.length; i++) {
        for (let j = i + 1; j < planes.length; j++) {
            const plane1 = planes[i];
            const plane2 = planes[j];
            
            try {
                const intersection = calculateTwoPlaneIntersection(plane1.obj, plane2.obj);
                if (intersection && intersection.type === 'line') {
                    
                    const lineKey = `L_${plane1.key}∩${plane2.key}`;
                    sceneObjects[lineKey] = {
                        type: 'line',
                        point: intersection.point,
                        direction: intersection.direction,
                        planes: [plane1.key, plane2.key],
                        visible: true,
                        color: blendPlaneColors([plane1.key, plane2.key]), 
                        autoGenerated: true
                    };
                    
                    visualizePlaneIntersectionLine(
                        intersection.point, 
                        intersection.direction, 
                        [plane1.key, plane2.key]
                    );
                }
            } catch (e) {
                
            }
        }
    }
    
    
    for (let i = 0; i < planes.length; i++) {
        for (let j = i + 1; j < planes.length; j++) {
            for (let k = j + 1; k < planes.length; k++) {
                const plane1 = planes[i];
                const plane2 = planes[j];
                const plane3 = planes[k];
                
                try {
                    const intersection = calculateThreePlaneIntersection(plane1.obj, plane2.obj, plane3.obj);
                    if (intersection && intersection.type === 'point') {
                        
                        const pointKey = `P_${plane1.key}∩${plane2.key}∩${plane3.key}`;
                        sceneObjects[pointKey] = {
                            type: 'point',
                            value: intersection.point,
                            planes: [plane1.key, plane2.key, plane3.key],
                            visible: true,
                            color: blendPlaneColors([plane1.key, plane2.key, plane3.key]), 
                            autoGenerated: true
                        };
                        
                        visualizePlaneIntersectionPoint(
                            intersection.point, 
                            [plane1.key, plane2.key, plane3.key]
                        );
                    }
                } catch (e) {
                    
                }
            }
        }
    }
    
    
    updateObjectListUI();
}

function calculateTwoPlaneIntersection(plane1, plane2) {
    const n1 = Array.isArray(plane1.normal) ? plane1.normal.map(Number) : [0, 0, 1];
    const n2 = Array.isArray(plane2.normal) ? plane2.normal.map(Number) : [0, 0, 1];
    const d1 = Number(plane1.offset) || 0;
    const d2 = Number(plane2.offset) || 0;
    
    
    const cross = [
        n1[1] * n2[2] - n1[2] * n2[1],
        n1[2] * n2[0] - n1[0] * n2[2],
        n1[0] * n2[1] - n1[1] * n2[0]
    ];
    
    const crossLen = Math.sqrt(cross[0]*cross[0] + cross[1]*cross[1] + cross[2]*cross[2]);
    if (crossLen < 1e-9) {
        return null; 
    }
    
    const v = cross.map(c => c / crossLen); 
    
    
    const n2xv = [
        n2[1] * v[2] - n2[2] * v[1],
        n2[2] * v[0] - n2[0] * v[2],
        n2[0] * v[1] - n2[1] * v[0]
    ];
    const vxn1 = [
        v[1] * n1[2] - v[2] * n1[1],
        v[2] * n1[0] - v[0] * n1[2],
        v[0] * n1[1] - v[1] * n1[0]
    ];
    
    const numerator = [
        d1 * n2xv[0] + d2 * vxn1[0],
        d1 * n2xv[1] + d2 * vxn1[1],
        d1 * n2xv[2] + d2 * vxn1[2]
    ];
    
    const denom = n1[0] * n2xv[0] + n1[1] * n2xv[1] + n1[2] * n2xv[2];
    if (Math.abs(denom) < 1e-12) {
        return null; 
    }
    
    const p0 = numerator.map(c => c / denom);
    
    return {
        type: 'line',
        point: p0,
        direction: v
    };
}

function calculateThreePlaneIntersection(plane1, plane2, plane3) {
    const N = [
        Array.isArray(plane1.normal) ? plane1.normal.slice(0, 3).map(Number) : [0, 0, 1],
        Array.isArray(plane2.normal) ? plane2.normal.slice(0, 3).map(Number) : [0, 0, 1],
        Array.isArray(plane3.normal) ? plane3.normal.slice(0, 3).map(Number) : [0, 0, 1]
    ];
    const d = [
        Number(plane1.offset) || 0,
        Number(plane2.offset) || 0,
        Number(plane3.offset) || 0
    ];
    
    
    const det = N[0][0] * (N[1][1] * N[2][2] - N[1][2] * N[2][1]) -
                N[0][1] * (N[1][0] * N[2][2] - N[1][2] * N[2][0]) +
                N[0][2] * (N[1][0] * N[2][1] - N[1][1] * N[2][0]);
    
    if (Math.abs(det) < 1e-9) {
        return null; 
    }
    
    
    const x = (d[0] * (N[1][1] * N[2][2] - N[1][2] * N[2][1]) -
               N[0][1] * (d[1] * N[2][2] - N[1][2] * d[2]) +
               N[0][2] * (d[1] * N[2][1] - N[1][1] * d[2])) / det;
    
    const y = (N[0][0] * (d[1] * N[2][2] - N[1][2] * d[2]) -
               d[0] * (N[1][0] * N[2][2] - N[1][2] * N[2][0]) +
               N[0][2] * (N[1][0] * d[2] - d[1] * N[2][0])) / det;
    
    const z = (N[0][0] * (N[1][1] * d[2] - d[1] * N[2][1]) -
               N[0][1] * (N[1][0] * d[2] - d[1] * N[2][0]) +
               d[0] * (N[1][0] * N[2][1] - N[1][1] * N[2][0])) / det;
    
    return {
        type: 'point',
        point: [x, y, z]
    };
}


try { window.ENH = ENH; } catch(_) {}


let parseInFlight = false;
let parseWatchdogTimer = null;
const PARSE_WATCHDOG_MS = 20000; 
let lastCommandText = '';
let commandHistory = [];
let commandHistoryIndex = 0;

let savedCommands = [];


let spanExplorerState = {
    active: false,
    basis: [], 
    basisNames: [],
    plane: new THREE.Plane(),
    targetMesh: null
};


window.addEventListener('error', (e) => {
    console.error('[global error]', e.message, e.error || '');
});
window.addEventListener('unhandledrejection', (e) => {
    console.error('[unhandledrejection]', e.reason);
});


function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function visualizeQR(Q, R, name) {
    
    if (is2DMode) { maybeClear2DTemporaryVisuals(); } else { maybeClearTemporaryVisuals(); }
    const mat = Array.isArray(Q) ? Q : [];
    if (!mat.length || !mat[0].length) { console.warn('[viz][qr] invalid Q'); return; }
    
    const rows = mat.length, cols = mat[0].length;
    const maxCols = Math.min(cols, 3);
    for (let j = 0; j < maxCols; j++) {
        
        const col = [];
        for (let i = 0; i < Math.min(rows, 3); i++) col[i] = mat[i][j];
        while (col.length < 3) col.push(0);
        const v = new THREE.Vector3(col[0], col[2], col[1]); 
        const color = availableColors[j % availableColors.length];
        const arrow = createVectorArrow(v, color);
        temporaryVisuals.add(arrow);
        addTextLabel(`${(name || 'A')}: q${j+1}`, v.clone().multiplyScalar(1.15), `#${color.toString(16)}`, 18);
    }
    
    console.debug('[viz][qr] R matrix:', R);
    try {
        const outputArea = document.getElementById('command-output');
        if (outputArea) {
            const card = document.createElement('div');
            card.className = 'result-card';
            const rowsHtml = (Array.isArray(R) ? R : []).map(r => `<div>${r.map(x => Number(x).toFixed(3)).join('\t')}</div>`).join('');
            card.innerHTML = `<div style="opacity:0.8">R (upper triangular) for ${name || 'A'}:</div>${rowsHtml}`;
            outputArea.appendChild(card);
            outputArea.scrollTop = outputArea.scrollHeight;
        }
    } catch(_) {}
}

function generateSceneBackgroundTexture(colorTop, colorBottom) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, colorTop || '#0b1220');
    gradient.addColorStop(1, colorBottom || '#0f172a');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    return new THREE.CanvasTexture(canvas);
}

function updateSceneBackgroundFromTheme() {
    createDynamicBackground();
    updateAtmosphericEffects();
}

function createDynamicBackground() {
    const isDark = !document.documentElement.classList.contains('light-theme');
    
    if (isDark) {
        
        createStarField();
    } else {
        
        createDayBackground();
    }
}

function createStarField() {
    
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    
    
    const gradient = ctx.createRadialGradient(1024, 1024, 0, 1024, 1024, 1400);
    gradient.addColorStop(0, '#0f0e1a');
    gradient.addColorStop(0.3, '#0a0914');
    gradient.addColorStop(0.6, '#050510');
    gradient.addColorStop(1, '#000000');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2048, 2048);
    
    
    for (let i = 0; i < 5; i++) {
        const x = Math.random() * 2048;
        const y = Math.random() * 2048;
        const size = Math.random() * 400 + 200;
        
        const nebula = ctx.createRadialGradient(x, y, 0, x, y, size);
        nebula.addColorStop(0, 'rgba(99, 102, 241, 0.03)');
        nebula.addColorStop(0.5, 'rgba(139, 92, 246, 0.02)');
        nebula.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = nebula;
        ctx.fillRect(0, 0, 2048, 2048);
    }
    
    
    for (let i = 0; i < 300; i++) {
        const x = Math.random() * 2048;
        const y = Math.random() * 2048;
        const size = Math.random() * 1.5 + 0.3;
        const opacity = Math.random() * 0.9 + 0.1;
        
        
        const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
        glow.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
        glow.addColorStop(0.5, `rgba(200, 220, 255, ${opacity * 0.3})`);
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, size * 3, 0, Math.PI * 2);
        ctx.fill();
        
        
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * 2048;
        const y = Math.random() * 2048;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.lineTo(x + 8, y);
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x, y + 8);
        ctx.stroke();
    }
    
    
    const vg = ctx.createRadialGradient(1024, 1024, 600, 1024, 1024, 1024);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.7, 'rgba(0,0,0,0.2)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, 2048, 2048);
    
    scene.background = new THREE.CanvasTexture(canvas);
}


let groundBackdrop = null;
function createGroundBackdrop() {
    try { if (groundBackdrop) { scene.remove(groundBackdrop); disposeMesh(groundBackdrop); groundBackdrop = null; } } catch(_) {}
    const isDark = !document.documentElement.classList.contains('light-theme');
    const tex = generateGroundRadialTexture(isDark);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 1.0, depthWrite: false });
    const size = 220; 
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.001; 
    mesh.renderOrder = -10; 
    groundBackdrop = mesh;
    scene.add(groundBackdrop);
}

function generateGroundRadialTexture(isDark) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 1024;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(512, 512, 0, 512, 512, 512);
    
    const center = isDark ? 'rgba(56, 189, 248, 0.10)' : 'rgba(2, 132, 199, 0.08)';
    const mid = isDark ? 'rgba(2, 6, 23, 0.0)' : 'rgba(14, 165, 233, 0.02)';
    g.addColorStop(0.0, center);
    g.addColorStop(0.35, mid);
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
}

function updateGroundBackdropTheme() {
    if (!groundBackdrop) return;
    const isDark = !document.documentElement.classList.contains('light-theme');
    const newTex = generateGroundRadialTexture(isDark);
    const oldTex = groundBackdrop.material.map;
    groundBackdrop.material.map = newTex;
    groundBackdrop.material.needsUpdate = true;
    if (oldTex && typeof oldTex.dispose === 'function') oldTex.dispose();
}

function disposeMesh(m) {
    try {
        if (m.material?.map) m.material.map.dispose();
        if (m.material) m.material.dispose();
        if (m.geometry) m.geometry.dispose();
    } catch(_) {}
}

function createDayBackground() {
    
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, '#fefefe');
    gradient.addColorStop(0.6, '#fdfdfd');
    gradient.addColorStop(0.8, '#fbfbfb');
    gradient.addColorStop(1, '#f8f8f8');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 1024);
    
    
    for (let i = 0; i < 800; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 1024;
        const size = Math.random() * 0.8 + 0.2;
        const opacity = Math.random() * 0.015 + 0.005;
        
        ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.008)';
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i < 1024; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 1024);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(1024, i);
        ctx.stroke();
    }
    
    scene.background = new THREE.CanvasTexture(canvas);
}

function setupAtmosphericEffects() {
    const isDark = !document.documentElement.classList.contains('light-theme');
    
    
    scene.fog = null;
    
    
    if (!window.atmosphericParticles) {
        createAtmosphericParticles();
    }
}

function createAtmosphericParticles() {
    const particleCount = 100;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        
        positions[i3] = (Math.random() - 0.5) * 100;
        positions[i3 + 1] = (Math.random() - 0.5) * 100;
        positions[i3 + 2] = (Math.random() - 0.5) * 100;
        
        
        const isDark = !document.documentElement.classList.contains('light-theme');
        if (isDark) {
            colors[i3] = 0.6 + Math.random() * 0.4;
            colors[i3 + 1] = 0.7 + Math.random() * 0.3;
            colors[i3 + 2] = 1.0;
        } else {
            colors[i3] = 1.0;
            colors[i3 + 1] = 1.0;
            colors[i3 + 2] = 0.9 + Math.random() * 0.1;
        }
        
        sizes[i] = Math.random() * 2 + 1;
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const particleMaterial = new THREE.PointsMaterial({
        size: 0.1,
        transparent: true,
        opacity: 0.3,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    window.atmosphericParticles = new THREE.Points(particles, particleMaterial);
    window.atmosphericParticles.renderOrder = -1;
    scene.add(window.atmosphericParticles);
}

function updateAtmosphericEffects() {
    const isDark = !document.documentElement.classList.contains('light-theme');
    
    
    scene.fog = null;
    
    
    if (window.atmosphericParticles) {
        const colors = window.atmosphericParticles.geometry.attributes.color.array;
        for (let i = 0; i < colors.length; i += 3) {
            if (isDark) {
                colors[i] = 0.6 + Math.random() * 0.4;
                colors[i + 1] = 0.7 + Math.random() * 0.3;
                colors[i + 2] = 1.0;
            } else {
                colors[i] = 1.0;
                colors[i + 1] = 1.0;
                colors[i + 2] = 0.9 + Math.random() * 0.1;
            }
        }
        window.atmosphericParticles.geometry.attributes.color.needsUpdate = true;
    }
}

function getThemeGridColors() {
    const isDark = !document.documentElement.classList.contains('light-theme');
    
    const major = isDark ? '#4a5568' : '#94a3b8'; 
    const minor = isDark ? '#2d3748' : '#e2e8f0'; 
    return { major, minor };
}


function cssHexToInt(hex) {
    if (!hex) return 0xffffff;
    const s = (hex + '').trim();
    if (s.startsWith('#')) {
        return parseInt(s.slice(1), 16);
    }
    
    try {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d');
        ctx.fillStyle = s;
        const parsed = ctx.fillStyle; 
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(parsed);
        if (m) {
            const r = (parseInt(m[1]) & 255) << 16;
            const g = (parseInt(m[2]) & 255) << 8;
            const b = (parseInt(m[3]) & 255);
            return r | g | b;
        }
    } catch(_) {}
    return 0xffffff;
}

function getThemeAxisColors2D() {
    const axis = cssVar('--axis-2d') || '#f8fafc';
    const letter = cssVar('--axis-letter') || '#f8fafc';
    const origin = cssVar('--axis-origin') || '#94a3b8';
    return { axis, letter, origin };
}

function updateThemeDependentVisuals() {
    updateSceneBackgroundFromTheme();
    updateResponsiveGrid();
    updateLightingForTheme();
    try { updateGroundBackdropTheme(); } catch(_) {}
    
    if (typeof update2DThemeVisuals === 'function') {
        update2DThemeVisuals();
    }
}

function updateThemeToggleUI() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const isLight = document.documentElement.classList.contains('light-theme');
    if (isLight) {
        btn.title = 'Switch to Dark';
        btn.setAttribute('aria-label', 'Switch to Dark');
        btn.textContent = '🌙';
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
    } else {
        btn.title = 'Switch to Light';
        btn.setAttribute('aria-label', 'Switch to Light');
        btn.textContent = '☀️';
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
    }
}

function setTheme(theme) {
    const root = document.documentElement;
    const isLight = theme === 'light';
    root.classList.toggle('light-theme', isLight);
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeToggleUI();
    updateThemeDependentVisuals();
}

function getSavedTheme() {
    const t = (localStorage.getItem('theme') || '').toLowerCase();
    if (t === 'light' || t === 'dark') return t;
    return 'dark'; 
}

function initTheme() {
    const theme = getSavedTheme();
    
    document.documentElement.classList.toggle('light-theme', theme === 'light');
    updateThemeToggleUI();
}

function toggleTheme() {
    const isLight = document.documentElement.classList.contains('light-theme');
    setTheme(isLight ? 'dark' : 'light');
}

async function init() {
    try {
        
        initTheme();
        linearEngine = new LinearAlgebraEngine();
        commandParser = new CommandParser(sceneObjects, linearEngine);
        setupScene();
        setupCamera();
        setupRenderer();
        setupLighting();
        setupPostProcessing()
        setupGridAndAxes();
        setup2DScene();
        setupControls();
        setupEventHandlers();
        initCommandConsole();
        initHistoryPalette();
        
        
        updateThemeDependentVisuals();
        scene.add(temporaryVisuals);
        
        if (enh('axisTicks')) {
            axisTicks3D = new THREE.Group();
            axisTicks3D.renderOrder = 5;
            scene.add(axisTicks3D);
        }
        scene.add(basisVectors);
        scene2D.add(temporaryVisuals2D);
        scene2D.add(basisVectors2D);
        await parseCommand("a = (4, 1, 2)");
        await parseCommand("b = (1, 3, 1)");
        await parseCommand("c = (2, 4, 6)");
        
        await parseCommand("A = [a, b]");
        animate();
        ensureResetZoomUI();
        setTimeout(() => { document.getElementById('loading').classList.add('hidden'); }, 500);
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        document.getElementById('loading').innerHTML = `Error: ${error.message}`;
    }
}


function getOpMeta(value, fallbackLabel) {
    const map = {
        gramschmidt: { icon: '🧮', label: 'Gram-Schmidt', badge: 'Space', badgeClass: 'badge-space' },
        rank:        { icon: '#',   label: 'Rank',          badge: 'Matrix', badgeClass: 'badge-matrix' },
        svd:         { icon: '∑',   label: 'SVD',           badge: 'Decomp', badgeClass: 'badge-decomp' },
        quadric:     { icon: '⬚',   label: 'Quadric Surface', badge: 'Geom',  badgeClass: 'badge-geom' },
        colspace:    { icon: 'C',   label: 'Column Space',  badge: 'Space',  badgeClass: 'badge-space' },
        nullspace:   { icon: 'N',   label: 'Null Space',    badge: 'Space',  badgeClass: 'badge-space' },
        changebasis: { icon: '↔',   label: 'Change of Basis', badge: 'Matrix', badgeClass: 'badge-matrix' },
        det:         { icon: '|A|', label: 'Determinant',   badge: 'Matrix', badgeClass: 'badge-matrix' },
        eigen:       { icon: 'λ',   label: 'Eigen',         badge: 'Decomp', badgeClass: 'badge-decomp' },
        proj:        { icon: '→',   label: 'Projection',    badge: 'Proj',   badgeClass: 'badge-proj' },
        span:        { icon: '∪',   label: 'Span',          badge: 'Space',  badgeClass: 'badge-space' },
        norm:        { icon: '‖v‖', label: 'Norm',          badge: 'Vector', badgeClass: 'badge-vector' },
        transform:   { icon: 'T',   label: 'Transform',     badge: 'Matrix', badgeClass: 'badge-matrix' },
        leastsquares:{ icon: 'LS',  label: 'Least Squares', badge: 'Proj',   badgeClass: 'badge-proj' },
        orthcomp:    { icon: '⟂',   label: 'Orthogonal Complement', badge: 'Space', badgeClass: 'badge-space' },
        reset:       { icon: '⟲',   label: 'Reset Grid',    badge: 'Misc',   badgeClass: 'badge-misc' }
    };
    const meta = map[value] || { icon: '⋯', label: fallbackLabel || value, badge: 'Misc', badgeClass: 'badge-misc' };
    return meta;
}


function initCustomOpSelect() {
    const select = document.getElementById('op-select');
    if (!select || select.dataset.enhanced === '1') return;
    const parent = select.parentElement;
    if (!parent) return;

    
    const wrapper = document.createElement('div');
    wrapper.className = 'op-select-wrapper';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'op-select-trigger';
    const triggerLeft = document.createElement('div');
    triggerLeft.className = 'op-trigger-left';
    const trigIcon = document.createElement('span');
    trigIcon.className = 'op-trigger-icon';
    const trigLabel = document.createElement('span');
    trigLabel.className = 'op-trigger-label';
    const trigBadge = document.createElement('span');
    trigBadge.className = 'op-trigger-badge';
    triggerLeft.appendChild(trigIcon);
    triggerLeft.appendChild(trigLabel);
    triggerLeft.appendChild(trigBadge);
    const trigCaret = document.createElement('span');
    trigCaret.className = 'op-trigger-caret';
    trigCaret.textContent = '▾';
    trigger.appendChild(triggerLeft);
    trigger.appendChild(trigCaret);

    
    const menu = document.createElement('div');
    menu.className = 'op-select-menu';

    const seen = new Set();
    Array.from(select.options).forEach(opt => {
        const value = opt.value;
        if (seen.has(value)) return; 
        seen.add(value);
        const meta = getOpMeta(value, opt.textContent);
        const item = document.createElement('div');
        item.className = 'op-option';
        item.dataset.value = value;
        const icon = document.createElement('span'); icon.className = 'icon'; icon.textContent = meta.icon;
        const label = document.createElement('div'); label.className = 'label'; label.textContent = meta.label;
        const badge = document.createElement('span'); badge.className = `badge ${meta.badgeClass}`; badge.textContent = meta.badge;
        item.appendChild(icon); item.appendChild(label); item.appendChild(badge);
        item.addEventListener('click', () => {
            select.value = value;
            
            trigIcon.textContent = meta.icon;
            trigLabel.textContent = meta.label;
            trigBadge.textContent = meta.badge;
            trigBadge.className = `op-trigger-badge ${meta.badgeClass}`;
            
            select.dispatchEvent(new Event('change'));
            menu.classList.remove('open');
        });
        menu.appendChild(item);
    });

    
    const listContainer = document.getElementById('object-list');
    if (listContainer && !listContainer.dataset.delegated) {
        listContainer.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            const deleteBtn = e.target.closest('.delete-btn');
            const visBtn = e.target.closest('.object-visibility');
            const item = e.target.closest('.object-item');
            if (!item) return;
            const key = item.dataset.key;
            
            if (!editBtn && !deleteBtn && !visBtn) {
                document.querySelectorAll('#object-list .object-item.selected').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                window.quickOpsSelectedKey = key;
                return;
            }
            if (editBtn) {
                e.stopPropagation();
                openInPlaceEditor(key, item);
                return;
            }
            if (deleteBtn) {
                e.stopPropagation();
                if (sceneMeshes[key]) scene.remove(sceneMeshes[key]);
                delete sceneMeshes[key];
                delete sceneObjects[key];
                
    if (is2DMode) {
        update2DSceneFromObjects();
    } else {
        updateSceneFromObjects();
    }
                updateObjectListUI();
                if (is2DMode) {
                    maybeClear2DTemporaryVisuals();
                } else {
                    maybeClearTemporaryVisuals();
                }
                return;
            }
            if (visBtn) {
                e.stopPropagation();
                const obj = sceneObjects[key];
                if (!obj || obj.type !== 'vector') return;
                const dim = Array.isArray(obj.raw) ? obj.raw.length : (obj.value instanceof THREE.Vector3 ? 3 : 0);
                const canToggle = (is2DMode && dim === 2) || (!is2DMode && obj.value instanceof THREE.Vector3);
                if (!canToggle) return;
                obj.visible = !obj.visible;
                if (is2DMode) { update2DSceneFromObjects(); } else { updateSceneFromObjects(); }
                updateObjectListUI();
                return;
            }
        });
        listContainer.dataset.delegated = '1';
    }
    
    parent.insertBefore(wrapper, select);
    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    select.style.display = 'none';
    select.dataset.enhanced = '1';

    
    const selectedOpt = select.options[select.selectedIndex] || select.options[0];
    if (selectedOpt) {
        const meta = getOpMeta(selectedOpt.value, selectedOpt.textContent);
        trigIcon.textContent = meta.icon;
        trigLabel.textContent = meta.label;
        trigBadge.textContent = meta.badge;
        trigBadge.className = `op-trigger-badge ${meta.badgeClass}`;
    }

    
    function positionOpMenu() {
        const trigRect = trigger.getBoundingClientRect();
        const sidebar = document.querySelector('aside.sidebar');
        const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : { right: 0 };
        const vpH = window.innerHeight;
        const vpW = window.innerWidth;
        const desiredWidth = Math.min(Math.max(trigRect.width, 240), Math.min(420, vpW - 16));
        menu.style.width = desiredWidth + 'px';

        
        const spaceBelow = vpH - trigRect.bottom - 12; 
        const spaceAbove = trigRect.top - 12;

        
        menu.style.maxHeight = Math.max(180, Math.min(320, Math.max(spaceAbove, spaceBelow))) + 'px';

        
        const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
        menu.classList.toggle('up', openUp);
        menu.classList.toggle('down', !openUp);

        
        let left = trigRect.left;
        const minLeft = Math.max(8, (sidebarRect.right || 0) + 8);
        left = Math.max(left, minLeft);
        
        const menuWidth = desiredWidth;
        left = Math.min(left, vpW - menuWidth - 8);

        
        let top = openUp ? (trigRect.top - menu.offsetHeight - 6) : (trigRect.bottom + 6);
        
        if (!menu.offsetHeight) {
            const estH = parseInt(menu.style.maxHeight || '280', 10);
            top = openUp ? (trigRect.top - estH - 6) : (trigRect.bottom + 6);
        }
        
        top = Math.max(8, Math.min(top, vpH - 8));

        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
    }

    
    let cleanupPortal = null;
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.classList.contains('open');
        if (isOpen) {
            
            menu.classList.remove('open');
            menu.classList.remove('portal');
            if (cleanupPortal) { cleanupPortal(); cleanupPortal = null; }
            
            wrapper.appendChild(menu);
            return;
        }
        
        menu.classList.add('open');
        menu.classList.add('portal');
        
        document.body.appendChild(menu);
        positionOpMenu();
        const onResize = () => positionOpMenu();
        const onScroll = () => positionOpMenu();
        const onOutside = (ev) => {
            if (ev.target === trigger || trigger.contains(ev.target)) return;
            menu.classList.remove('open');
            menu.classList.remove('portal');
            if (cleanupPortal) { cleanupPortal(); cleanupPortal = null; }
            wrapper.appendChild(menu);
        };
        window.addEventListener('resize', onResize, { passive: true });
        window.addEventListener('scroll', onScroll, { passive: true });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') onOutside(e); }, { once: true });
        setTimeout(() => document.addEventListener('click', onOutside, { once: true }), 0);
        cleanupPortal = () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('scroll', onScroll);
        };
    });
}


(function setupQuickOps(){
    window.quickOpsSelectedKey = '';
    window.quickOpsUndoStack = [];
    
    window.quickOpsArmed = false;

    window.addEventListener('DOMContentLoaded', () => {
        
        const list = document.getElementById('object-list');
        if (list && !list.dataset.quickops) {
            list.addEventListener('click', (e) => {
                const item = e.target.closest('.object-item');
                if (!item) return;
                document.querySelectorAll('#object-list .object-item.selected').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                window.quickOpsSelectedKey = item.dataset.key;
            });
            
            
            list.addEventListener('mouseenter', () => { window.quickOpsArmed = true; });
            list.addEventListener('mouseleave', () => { window.quickOpsArmed = false; });
            list.dataset.quickops = '1';
        }

        
        function snapshotObject(key){
            const obj = sceneObjects[key];
            if (!obj) return null;
            if (obj.type === 'vector') {
                
                const raw = Array.isArray(obj.raw) ? obj.raw.slice() : (obj.value && obj.value.isVector3 ? [obj.value.x, obj.value.z, obj.value.y] : []);
                return { type: 'vector', raw, visible: !!obj.visible, color: obj.color || null };
            }
            if (obj.type === 'matrix') {
                const value = (obj.value || []).map(r => r.slice());
                return { type: 'matrix', value };
            }
            return null;
        }
        function restoreObjectFromSnapshot(snap){
            if (!snap) return null;
            if (snap.type === 'vector') {
                const raw = Array.isArray(snap.raw) ? snap.raw.slice() : [];
                let value = null;
                if (raw.length === 3 && typeof THREE !== 'undefined') {
                    
                    value = new THREE.Vector3(raw[0], raw[2], raw[1]);
                }
                const obj = { type: 'vector', raw, value, visible: !!snap.visible };
                if (snap.color) obj.color = snap.color;
                return obj;
            }
            if (snap.type === 'matrix') {
                return { type: 'matrix', value: (snap.value || []).map(r => r.slice()) };
            }
            return null;
        }

        
        document.addEventListener('keydown', (e) => {
            
            const target = e.target;
            const tag = (target && target.tagName ? target.tagName.toLowerCase() : '');
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || (target && target.isContentEditable)) {
                return;
            }

            
            const sidebar = document.querySelector('aside.sidebar');
            const isInSidebar = sidebar ? sidebar.contains(target) : false;
            if (!isInSidebar && !window.quickOpsArmed) {
                return;
            }

            const keySel = window.quickOpsSelectedKey;
            if (!keySel) return;
            const obj = sceneObjects[keySel];
            if (!obj) return;

            
            if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                const action = window.quickOpsUndoStack.pop();
                if (!action) return;
                if (action.type === 'delete') {
                    
                    sceneObjects[action.key] = restoreObjectFromSnapshot(action.snapshot);
                    if (action.origin) vectorOrigins[action.key] = action.origin; else delete vectorOrigins[action.key];
                    if (is2DMode) { update2DSceneFromObjects(); } else { updateSceneFromObjects(); }
                    updateObjectListUI();
                    
                    window.quickOpsSelectedKey = action.key;
                    const list = document.getElementById('object-list');
                    if (list) {
                        list.querySelectorAll('.object-item.selected').forEach(el => el.classList.remove('selected'));
                        const card = list.querySelector(`.object-item[data-key="${action.key}"]`);
                        if (card) card.classList.add('selected');
                    }
                } else if (action.type === 'toggle-visibility') {
                    const o = sceneObjects[action.key];
                    if (o) {
                        o.visible = !o.visible;
                        if (is2DMode) { update2DSceneFromObjects(); } else { updateSceneFromObjects(); }
                        updateObjectListUI();
                    }
                }
                return;
            }

            
            if (e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                const itemEl = document.querySelector(`.object-item[data-key="${keySel}"]`);
                if (obj.type === 'matrix') { showEditTray(keySel); } else { openInPlaceEditor(keySel, itemEl); }
                return;
            }
            if (e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                
                window.quickOpsUndoStack.push({ type: 'delete', key: keySel, snapshot: snapshotObject(keySel), origin: vectorOrigins[keySel] ? { ...vectorOrigins[keySel] } : null });
                
                if (sceneMeshes[keySel]) { scene.remove(sceneMeshes[keySel]); delete sceneMeshes[keySel]; }
                if (sceneMeshes2D && sceneMeshes2D[keySel]) { delete sceneMeshes2D[keySel]; }
                delete sceneObjects[keySel];
                delete vectorOrigins[keySel];
                if (is2DMode) { update2DSceneFromObjects(); } else { updateSceneFromObjects(); }
                updateObjectListUI();
                return;
            }
            if (e.key === 'h' || e.key === 'H') {
                e.preventDefault();
                if (obj.type !== 'vector') return;
                const dim = Array.isArray(obj.raw) ? obj.raw.length : (obj.value instanceof THREE.Vector3 ? 3 : 0);
                const canToggle = (is2DMode && dim === 2) || (!is2DMode && obj.value instanceof THREE.Vector3);
                if (!canToggle) return;
                window.quickOpsUndoStack.push({ type: 'toggle-visibility', key: keySel });
                obj.visible = !obj.visible;
                if (is2DMode) { update2DSceneFromObjects(); } else { updateSceneFromObjects(); }
                updateObjectListUI();
                return;
            }
            if (e.key === 'o' || e.key === 'O') {
                e.preventDefault();
                const itemEl = document.querySelector(`.object-item[data-key="${keySel}"]`);
                openOriginEditor(keySel, itemEl);
                return;
            }
        });
    });
})();


(function setupOpsInfo(){
    function buildContent(){
        const div = document.createElement('div');
        div.className = 'ops-info-popover';
        div.innerHTML = `
            <b>Keyboard Shortcuts</b><br/>
            Click a card or vector to select, then press:<br/>
            <span class="kbd">e</span> Edit &nbsp; 
            <span class="kbd">d</span> Delete &nbsp; 
            <span class="kbd">h</span> Hide/Show &nbsp; 
            <span class="kbd">o</span> Origin<br/>
            <span class="kbd">Ctrl</span> + <span class="kbd">Z</span> Undo last delete/toggle
        `;
        return div;
    }
    function showNearButton(btn){
        const pop = buildContent();
        document.body.appendChild(pop);
        const rect = btn.getBoundingClientRect();
        const top = rect.bottom + 8 + window.scrollY;
        const left = rect.left + window.scrollX - 10;
        pop.style.top = top + 'px';
        pop.style.left = left + 'px';
        const close = (ev)=>{
            if (ev && (pop.contains(ev.target) || btn.contains(ev.target))) return;
            pop.remove();
            document.removeEventListener('click', close, true);
            document.removeEventListener('keydown', onEsc, true);
        };
        const onEsc = (ev)=>{ if (ev.key === 'Escape'){ close(); } };
        setTimeout(()=>{
            document.addEventListener('click', close, true);
            document.addEventListener('keydown', onEsc, true);
        },0);
    }
    window.addEventListener('DOMContentLoaded', ()=>{
        const btn = document.getElementById('btn-ops-info');
        if (!btn) return;
        btn.addEventListener('click', (e)=>{
            e.preventDefault();
            showNearButton(btn);
        });
    });
})();

function renderMatrixGrid(container, matrix) {
    container.innerHTML = ''; 
    const table = document.createElement('table');
    table.className = 'editor-matrix-grid'; 
    const rows = matrix.length;
    const cols = matrix[0]?.length || 0;

    for (let i = 0; i < rows; i++) {
        const tr = document.createElement('tr');
        for (let j = 0; j < cols; j++) {
            const td = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'number';
            input.step = '0.1';
            input.className = 'editor-input'; 
            input.value = Number(matrix[i][j]);
            
            
            td.appendChild(input);
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
    container.appendChild(table);
}

function readMatrixGrid(container) {
    const rows = Array.from(container.querySelectorAll('tr'));
    if (rows.length === 0) throw new Error('Matrix must have at least 1 row');
    const matrix = rows.map(tr => Array.from(tr.querySelectorAll('input')).map(inp => parseFloat(inp.value)));
    validateNumericMatrix(matrix);
    return matrix;
}

async function parseCommand(command) {
    command = (command || '').trim();
    if (!command) return;
    if (parseInFlight) { console.warn('[parse] command ignored; parse already in-flight'); return; }
    parseInFlight = true;
    const t0 = (performance && performance.now ? performance.now() : Date.now());
    const commandInput = document.getElementById('command-input');
    const outputArea = document.getElementById('command-output');
    const statusText = document.getElementById('status-text');
    lastCommandText = command;

    
    if (commandInput) commandInput.setAttribute('disabled', 'true');
    const runBtn = document.getElementById('command-enter');
    if (runBtn) runBtn.setAttribute('disabled', 'true');
    if (outputArea) outputArea.setAttribute('aria-busy', 'true');
    
    try { setConsoleBusy(true, 'Parsing…'); startElapsed(); } catch(_) {}

    
    parseWatchdogTimer = setTimeout(() => {
        console.warn('[parse] watchdog fired after', PARSE_WATCHDOG_MS, 'ms. Attempting recovery...');
        try { window.bumpRenderToken && window.bumpRenderToken(); } catch(_) {}
        try { window.computationManager && window.computationManager.cancelAll && window.computationManager.cancelAll('parse watchdog'); } catch(_) {}
        try { displayCommandError('Operation timed out. Resetting async state.'); } catch(_) {}
        
        try {
            const cmdInput = document.getElementById('command-input');
            if (cmdInput) cmdInput.removeAttribute('disabled');
            const runBtnRecover = document.getElementById('command-enter');
            if (runBtnRecover) runBtnRecover.removeAttribute('disabled');
            const out = document.getElementById('command-output');
            if (out) out.setAttribute('aria-busy', 'false');
            stopElapsed('timeout');
            setConsoleBusy(false, '');
        } catch(_) {}
        parseInFlight = false;
    }, PARSE_WATCHDOG_MS);

    
    if (is2DMode) { maybeClear2DTemporaryVisuals(); } else { maybeClearTemporaryVisuals(); }

    try {
        const result = commandParser.parseAsync
            ? await commandParser.parseAsync(command)
            : commandParser.parse(command);
        if (result.success) {
            
            if (commandHistory[commandHistory.length - 1] !== command) {
                commandHistory.push(command);
                commandHistoryIndex = commandHistory.length;
            }
            
            renderHistoryPalette();
            displayCommandResult(result);
            if (result.visualize) handleVisualization(result.visualize);

            const name = result.name;
            if (name) {
                const isSimpleName = /^[a-zA-Z_]\w*$/.test(name);
                if (result.type === 'vector') {
                    if (name.toLowerCase() === name || !isSimpleName) { updateVectorInScene(name, result.value); }
                } else if (result.type === 'matrix') {
                    if (name.toUpperCase() === name || !isSimpleName) {
                        sceneObjects[name] = { type: 'matrix', value: result.value };
                        updateObjectListUI();
                    }
                } else if (result.type === 'plane') {
                    
                    let planeKey = result.name || 'Plane';
                    if (typeof planeKey === 'string' && planeKey.includes('==')) {
                        const m = planeKey.match(/^\s*([a-zA-Z_]\w*)\s*==\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*$/);
                        if (m) {
                            let base = `P${m[1]}`;
                            let k = base;
                            let i = 0;
                            while (sceneObjects[k]) { i++; k = `${base}${i}`; }
                            planeKey = k;
                        }
                    }
                    const nFull = Array.isArray(result.value?.normal) ? result.value.normal.slice() : null;
                    const d = Number(result.value?.offset);
                    const dim = Array.isArray(nFull) ? nFull.length : 0;
                    if (nFull && dim >= 2 && Number.isFinite(d)) {
                        
                        sceneObjects[planeKey] = {
                            type: 'plane',
                            normal: nFull,   
                            offset: d,
                            dim,
                            visible: true,
                            color: 0x60a5fa 
                        };
                        updateObjectListUI();
                        if (is2DMode) update2DSceneFromObjects(); else updateSceneFromObjects();
                    }
                }
            }
            if (commandInput) commandInput.value = '';
        } else {
            displayCommandError(result.error);
        }
    } catch (error) {
        displayCommandError(error && error.message ? error.message : String(error));
    } finally {
        if (parseWatchdogTimer) { clearTimeout(parseWatchdogTimer); parseWatchdogTimer = null; }
        parseInFlight = false;
        const dt = ((performance && performance.now ? performance.now() : Date.now()) - t0).toFixed(1);
        console.debug('[parse] completed in', dt, 'ms');
        if (commandInput) commandInput.removeAttribute('disabled');
        const runBtn2 = document.getElementById('command-enter');
        if (runBtn2) runBtn2.removeAttribute('disabled');
        const outputArea2 = document.getElementById('command-output');
        if (outputArea2) outputArea2.setAttribute('aria-busy', 'false');
        try { stopElapsed(`${dt} ms`); setConsoleBusy(false, ''); } catch(_) {}
    }
}


function updateVectorInScene(name, values) {
    
    const dim = Array.isArray(values) ? values.length : 0;
    let vizVec = null;
    if (dim === 3) {
        
        vizVec = new THREE.Vector3(values[0], values[2], values[1]);
    } else {
        
        vizVec = null;
    }
    const color = vizVec ? calculateWeightedColor(vizVec) : 0x888888;

    if (!sceneObjects[name]) sceneObjects[name] = { type: 'vector', visible: true };
    sceneObjects[name].raw = Array.isArray(values) ? values.slice() : [];
    if (vizVec) {
        if (sceneObjects[name].value instanceof THREE.Vector3) {
            sceneObjects[name].value.copy(vizVec);
        } else {
            sceneObjects[name].value = vizVec.clone();
        }
        sceneObjects[name].color = color;
        
        if (sceneObjects[name].visible === false) {
            sceneObjects[name].visible = true;
        }
    } else {
        
        delete sceneObjects[name].value;
        sceneObjects[name].color = color;
        
    }

    updateVectorVisuals(name);
    
    
    const editingItem = document.querySelector('.object-item.editing');
    if (editingItem && editingItem.dataset.key === name) {
        const valueSpan = editingItem.querySelector('.object-value');
        if (valueSpan && Array.isArray(sceneObjects[name].raw)) {
            valueSpan.textContent = `(${sceneObjects[name].raw.map(n => (Number(n) || 0).toFixed(1)).join(', ')})`;
        }
    } else {
        updateObjectListUI();
    }
}


function updateVectorVisuals(name) {
    if (is2DMode) {
        update2DSceneFromObjects();
    } else {
        updateSceneFromObjects();
    }
}
window.updateVectorInScene = updateVectorInScene;

let outputAnimationToken = 0;
let pendingOutputTimers = new Set();


function setupPostProcessing() {
    const renderScene = new THREE.RenderPass(scene, camera);

    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.6, 
        0.4, 
        0.95
    );


    const smaaPass = new THREE.SMAAPass(
        window.innerWidth * renderer.getPixelRatio(),
        window.innerHeight * renderer.getPixelRatio()
    );

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composer.addPass(smaaPass); 
}

function displayCommandResult(result) {
    const outputArea = document.getElementById('command-output');
    if (!outputArea) return;
    
    
    const clearToggle = document.getElementById('toggle-clear-on-run');
    if (!clearToggle || clearToggle.checked) {
        
        outputArea.innerHTML = '';
    }
    
    
    const card = document.createElement('div');
    card.className = 'result-card';
    
    
    card.dataset.originalCommand = lastCommandText || '';
    card.dataset.originalResult = result.rawOutput || result.latex || result.output || '';
    
    
    if (lastCommandText) {
        const header = document.createElement('div');
        header.className = 'result-header';
        header.textContent = lastCommandText;
        card.appendChild(header);
    }
    
    
    const content = document.createElement('div');
    content.className = 'result-content';
    if (result.latex) {
        content.innerHTML = result.latex;
    } else if (result.output) {
        content.innerHTML = result.output;
    } else if (result.rawOutput) {
        content.textContent = result.rawOutput;
    } else {
        content.textContent = '';
    }
    card.appendChild(content);
    
    outputArea.appendChild(card);
    
    
    if (window.renderMath) {
        try { window.renderMath(card); } catch(_) {}
    }
    
    outputArea.scrollTop = outputArea.scrollHeight;
}

function displayCommandError(message) {
    const outputArea = document.getElementById('command-output');
    if (!outputArea) return;
    
    
    const clearToggle = document.getElementById('toggle-clear-on-run');
    if (!clearToggle || clearToggle.checked) {
        outputArea.innerHTML = '';
    }
    
    const card = document.createElement('div');
    card.className = 'result-card error-result';
    
    if (lastCommandText) {
        const header = document.createElement('div');
        header.className = 'result-header';
        header.textContent = lastCommandText;
        card.appendChild(header);
    }
    
    const content = document.createElement('div');
    content.className = 'result-content';
    content.textContent = message || 'An error occurred';
    card.appendChild(content);
    
    outputArea.appendChild(card);
    outputArea.scrollTop = outputArea.scrollHeight;
}

function setConsoleBusy(busy, label) {
    const spinner = document.getElementById('parse-spinner');
    const status = document.getElementById('status-text');
    if (spinner) spinner.classList.toggle('hidden', !busy);
    if (status && label != null) status.textContent = label;
}

function startElapsed() {
    const label = document.getElementById('elapsed-time');
    elapsedStart = (performance && performance.now ? performance.now() : Date.now());
    if (label) label.textContent = '0.0 ms';
    if (elapsedTimerId) { clearInterval(elapsedTimerId); elapsedTimerId = null; }
    elapsedTimerId = setInterval(() => {
        const now = (performance && performance.now ? performance.now() : Date.now());
        const ms = now - elapsedStart;
        if (label) label.textContent = `${ms.toFixed(0)} ms`;
    }, 60);
}

function stopElapsed(finalText = '') {
    const label = document.getElementById('elapsed-time');
    if (elapsedTimerId) { clearInterval(elapsedTimerId); elapsedTimerId = null; }
    if (label) label.textContent = finalText || '';
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s]));
}

function initCommandConsole() {
    const input = document.getElementById('command-input');
    const runBtn = document.getElementById('command-enter');
    const output = document.getElementById('command-output');
    const clearBtn = document.getElementById('output-clear');
    const copyBtn = document.getElementById('output-copy');
    
    runBtn.addEventListener('click', () => parseCommand(input.value));
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { parseCommand(input.value); }
        else if (e.key === 'ArrowUp') {
            if (commandHistory.length === 0) return;
            if (commandHistoryIndex <= 0) commandHistoryIndex = 0; else commandHistoryIndex--;
            input.value = commandHistory[commandHistoryIndex] || '';
            e.preventDefault();
        } else if (e.key === 'ArrowDown') {
            if (commandHistory.length === 0) return;
            if (commandHistoryIndex >= commandHistory.length - 1) { commandHistoryIndex = commandHistory.length; input.value = ''; }
            else { commandHistoryIndex++; input.value = commandHistory[commandHistoryIndex] || ''; }
            e.preventDefault();
        }
    });
    
    
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            output.innerHTML = '';
        });
    }
    
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            let textToCopy = '';
            
            
            const cards = output.querySelectorAll('.result-card');
            cards.forEach((card, index) => {
                const command = card.dataset.originalCommand || '';
                const result = card.dataset.originalResult || '';
                
                if (command) {
                    textToCopy += command + '\n';
                }
                
                
                if (result) {
                    textToCopy += result + '\n';
                } else {
                    
                    const content = card.querySelector('.result-content');
                    if (content) {
                        
                        let cleanText = content.textContent || '';
                        
                        
                        cleanText = cleanText.replace(/([A-Za-z])=\(([0-9.,\s]+)\)/g, (match, varName, numbers) => {
                            
                            const nums = numbers.match(/[0-9.]+/g) || [];
                            if (nums.length === 6) { 
                                return `${varName}=[[${nums[0]},${nums[1]}],[${nums[2]},${nums[3]}],[${nums[4]},${nums[5]}]]`;
                            } else if (nums.length === 4) { 
                                return `${varName}=[[${nums[0]},${nums[1]}],[${nums[2]},${nums[3]}]]`;
                            } else if (nums.length === 9) { 
                                return `${varName}=[[${nums[0]},${nums[1]},${nums[2]}],[${nums[3]},${nums[4]},${nums[5]}],[${nums[6]},${nums[7]},${nums[8]}]]`;
                            }
                            return match;
                        });
                        
                        textToCopy += cleanText + '\n';
                    }
                }
                
                if (index < cards.length - 1) textToCopy += '\n';
            });
            
            if (!textToCopy.trim()) {
                textToCopy = output.textContent || '';
            }
            
            if (textToCopy.trim()) {
                navigator.clipboard.writeText(textToCopy.trim()).then(() => {
                    copyBtn.textContent = '✓';
                    setTimeout(() => copyBtn.textContent = '⧉', 1000);
                }).catch(() => {
                    
                    const textarea = document.createElement('textarea');
                    textarea.value = textToCopy.trim();
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    copyBtn.textContent = '✓';
                    setTimeout(() => copyBtn.textContent = '⧉', 1000);
                });
            }
        });
    }

    
    try {
        if (window.computationManager && typeof window.computationManager.setOnProgress === 'function') {
            window.computationManager.setOnProgress((p) => {
                const stage = p && p.stage ? String(p.stage) : 'working…';
                setConsoleBusy(true, `Working: ${stage}`);
            });
        }
    } catch(_) {}
}


function initHistoryPalette() {
    
    try {
        const raw = localStorage.getItem('vv_saved_commands');
        const parsed = raw ? JSON.parse(raw) : [];
        savedCommands = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        savedCommands = [];
    }
    renderHistoryPalette();
}

function persistSavedCommands() {
    try { localStorage.setItem('vv_saved_commands', JSON.stringify(savedCommands)); } catch(_) {}
}

function addSavedCommand(cmd) {
    if (!cmd) return;
    
    const idx = savedCommands.indexOf(cmd);
    if (idx >= 0) savedCommands.splice(idx, 1);
    savedCommands.unshift(cmd);
    if (savedCommands.length > 20) savedCommands.length = 20;
    persistSavedCommands();
    renderHistoryPalette();
}

function removeSavedCommand(cmd) {
    const idx = savedCommands.indexOf(cmd);
    if (idx >= 0) {
        savedCommands.splice(idx, 1);
        persistSavedCommands();
        renderHistoryPalette();
    }
}

function renderHistoryPalette() {
    const savedWrap = document.getElementById('saved-commands');
    const recentWrap = document.getElementById('recent-commands');
    if (!savedWrap || !recentWrap) return;

    
    savedWrap.innerHTML = '';
    for (const cmd of savedCommands) savedWrap.appendChild(createChip(cmd, true));

    
    const recent = [];
    for (let i = commandHistory.length - 1; i >= 0 && recent.length < 10; i--) {
        const c = commandHistory[i];
        if (!recent.includes(c)) recent.push(c);
    }
    recentWrap.innerHTML = '';
    for (const cmd of recent) recentWrap.appendChild(createChip(cmd, false));
}

function createChip(cmd, isSaved) {
    const chip = document.createElement('div');
    chip.className = 'cmd-chip';
    chip.title = isSaved ? `${cmd} (click: insert, double-click: run, right-click: remove)` : `${cmd} (click: insert, double-click: run, right-click: save)`;
    
    const text = document.createElement('span');
    text.className = 'chip-text';
    text.textContent = cmd;
    
    chip.appendChild(text);
    
    
    chip.addEventListener('click', (e) => {
        e.preventDefault();
        const input = document.getElementById('command-input');
        if (input) {
            input.value = cmd;
            input.focus();
        }
    });
    
    
    chip.addEventListener('dblclick', (e) => {
        e.preventDefault();
        parseCommand(cmd);
    });
    
    
    chip.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (isSaved) {
            removeSavedCommand(cmd);
        } else {
            addSavedCommand(cmd);
        }
    });
    
    return chip;
}

function handleVisualization(viz) {
    switch(viz.type) {
        case 'vector_addition': visualizeVectorAddition(viz.v1, viz.v2, viz.result); break;
        case 'scalar_multiplication': visualizeScalarMultiplication(viz.original, viz.result); break;
        case 'projection':
            if (is2DMode) visualizeProjection2D(viz.from, viz.onto, viz.result); else visualizeProjection(viz.from, viz.onto, viz.result);
            break;
        case 'subspace_projection': visualizeSubspaceProjection(viz.from, viz.subspaceBasis, viz.result); break;
        case 'span':
            if (is2DMode) visualizeSpan2D(viz.vectors); else visualizeSpan(viz.vectors);
            break;
        case 'basis':
            if (is2DMode) toggleBasisVectors2D(viz.show); else toggleBasisVectors(viz.show);
            break;
        case 'transform': applyTransformationToGrid(viz.matrix); break;
        case 'determinant': visualizeDeterminant(viz.matrix, viz.det); break;
        case 'eigenvectors': visualizeEigenvectors(viz.matrix, viz.values, viz.vectors); break;
        case 'least_squares': visualizeLeastSquares(viz.matrix, viz.b, viz.result); break;
        case 'orthogonal_complement': visualizeOrthogonalComplement(viz.basis, viz.complement); break;
        case 'gram_schmidt': visualizeGramSchmidt(viz.original, viz.final); break;
        case 'rank': visualizeRank(viz.matrix); break;
        case 'svd': animateSVDTransformation(viz.U, viz.S, viz.Vt, viz.matrix); break;
        case 'quadric': visualizeQuadricSurface(viz.matrix); break;
        case 'column_space': visualizeColumnSpace(viz.matrix); break;
        case 'null_space': visualizeNullSpace(viz.basis); break;
        case 'plane_intersection_line': visualizePlaneIntersectionLine(viz.point, viz.direction, viz.planes); break;
        case 'plane_intersection_point': visualizePlaneIntersectionPoint(viz.point, viz.planes); break;
        case 'plane_intersection_parallel': addTextLabel(`Planes ${viz.planes?.join(', ')} are parallel (no line)`, new THREE.Vector3(0, 2, 0), '#f87171', 16); break;
        case 'plane_intersection_coincident': addTextLabel(`Planes ${viz.planes?.join(', ')} coincide (infinite intersections)`, new THREE.Vector3(0, 2, 0), '#22c55e', 16); break;
        case 'plane_intersection_degenerate': addTextLabel(`Plane intersection is degenerate`, new THREE.Vector3(0, 2, 0), '#f59e0b', 16); break;
        case 'qr': visualizeQR(viz.Q, viz.R, viz.name); break;
    }
}

function visualizeRank(matrix) {
    const basis = linearEngine.transpose(matrix);
    visualizeSpan(basis);
    const rank = linearEngine.rank(matrix);
    const text = addTextLabel(`Rank = ${rank} (Dimension of this subspace)`, new THREE.Vector3(0, 0.2, 0), '#ffffff', 24);
    temporaryVisuals.add(text);
}

function visualizeSVD(U, S, Vt) {
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshNormalMaterial({ wireframe: true });
    const sphere = new THREE.Mesh(geometry, material);
    temporaryVisuals.add(sphere);
    const uMat = new THREE.Matrix4().set(U[0][0], U[0][1], 0, 0, U[1][0], U[1][1], 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    const sMat = new THREE.Matrix4().set(S[0], 0, 0, 0, 0, S[1], 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    const vtMat = new THREE.Matrix4().set(Vt[0][0], Vt[0][1], 0, 0, Vt[1][0], Vt[1][1], 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    sphere.applyMatrix4(vtMat);
    sphere.applyMatrix4(sMat);
    sphere.applyMatrix4(uMat);
}

function visualizeQuadricSurface(matrix) {
    const { values, vectors } = linearEngine.eigenDecomposition(matrix);
    const D = new THREE.Matrix4().makeScale(1 / Math.sqrt(Math.abs(values[0])), 1 / Math.sqrt(Math.abs(values[1])), 1 / Math.sqrt(Math.abs(values[2] || 1)));
    const [x0,y0,z0] = vectors[0];
    const [x1,y1,z1] = vectors[1];
    const v2 = vectors[2] || [0,0,1];
    const [x2,y2,z2] = v2;
    const e0 = new THREE.Vector3(x0, z0, y0);
    const e1 = new THREE.Vector3(x1, z1, y1);
    const e2 = new THREE.Vector3(x2, z2, y2);
    const P = new THREE.Matrix4().makeBasis(e0, e1, e2);
    let geometry;
    if (values.every(v => v > 0)) { geometry = new THREE.SphereGeometry(1, 32, 32); } 
    else { geometry = new THREE.SphereGeometry(1, 32, 32); }
    const material = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.3, roughness: 0.6, side: THREE.DoubleSide });
    const surface = new THREE.Mesh(geometry, material);
    surface.applyMatrix4(D);
    surface.applyMatrix4(P);
    temporaryVisuals.add(surface);
}

function visualizeColumnSpace(matrix) {
    const basis = linearEngine.transpose(matrix);
    const colSpan = visualizeSpan(basis);
    if (colSpan) {
        const text = addTextLabel("Column Space", new THREE.Vector3(0, 0.2, 0), '#339af0', 24);
        temporaryVisuals.add(text);
    }
}

function visualizeNullSpace(basis) {
    if (basis.length === 0) {
        const originDot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
        temporaryVisuals.add(originDot);
        const text = addTextLabel("Null Space = {0}", new THREE.Vector3(0.2, 0.2, 0), '#ffff00', 20);
        temporaryVisuals.add(text);
        return;
    }
    const nullSpan = visualizeSpan(basis);
    if (nullSpan) {
        nullSpan.children.forEach(child => { if (child.material) child.material.color.set(0xffff00); });
        const text = addTextLabel("Null Space", new THREE.Vector3(0, 0.2, 0), '#ffff00', 24);
        temporaryVisuals.add(text);
    }
}

function visualizeLeastSquares(matrix, b, result) {
    const basis = linearEngine.transpose(matrix);
    visualizeSubspaceProjection(b, basis, result);
    const [bx, by, bz] = b;
    const bVec = new THREE.Vector3(bx, bz, by);
    const [px, py, pz] = result;
    const projVec = new THREE.Vector3(px, pz, py);
    addTextLabel('b', bVec.multiplyScalar(1.1), '#ffffff', 20);
    addTextLabel('p (Closest Vector)', projVec.multiplyScalar(1.1), '#ff00ff', 20);
    const text = addTextLabel("Column Space of A", new THREE.Vector3(0, 0.1, 0), '#339af0', 24);
    temporaryVisuals.add(text);
}

function visualizeOrthogonalComplement(basis, complement) {
    const basisSpan = visualizeSpan(basis);
    if(basisSpan) {
         basisSpan.children.forEach(child => { if(child.material) child.material.opacity = 0.15; });
    }
    const complementSpan = visualizeSpan(complement);
    if(complementSpan) {
        complementSpan.children.forEach(child => { if(child.material) child.material.color.set(0xf59e0b); });
    }
}

function visualizeGramSchmidt(original, final) {
    original.forEach(vArray => {
        const [x, y, z] = vArray;
        const v = new THREE.Vector3(x, z, y);
        const ghost = createVectorArrow(v, 0xaaaaaa);
        ghost.children.forEach(c => { if(c.material) { c.material.transparent = true; c.material.opacity = 0.35; } });
        temporaryVisuals.add(ghost);
    });
    final.forEach((vArray, i) => {
        const [x, y, z] = vArray;
        const v = new THREE.Vector3(x, z, y);
        const color = availableColors[i % availableColors.length];
        const finalArrow = createVectorArrow(v, color);
        temporaryVisuals.add(finalArrow);
        addTextLabel(`u${i+1}`, v.clone().multiplyScalar(1.2), `#${color.toString(16)}`, 20);
    });
}

function visualizeSubspaceProjection(from, subspaceBasis, result) {
    const [fx, fy, fz] = from;
    const [px, py, pz] = result;
    const fromVec = new THREE.Vector3(fx, fz, fy), projVec = new THREE.Vector3(px, pz, py);
    visualizeSpan(subspaceBasis);
    const fromArrow = createVectorArrow(fromVec, 0xffffff);
    fromArrow.children.forEach(c => { if(c.material) { c.material.transparent = true; c.material.opacity = 0.7; } });
    temporaryVisuals.add(fromArrow);
    const projArrow = createVectorArrow(projVec, 0xff00ff);
    temporaryVisuals.add(projArrow);
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([fromVec, projVec]);
    const lineMaterial = new THREE.LineDashedMaterial({ color: 0xff00ff, dashSize: 0.1, gapSize: 0.1 });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.computeLineDistances();
    temporaryVisuals.add(line);
}

function visualizeDeterminant(matrix, det) {
    applyTransformationToGrid(matrix);
    const is2D = matrix.length === 2 && matrix[0].length === 2;
    const is3D = matrix.length === 3 && matrix[0].length === 3;
    if (is2D) {
        const unitSquare = new THREE.PlaneGeometry(1, 1);
        unitSquare.translate(0.5, 0.5, 0);
        temporaryVisuals.add(new THREE.Mesh(unitSquare, new THREE.MeshBasicMaterial({ color: 0xfab005, side: THREE.DoubleSide })));
    } else if (is3D) {
        const unitCube = new THREE.BoxGeometry(1, 1, 1);
        unitCube.translate(0.5, 0.5, 0.5);
        temporaryVisuals.add(new THREE.Mesh(unitCube, new THREE.MeshBasicMaterial({ color: 0xfab005, transparent: true, opacity: 0.5 })));
    }
    const transformedMaterial = new THREE.MeshBasicMaterial({ color: det < 0 ? 0xef4444 : 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    if (is2D) {
        const i_hat = new THREE.Vector3(matrix[0][0], 0, matrix[1][0]), j_hat = new THREE.Vector3(matrix[0][1], 0, matrix[1][1]);
        const points = [new THREE.Vector3(0,0,0), i_hat, i_hat.clone().add(j_hat), j_hat];
        const transformedGeom = new THREE.BufferGeometry().setFromPoints(points);
        transformedGeom.setIndex([0, 1, 2, 0, 2, 3]);
        temporaryVisuals.add(new THREE.Mesh(transformedGeom, transformedMaterial));
    } else if (is3D) {
        const transformedGeom = new THREE.BoxGeometry(1, 1, 1);
        const transformMatrix4 = new THREE.Matrix4().set(matrix[0][0], matrix[0][1], matrix[0][2], 0, matrix[1][0], matrix[1][1], matrix[1][2], 0, matrix[2][0], matrix[2][1], matrix[2][2], 0, 0, 0, 0, 1);
        transformedGeom.applyMatrix4(transformMatrix4);
        temporaryVisuals.add(new THREE.Mesh(transformedGeom, transformedMaterial));
    }
}

function visualizeEigenvectors(matrix, values, vectors) {
    applyTransformationToGrid(matrix);
    let mat3 = null;
    try {
        const flat = flattenToRowMajor3x3(matrix);
        mat3 = new THREE.Matrix3().fromArray(flat).transpose();
    } catch (e) {
        console.warn('[viz] visualizeEigenvectors: expected 3x3 (or embeddable) matrix; skipping matrix transform of vectors.', e);
    }
    vectors.forEach((vecArray, i) => {
        const [x, y, z] = vecArray;
        const v = new THREE.Vector3(x, z, y).normalize();
        const eigenvalue = values[i];
        const originalArrow = createVectorArrow(v.clone().multiplyScalar(4), 0xffffff);
        originalArrow.children.forEach(c => { if (c.material) { c.material.transparent = true; c.material.opacity = 0.5; } });
        temporaryVisuals.add(originalArrow);
        const transformed_v = mat3 ? v.clone().applyMatrix3(mat3) : v.clone();
        const transformedArrow = createVectorArrow(transformed_v, 0xf59e0b);
        temporaryVisuals.add(transformedArrow);
        addTextLabel(`λ = ${eigenvalue.toFixed(2)}`, transformed_v.clone().multiplyScalar(1.1), '#f59e0b', 20);
    });
}

function visualizeVectorAddition(v1, v2, result) {
    const [x1,y1,z1] = v1, [x2,y2,z2] = v2, [xr,yr,zr] = result;
    const vec1 = new THREE.Vector3(x1, z1, y1), vec2 = new THREE.Vector3(x2, z2, y2), resVec = new THREE.Vector3(xr, zr, yr);
    const lineMaterial = new THREE.LineDashedMaterial({ color: 0xaaaaaa, dashSize: 0.2, gapSize: 0.1 });
    let points = [vec1, resVec], geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line1 = new THREE.Line(geometry, lineMaterial);
    line1.computeLineDistances();
    temporaryVisuals.add(line1);
    points = [vec2, resVec], geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line2 = new THREE.Line(geometry, lineMaterial);
    line2.computeLineDistances();
    temporaryVisuals.add(line2);
}

function visualizeScalarMultiplication(original, result) {
    const [ox, oy, oz] = original;
    const originalVec = new THREE.Vector3(ox, oz, oy);
    const ghostArrow = createVectorArrow(originalVec, 0xaaaaaa);
    ghostArrow.children.forEach(child => { if (child.material) { child.material.transparent = true; child.material.opacity = 0.4; } });
    temporaryVisuals.add(ghostArrow);
}

function visualizeProjection(from, onto, result) {
    const [fx, fy, fz] = from;
    const [px, py, pz] = result;
    const fromVec = new THREE.Vector3(fx, fz, fy), projVec = new THREE.Vector3(px, pz, py);
    const projArrow = createVectorArrow(projVec, 0xff00ff);
    temporaryVisuals.add(projArrow);
    if (enh('dashedHelpers')) {
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([fromVec, projVec]);
        const lineMaterial = new THREE.LineDashedMaterial({ color: 0xff00ff, dashSize: 0.1, gapSize: 0.1 });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        line.computeLineDistances();
        temporaryVisuals.add(line);
    }
}

function visualizeSpan(vectors, options = {}) {
    if (vectors.length !== 2) return;

    const spanGroup = new THREE.Group();
    spanGroup.userData = { type: 'intersection_area' };

    const spanColor = availableColors[(nextPlaneColorIndex++) % availableColors.length];

    
    const planeSize = Math.max(currentGridSize * 2, 10);
    const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);

    
    const planeMaterial = new THREE.MeshBasicMaterial({
        color: spanColor,
        transparent: true,
        opacity: 0.35, 
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);

    
    const cross = new THREE.Vector3().crossVectors(
        new THREE.Vector3(...vectors[0]),
        new THREE.Vector3(...vectors[1])
    ).normalize();

    const quaternion = new THREE.Quaternion()
        .setFromUnitVectors(new THREE.Vector3(0, 0, 1), cross);

    planeMesh.applyQuaternion(quaternion);

    
    spanGroup.add(planeMesh);

    
    vectors.forEach(vec => {
        const material = new THREE.LineBasicMaterial({ color: spanColor  });
        const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(...vec)];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        spanGroup.add(line);
    });

    temporaryVisuals.add(spanGroup);
    return spanGroup;
}

function toggleBasisVectors(show) { basisVectors.visible = show; }


function flattenToRowMajor3x3(matrix) {
    const rows = Array.isArray(matrix) ? matrix.length : 0;
    const cols = Array.isArray(matrix[0]) ? matrix[0].length : 0;
    if (rows === 3 && cols === 3) {
        return [
            matrix[0][0], matrix[0][1], matrix[0][2],
            matrix[1][0], matrix[1][1], matrix[1][2],
            matrix[2][0], matrix[2][1], matrix[2][2],
        ];
    } else if (rows === 2 && cols === 2) {
        
        const a = matrix[0][0], b = matrix[0][1], c = matrix[1][0], d = matrix[1][1];
        return [
            a, 0, b,
            0, 1, 0,
            c, 0, d,
        ];
    }
    throw new Error('Expected 2x2 or 3x3 matrix');
}

function applyTransformationToGrid(matrix) {
    if (!transformationGrid || !gridHelper) return;
    let flat;
    try {
        flat = flattenToRowMajor3x3(matrix);
    } catch (e) {
        console.warn('[viz] applyTransformationToGrid: unsupported matrix shape', e);
        return;
    }
    const mat3 = new THREE.Matrix3().fromArray(flat).transpose();
    const originalPositions = gridHelper.geometry.attributes.position.array;
    const transformedPositions = new Float32Array(originalPositions.length);
    for (let i = 0; i < originalPositions.length; i += 3) {
        const vec = new THREE.Vector3(originalPositions[i], originalPositions[i+1], originalPositions[i+2]);
        vec.applyMatrix3(mat3);
        transformedPositions[i] = vec.x;
        transformedPositions[i+1] = vec.y;
        transformedPositions[i+2] = vec.z;
    }
    transformationGrid.geometry.setAttribute('position', new THREE.BufferAttribute(transformedPositions, 3));
    transformationGrid.geometry.attributes.position.needsUpdate = true;
    transformationGrid.geometry.computeBoundingSphere();
}

function clearTemporaryVisuals() {
    function disposeDeep(obj) {
        obj.traverse((node) => {
            if (node.geometry) {
                node.geometry.dispose();
            }
            if (node.material) {
                const disposeMat = (m) => {
                    if (!m) return;
                    if (m.map) { try { m.map.dispose(); } catch(_) {} }
                    if (m.alphaMap) { try { m.alphaMap.dispose(); } catch(_) {} }
                    if (m.emissiveMap) { try { m.emissiveMap.dispose(); } catch(_) {} }
                    try { m.dispose(); } catch(_) {}
                };
                if (Array.isArray(node.material)) node.material.forEach(disposeMat);
                else disposeMat(node.material);
            }
        });
    }
    while(temporaryVisuals.children.length > 0){ 
        const child = temporaryVisuals.children[0];
        disposeDeep(child);
        temporaryVisuals.remove(child); 
    }

    
    for (const key in sceneObjects) {
        if (!/^[a-zA-Z_]\w*$/.test(key)) {
            if(sceneMeshes[key]) scene.remove(sceneMeshes[key]);
            delete sceneMeshes[key];
            delete sceneObjects[key];
        }
    }
}


function maybeClearTemporaryVisuals() {
    if (!multiOverlayEnabled) clearTemporaryVisuals();
}


function clearAllOverlays() {
    
    try { spanExplorerState.active = false; } catch(_) {}
    try {
        if (spanExplorerState?.targetMesh && scene) {
            scene.remove(spanExplorerState.targetMesh);
            
            spanExplorerState.targetMesh.traverse?.((n)=>{
                try { n.geometry?.dispose(); } catch(_) {}
                try { n.material?.dispose?.(); } catch(_) {}
            });
            spanExplorerState.targetMesh = null;
        }
    } catch(_) {}

    if (is2DMode) {
        
        try { clear2DTemporaryVisuals(); } catch(_) {}
        
        try {
            while (basisVectors2D.children.length) {
                const c = basisVectors2D.children.pop();
                try { c.geometry?.dispose(); } catch(_) {}
                try { c.material?.dispose?.(); } catch(_) {}
            }
        } catch(_) {}
        
        try {
            if (transformationGrid2D) {
                while (transformationGrid2D.children.length) {
                    const c = transformationGrid2D.children.pop();
                    try { c.geometry?.dispose(); } catch(_) {}
                    try { c.material?.dispose?.(); } catch(_) {}
                }
                transformationGrid2D.visible = false;
            }
        } catch(_) {}
    } else {
        
        try { clearTemporaryVisuals(); } catch(_) {}
        
        try {
            while (basisVectors.children.length) {
                const c = basisVectors.children.pop();
                try { c.geometry?.dispose(); } catch(_) {}
                try { c.material?.dispose?.(); } catch(_) {}
            }
        } catch(_) {}
        
        try {
            if (axisTicks3D) {
                while (axisTicks3D.children.length) {
                    const c = axisTicks3D.children.pop();
                    try { c.geometry?.dispose(); } catch(_) {}
                    try { c.material?.dispose?.(); } catch(_) {}
                }
            }
        } catch(_) {}
        
        try { updateResponsiveGrid(); } catch(_) {}
    }
}

function updateObjectListUI() {
    const listContainer = document.getElementById('object-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    const objectKeys = Object.keys(sceneObjects);
    if (objectKeys.length === 0) {
        listContainer.innerHTML = '<p class="empty-list-info">No objects defined.</p>';
        return;
    }
    
    const vectorPalette = [
        0x22c55e, 
        0x3b82f6, 
        0xf59e0b, 
        0xef4444, 
        0x8b5cf6, 
        0x06b6d4, 
        0x84cc16, 
        0xec4899, 
        0xf97316, 
        0x10b981  
    ];
    function hashKeyToIndex(k){
        let h = 0; for (let i=0;i<k.length;i++){ h = (h*31 + k.charCodeAt(i))|0; }
        return Math.abs(h);
    }
    function ensureVectorColor(key, obj){
        if (obj.type !== 'vector') return;
        if (obj.color == null) {
            const idx = hashKeyToIndex(key) % vectorPalette.length;
            obj.color = vectorPalette[idx];
            
            try {
                const group = (typeof sceneMeshes !== 'undefined') ? sceneMeshes[key] : null;
                if (group) {
                    group.traverse?.((node)=>{
                        if (node.material && node.material.color) {
                            node.material.color.setHex(obj.color);
                            node.material.needsUpdate = true;
                        }
                    });
                }
            } catch(e) {  }
        }
    }

    for (const key of objectKeys) {
        const obj = sceneObjects[key];
        
        ensureVectorColor(key, obj);
        const item = document.createElement('div');
        item.className = 'object-item';
        item.dataset.key = key;
        
        
        const matrixCardColor = 0x7c3aed; 
        const baseColor = (obj.type === 'matrix') ? matrixCardColor : (obj.color ?? 0x64748b);
        const objColor = `#${((baseColor >>> 0)).toString(16).padStart(6, '0')}`;
        item.style.setProperty('--obj-color', objColor);
        if (obj.type === 'vector') {
            const raw = Array.isArray(obj.raw)
                ? obj.raw.slice()
                : (obj.value instanceof THREE.Vector3 ? [obj.value.x, obj.value.z, obj.value.y] : []);
            const dim = raw.length;
            const compact = dim >= 5;
            if (compact) item.classList.add('compact');
            
            const originExists = !!vectorOrigins[key];
            const origin = originExists ? vectorOrigins[key] : (is2DMode ? { x: 0, y: 0 } : { x: 0, y: 0, z: 0 });
            const originStr = is2DMode
                ? `(${(origin.x ?? 0).toFixed(1)}, ${(origin.y ?? 0).toFixed(1)})`
                : `(${(origin.x ?? 0).toFixed(1)}, ${(origin.y ?? 0).toFixed(1)}, ${(origin.z ?? 0).toFixed(1)})`;
            const hasCustomOrigin = originExists && (origin.x !== 0 || origin.y !== 0 || (origin.z !== undefined && origin.z !== 0));

            const name = `<div class="name-badge">${key}</div>`;
            let values = `<div class="value-block ${compact ? 'compact' : ''}">`;
            raw.forEach(component => { values += `<div class=\"vector-row\"><div class=\"vector-cell\">${(Number(component) || 0).toFixed(2)}</div></div>`; });
            values += '</div>';
            const originHTML = hasCustomOrigin ? `<div class="origin-indicator" title="Origin: ${originStr}">@${originStr}</div>` : '';
            item.innerHTML = name + values + originHTML;

        } else if (obj.type === 'matrix') {
            const rows = obj.value.length, cols = obj.value[0]?.length || 0;
            const total = rows * cols;
            const compact = (rows >= 5 || cols >= 5 || total >= 16);
            if (compact) item.classList.add('compact');
            const name = `<div class=\"name-badge\">${key} <span class=\"object-dims\">(${rows}×${cols})</span></div>`;
            let grid = `<div class=\"value-block ${compact ? 'compact' : ''}\"><div class=\"matrix-grid ${compact ? 'compact' : ''}\" style=\"grid-template-columns: repeat(${cols || 1}, 1fr)\">`;
            obj.value.forEach(row => { row.forEach(cell => { grid += `<div class=\"cell\">${Number(cell).toFixed(compact ? 1 : 2)}</div>`; }); });
            grid += '</div></div>';
            item.innerHTML = name + grid;
        } else if (obj.type === 'plane') {
            const n = Array.isArray(obj.normal) ? obj.normal : [0,0,1];
            const d = Number(obj.offset) || 0;
            const name = `<div class=\"name-badge\">${key}</div>`;
            const nStr = `(${n.map(v => (Number(v)||0).toFixed(2)).join(', ')})`;
            const body = `
                <div class=\"value-block\">
                    <div class=\"plane-badges\">
                        <span class=\"badge badge-n\" title=\"Normal vector\">n = ${nStr}</span>
                        <span class=\"badge badge-d\" title=\"Offset (n·x = d)\">d = ${d.toFixed(2)}</span>
                    </div>
                </div>`;
            item.classList.add('plane-card');
            item.innerHTML = name + body;
        } else if (obj.type === 'line') {
            const point = Array.isArray(obj.point) ? obj.point : [0,0,0];
            const direction = Array.isArray(obj.direction) ? obj.direction : [1,0,0];
            const planes = Array.isArray(obj.planes) ? obj.planes : [];
            const name = `<div class=\"name-badge\">${key}</div>`;
            const pointStr = `(${point.map(v => (Number(v)||0).toFixed(2)).join(', ')})`;
            const dirStr = `(${direction.map(v => (Number(v)||0).toFixed(2)).join(', ')})`;
            const planesStr = planes.length ? planes.join(' ∩ ') : '';
            const body = `
                <div class=\"value-block\">
                    <div class=\"line-badges\">
                        <span class=\"badge badge-planes\" title=\"Intersection of planes\">${planesStr}</span>
                        <span class=\"badge badge-point\" title=\"Point on line\">p = ${pointStr}</span>
                        <span class=\"badge badge-dir\" title=\"Direction vector\">v = ${dirStr}</span>
                    </div>
                </div>`;
            item.classList.add('line-card');
            item.innerHTML = name + body;
        } else if (obj.type === 'point') {
            const value = Array.isArray(obj.value) ? obj.value : [0,0,0];
            const planes = Array.isArray(obj.planes) ? obj.planes : [];
            const name = `<div class=\"name-badge\">${key}</div>`;
            const valueStr = `(${value.map(v => (Number(v)||0).toFixed(2)).join(', ')})`;
            const planesStr = planes.length ? planes.join(' ∩ ') : '';
            const body = `
                <div class=\"value-block\">
                    <div class=\"point-badges\">
                        <span class=\"badge badge-planes\" title=\"Intersection of planes\">${planesStr}</span>
                        <span class=\"badge badge-coords\" title=\"Coordinates\">${valueStr}</span>
                    </div>
                </div>`;
            item.classList.add('point-card');
            item.innerHTML = name + body;
        }
        
        listContainer.appendChild(item);
    }
    
    if (window.quickOpsSelectedKey) {
        const sel = listContainer.querySelector(`.object-item[data-key="${window.quickOpsSelectedKey}"]`);
        if (sel) sel.classList.add('selected');
    }
    
    const opSelect = document.getElementById('op-select');
    if (opSelect) buildOperationUI(opSelect.value);
}
function openOriginEditor(key, element) {
    
    closeInPlaceEditor();
    closeOriginEditor();

    const obj = sceneObjects[key];
    if (!obj || obj.type !== 'vector') return;

    element.classList.add('editing');

    
    const currentHeight = element.offsetHeight;
    const currentWidth = element.offsetWidth;
    element.style.minHeight = currentHeight + 'px';
    element.style.minWidth = currentWidth + 'px';

    
    const orig = vectorOrigins[key];
    originalOriginValue = orig ? { ...orig } : { __deleted__: true };

    
    const oCol = document.createElement('div');
    oCol.className = 'inplace-editor-v-col origin-editor-v-col';

    const currentOrigin = vectorOrigins[key] || (is2DMode ? {x:0, y:0} : {x:0, y:0, z:0});
    const axes = is2DMode ? ['x','y'] : ['x','y','z'];
    axes.forEach(axis => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-input';
        input.dataset.axis = axis;
        input.value = (Number(currentOrigin[axis]) || 0).toFixed(2);
        input.addEventListener('input', () => {
            const vals = { x:0, y:0 };
            oCol.querySelectorAll('.edit-input').forEach(inp => {
                vals[inp.dataset.axis] = parseFloat(inp.value) || 0;
            });
            if (!is2DMode) { if (vals.z === undefined) vals.z = 0; }
            vectorOrigins[key] = vals;
            updateVectorVisuals(key);
        });
        oCol.appendChild(input);
    });

    element.appendChild(oCol);

    
    requestAnimationFrame(() => {
        const styles = getComputedStyle(element);
        const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight) || 0;
        const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom) || 0;
        const nameH = element.querySelector('.name-badge')?.offsetHeight || 0;
        const neededW = Math.ceil(oCol.offsetWidth + padX);
        const neededH = Math.ceil(oCol.offsetHeight + nameH + 12 + padY);
        const baseMinW = parseFloat(element.style.minWidth) || currentWidth;
        const baseMinH = parseFloat(element.style.minHeight) || currentHeight;
        element.style.minWidth = Math.max(baseMinW, neededW) + 'px';
        element.style.minHeight = Math.max(baseMinH, neededH) + 'px';
    });

    oCol.querySelector('input')?.focus();
}

function closeOriginEditor() {
    const openEditor = document.querySelector('.object-item.editing');
    if (openEditor) {
        const key = openEditor.dataset.key;
        
        const oEditor = openEditor.querySelector('.origin-editor-v-col');
        if (key && oEditor) {
            
            if (originalOriginValue !== null) {
                if (originalOriginValue.__deleted__) {
                    delete vectorOrigins[key];
                } else {
                    vectorOrigins[key] = originalOriginValue;
                }
                updateVectorVisuals(key);
            }
            oEditor.remove();
            const valueBlock = openEditor.querySelector('.value-block');
            if (valueBlock) valueBlock.style.display = '';
            
            openEditor.style.height = '';
            openEditor.style.width = '';
            openEditor.style.minHeight = '';
            openEditor.style.minWidth = '';
            openEditor.classList.remove('editing');
        }
    }
    originalOriginValue = null;
}


let originalEditValue = null; 
let originalOriginValue = null; 

function closeInPlaceEditor() {
    const openEditor = document.querySelector('.object-item.editing');
    if (openEditor) {
        const key = openEditor.dataset.key;
        if (key && originalEditValue) {
            
            const obj = sceneObjects[key];
            if (obj.type === 'vector') {
                
                if (Array.isArray(originalEditValue.raw)) {
                    updateVectorInScene(key, originalEditValue.raw.slice());
                }
            } else if (obj.type === 'matrix') {
                obj.value = originalEditValue.map(r => r.slice());
                updateSceneFromObjects();
                updateObjectListUI();
            }
        } else if (key && !originalEditValue) {
            
            const obj = sceneObjects[key];
            if (obj && obj.type === 'vector' && Array.isArray(obj.raw)) {
                const valueBlock = openEditor.querySelector('.value-block');
                if (valueBlock) {
                    valueBlock.innerHTML = obj.raw.map(v => `
                        <div class="vector-row"><div class="vector-cell">${(Number(v) || 0).toFixed(2)}</div></div>
                    `).join('');
                }
            } else if (obj && obj.type === 'matrix' && Array.isArray(obj.value)) {
                
                const rows = obj.value.length;
                const cols = obj.value[0]?.length || 0;
                const compact = (rows >= 5 || cols >= 5 || (rows*cols) >= 16);
                const valueBlock = openEditor.querySelector('.value-block');
                if (valueBlock) {
                    valueBlock.classList.toggle('compact', compact);
                    let grid = `<div class="matrix-grid ${compact ? 'compact' : ''}" style="grid-template-columns: repeat(${cols || 1}, 1fr)">`;
                    obj.value.forEach(row => { row.forEach(cell => { grid += `<div class=\"cell\">${Number(cell).toFixed(compact ? 1 : 2)}</div>`; }); });
                    grid += '</div>';
                    valueBlock.innerHTML = grid;
                }
            }
        }
        
        const vEditor = openEditor.querySelector('.inplace-editor-v-col');
        if (vEditor) vEditor.remove();
        const pane = openEditor.querySelector('.edit-pane:not(.origin-pane)');
        if (pane) pane.remove();
        const valueBlock = openEditor.querySelector('.value-block');
        if (valueBlock) valueBlock.style.display = '';
        
        openEditor.style.height = '';
        openEditor.style.width = '';
        openEditor.style.minHeight = '';
        openEditor.style.minWidth = '';
        openEditor.classList.remove('editing');
    }
    originalEditValue = null;
}


function openInPlaceEditor(key, element) {
    closeInPlaceEditor(); 

    const obj = sceneObjects[key];
    if (!obj) return;

    
    if (obj.type === 'vector') {
        const raw = Array.isArray(obj.raw)
            ? obj.raw.slice()
            : (obj.value instanceof THREE.Vector3 ? [obj.value.x, obj.value.z, obj.value.y] : []);
        originalEditValue = { kind: 'vector', raw };
    } else if (obj.type === 'matrix') {
        originalEditValue = obj.value.map(r => r.slice());
    } else {
        originalEditValue = null;
    }

    element.classList.add('editing');

    
    const currentHeight = element.offsetHeight;
    const currentWidth = element.offsetWidth;
    element.style.minHeight = currentHeight + 'px';
    element.style.minWidth = currentWidth + 'px';

    if (obj.type === 'vector') {
        const valueBlock = element.querySelector('.value-block');
        if (valueBlock) valueBlock.style.display = 'none';

        const editorCol = document.createElement('div');
        editorCol.className = 'inplace-editor-v-col';

        const raw = Array.isArray(obj.raw)
            ? obj.raw.slice()
            : (obj.value instanceof THREE.Vector3 ? [obj.value.x, obj.value.z, obj.value.y] : []);

        raw.forEach((val, i) => {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'edit-input';
            input.value = (Number(val) || 0).toFixed(2);
            input.dataset.index = i;
            
            input.addEventListener('input', () => {
                const inputs = editorCol.querySelectorAll('.edit-input');
                const values = Array.from(inputs).map(inp => parseFloat(inp.value) || 0);
                updateVectorInScene(key, values);
            });
            editorCol.appendChild(input);
        });

        
        element.appendChild(editorCol);

        
        requestAnimationFrame(() => {
            const styles = getComputedStyle(element);
            const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight) || 0;
            const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom) || 0;
            const nameH = element.querySelector('.name-badge')?.offsetHeight || 0;
            const neededW = Math.ceil(editorCol.offsetWidth + padX);
            const neededH = Math.ceil(editorCol.offsetHeight + nameH + 12 + padY);
            const baseMinW = parseFloat(element.style.minWidth) || currentWidth;
            const baseMinH = parseFloat(element.style.minHeight) || currentHeight;
            element.style.minWidth = Math.max(baseMinW, neededW) + 'px';
            element.style.minHeight = Math.max(baseMinH, neededH) + 'px';
        });

        editorCol.querySelector('input')?.focus();
    } else if (obj.type === 'matrix') {
        const valueBlock = element.querySelector('.value-block');
        if (valueBlock) valueBlock.style.display = 'none';

        const editPane = document.createElement('div');
        editPane.className = 'edit-pane';
        
        renderMatrixGrid(editPane, obj.value);

        
        editPane.querySelectorAll('.editor-input').forEach(input => {
            input.addEventListener('input', () => {
                try {
                    const updatedMatrix = readMatrixGrid(editPane);
                    sceneObjects[key].value = updatedMatrix; 
                } catch (err) {
                    console.error('Invalid matrix input:', err);
                }
            });
        });

        element.appendChild(editPane);

        
        requestAnimationFrame(() => {
            const styles = getComputedStyle(element);
            const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight) || 0;
            const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom) || 0;
            const nameH = element.querySelector('.name-badge')?.offsetHeight || 0;
            const neededW = Math.ceil(editPane.offsetWidth + padX);
            const neededH = Math.ceil(editPane.offsetHeight + nameH + 12 + padY);
            const baseMinW = parseFloat(element.style.minWidth) || currentWidth;
            const baseMinH = parseFloat(element.style.minHeight) || currentHeight;
            element.style.minWidth = Math.max(baseMinW, neededW) + 'px';
            element.style.minHeight = Math.max(baseMinH, neededH) + 'px';
        });

        editPane.querySelector('input')?.focus();
    }
}


function activateSpanExplorer(basisVectors, threeVectors) {
    
    spanExplorerState.basis = basisVectors;
    spanExplorerState.basisNames = basisVectors.map((_, i) => String.fromCharCode(97 + i)); 
    
    
    const normal = new THREE.Vector3().crossVectors(threeVectors[0], threeVectors[1]).normalize();
    spanExplorerState.plane.setFromNormalAndCoplanarPoint(normal, new THREE.Vector3());
    
    
    const geometry = new THREE.SphereGeometry(0.15, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xff6b6b });
    spanExplorerState.targetMesh = new THREE.Mesh(geometry, material);
    spanExplorerState.targetMesh.position.set(1, 0, 1); 
    temporaryVisuals.add(spanExplorerState.targetMesh);
    
    
    spanExplorerState.active = true;
    
    
    const explorerPanel = document.getElementById('span-explorer-panel');
    if (explorerPanel) {
        explorerPanel.style.display = 'block';
    }
    
    
    setupSpanExplorerEvents();
    
    
    updateSpanExplorerCoefficients([1, 0, 1]);
}

function deactivateSpanExplorer() {
    spanExplorerState.active = false;
    
    
    const explorerPanel = document.getElementById('span-explorer-panel');
    if (explorerPanel) {
        explorerPanel.style.display = 'none';
    }
    
    
    if (spanExplorerState.targetMesh) {
        temporaryVisuals.remove(spanExplorerState.targetMesh);
        spanExplorerState.targetMesh = null;
    }
    
    
    removeSpanExplorerEvents();
}

function setupSpanExplorerEvents() {
    const canvas = document.getElementById('scene-canvas');
    if (canvas) {
        canvas.addEventListener('mousemove', onSpanExplorerMouseMove);
        canvas.addEventListener('click', onSpanExplorerClick);
    }
}

function removeSpanExplorerEvents() {
    const canvas = document.getElementById('scene-canvas');
    if (canvas) {
        canvas.removeEventListener('mousemove', onSpanExplorerMouseMove);
        canvas.removeEventListener('click', onSpanExplorerClick);
    }
}

function onSpanExplorerMouseMove(event) {
    if (!spanExplorerState.active) return;
    
    const mouse = new THREE.Vector2();
    mouse.x = (event.offsetX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.offsetY / renderer.domElement.clientHeight) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    const intersection = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(spanExplorerState.plane, intersection)) {
        
        if (spanExplorerState.targetMesh) {
            spanExplorerState.targetMesh.position.copy(intersection);
            
            
            const coefficients = calculateSpanCoefficients(intersection);
            updateSpanExplorerCoefficients([intersection.x, intersection.y, intersection.z], coefficients);
        }
    }
}

function onSpanExplorerClick(event) {
    if (!spanExplorerState.active) return;
    
    const mouse = new THREE.Vector2();
    mouse.x = (event.offsetX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.offsetY / renderer.domElement.clientHeight) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    const intersection = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(spanExplorerState.plane, intersection)) {
        
        if (spanExplorerState.targetMesh) {
            spanExplorerState.targetMesh.position.copy(intersection);
            
            
            const coefficients = calculateSpanCoefficients(intersection);
            updateSpanExplorerCoefficients([intersection.x, intersection.y, intersection.z], coefficients);
        }
    }
}

function calculateSpanCoefficients(targetPoint) {
    
    const v1 = new THREE.Vector3().copy(spanExplorerState.basis[0]);
    const v2 = new THREE.Vector3().copy(spanExplorerState.basis[1]);
    const target = new THREE.Vector3().copy(targetPoint);
    
    
    const A = [
        [v1.x, v2.x],
        [v1.y, v2.y],
        [v1.z, v2.z]
    ];
    
    const b = [target.x, target.y, target.z];
    
    
    const AtA = [
        [v1.x*v1.x + v1.y*v1.y + v1.z*v1.z, v1.x*v2.x + v1.y*v2.y + v1.z*v2.z],
        [v1.x*v2.x + v1.y*v2.y + v1.z*v2.z, v2.x*v2.x + v2.y*v2.y + v2.z*v2.z]
    ];
    
    const Atb = [
        v1.x*target.x + v1.y*target.y + v1.z*target.z,
        v2.x*target.x + v2.y*target.y + v2.z*target.z
    ];
    
    
    const det = AtA[0][0] * AtA[1][1] - AtA[0][1] * AtA[1][0];
    if (Math.abs(det) > 1e-10) {
        const c1 = (AtA[1][1] * Atb[0] - AtA[0][1] * Atb[1]) / det;
        const c2 = (AtA[0][0] * Atb[1] - AtA[1][0] * Atb[0]) / det;
        return [c1, c2];
    }
    
    return [0, 0];
}

function updateSpanExplorerCoefficients(targetPoint, coefficients) {
    const outputDiv = document.getElementById('span-explorer-output');
    if (!outputDiv) return;
    
    const [x, y, z] = targetPoint;
    const [c1, c2] = coefficients || calculateSpanCoefficients(new THREE.Vector3(x, y, z));
    
    const basisNames = spanExplorerState.basisNames;
    
    const html = `
        <div class="coefficient-display">
            <div class="point-info">
                <strong>Target Point:</strong> (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})
            </div>
            <div class="coefficient-info">
                <strong>Linear Combination:</strong><br>
                ${c1.toFixed(2)}·${basisNames[0]} + ${c2.toFixed(2)}·${basisNames[1]} = (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})
            </div>
            <div class="coefficient-values">
                <span class="coeff">${basisNames[0]} coefficient: ${c1.toFixed(3)}</span><br>
                <span class="coeff">${basisNames[1]} coefficient: ${c2.toFixed(3)}</span>
            </div>
        </div>
    `;
    
    outputDiv.innerHTML = html;
}


function animateSVDTransformation(U, S, Vt, matrix) {
    maybeClearTemporaryVisuals();
    
    
    const geometry = new THREE.CircleGeometry(1, 64);
    const material = new THREE.MeshBasicMaterial({ 
        color: 0x339af0, 
        transparent: true, 
        opacity: 0.3,
        side: THREE.DoubleSide 
    });
    const unitShape = new THREE.Mesh(geometry, material);
    temporaryVisuals.add(unitShape);
    
    
    const uMat = createMatrixFromArray(U);
    const sMat = createScaleMatrixFromArray(S);
    const vtMat = createMatrixFromArray(Vt);
    if (!uMat || !sMat || !vtMat) {
        console.warn('[viz] SVD viz skipped: unsupported matrix sizes');
        return;
    }
    
    
    animateTransformationSteps(unitShape, vtMat, sMat, uMat);
}

function animateTransformationSteps(shape, vtMat, sMat, uMat) {
    let step = 0;
    const totalSteps = 3;
    const duration = 2000; 
    const stepDuration = duration / totalSteps;
    
    
    setTimeout(() => {
        applyTransformation(shape, vtMat, 'V^T Rotation');
    }, stepDuration * 0);
    
    
    setTimeout(() => {
        applyTransformation(shape, sMat, 'S Scaling');
    }, stepDuration * 1);
    
    
    setTimeout(() => {
        applyTransformation(shape, uMat, 'U Rotation');
    }, stepDuration * 2);
}

function createMatrixFromArray(arr) {
    
    
    if (!Array.isArray(arr) || arr.length !== 2 || !Array.isArray(arr[0]) || !Array.isArray(arr[1]) || arr[0].length !== 2 || arr[1].length !== 2) {
        return null;
    }
    const mat = new THREE.Matrix3();
    
    mat.set(
        arr[0][0], arr[0][1], 0,
        arr[1][0], arr[1][1], 0,
        0, 0, 1
    );
    return mat;
}

function createScaleMatrixFromArray(arr) {
    
    const mat = new THREE.Matrix3();
    mat.set(
        arr[0], 0, 0,
        0, arr[1], 0,
        0, 0, 1
    );
    return mat;
}

function applyTransformation(shape, matrix, label) {
    
    const positions = shape.geometry.attributes.position;
    const transformedPositions = [];
    
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        
        const vertex = new THREE.Vector3(x, y, z);
        vertex.applyMatrix3(matrix);
        
        transformedPositions.push(vertex);
    }
    
    
    const newGeometry = new THREE.BufferGeometry();
    const points = transformedPositions.map(v => new THREE.Vector3(v.x, v.z, v.y));
    newGeometry.setFromPoints(points);
    
    
    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0xf59e0b, 
        transparent: true, 
        opacity: 0.8 
    });
    const line = new THREE.Line(newGeometry, lineMaterial);
    temporaryVisuals.add(line);
    
    
    addTextLabel(label, new THREE.Vector3(0, 2, 0), '#f59e0b', 16);
}


function handleVisualization(viz) {
    switch(viz.type) {
        case 'vector_addition': visualizeVectorAddition(viz.v1, viz.v2, viz.result); break;
        case 'scalar_multiplication': visualizeScalarMultiplication(viz.original, viz.result); break;
        case 'projection':
            if (is2DMode) visualizeProjection2D(viz.from, viz.onto, viz.result); else visualizeProjection(viz.from, viz.onto, viz.result);
            break;
        case 'subspace_projection': visualizeSubspaceProjection(viz.from, viz.subspaceBasis, viz.result); break;
        case 'span':
            if (is2DMode) visualizeSpan2D(viz.vectors); else visualizeSpan(viz.vectors);
            break;
        case 'basis':
            if (is2DMode) toggleBasisVectors2D(viz.show); else toggleBasisVectors(viz.show);
            break;
        case 'transform': animateMatrixTransformation(viz.matrix); break;
        case 'determinant': visualizeDeterminant(viz.matrix, viz.det); break;
        case 'eigenvectors': visualizeEigenvectors(viz.matrix, viz.values, viz.vectors); break;
        case 'least_squares': visualizeLeastSquares(viz.matrix, viz.b, viz.result); break;
        case 'orthogonal_complement': visualizeOrthogonalComplement(viz.basis, viz.complement); break;
        case 'gram_schmidt': visualizeGramSchmidt(viz.original, viz.final); break;
        case 'rank': visualizeRank(viz.matrix); break;
        case 'svd': animateSVDTransformation(viz.U, viz.S, viz.Vt, viz.matrix); break;
        case 'quadric': visualizeQuadricSurface(viz.matrix); break;
        case 'column_space': visualizeColumnSpace(viz.matrix); break;
        case 'null_space': visualizeNullSpace(viz.basis); break;
        case 'plane_intersection_line': visualizePlaneIntersectionLine(viz.point, viz.direction, viz.planes); break;
        case 'plane_intersection_point': visualizePlaneIntersectionPoint(viz.point, viz.planes); break;
        case 'plane_intersection_parallel': addTextLabel(`Planes ${viz.planes?.join(', ')} are parallel (no line)`, new THREE.Vector3(0, 2, 0), '#f87171', 16); break;
        case 'plane_intersection_coincident': addTextLabel(`Planes ${viz.planes?.join(', ')} coincide (infinite intersections)`, new THREE.Vector3(0, 2, 0), '#22c55e', 16); break;
        case 'plane_intersection_degenerate': addTextLabel(`Plane intersection is degenerate`, new THREE.Vector3(0, 2, 0), '#f59e0b', 16); break;
    }
}

function animateMatrixTransformation(matrix) {
    maybeClearTemporaryVisuals();
    
    
    const geometry = new THREE.CircleGeometry(1, 64);
    const material = new THREE.MeshBasicMaterial({ 
        color: 0x339af0, 
        transparent: true, 
        opacity: 0.3,
        side: THREE.DoubleSide 
    });
    const unitShape = new THREE.Mesh(geometry, material);
    temporaryVisuals.add(unitShape);
    
    
    const transformMat = createMatrixFromArray(matrix);
    if (!transformMat) {
        console.warn('[viz] Transform viz skipped: unsupported matrix size');
        return;
    }
    
    
    setTimeout(() => {
        applyTransformation(unitShape, transformMat, 'Matrix Transformation');
    }, 500);
}


function hideCreateTray() {
    const createTray = document.getElementById('create-tray');
    if (!createTray) return;
    createTray.classList.add('hidden');
    
    const content = document.getElementById('tray-content');
    if (content) content.innerHTML = '';
    const saveBtn = document.getElementById('create-save');
    if (saveBtn) saveBtn.textContent = 'Create';
    const nameInput = document.getElementById('create-name');
    if (nameInput) nameInput.disabled = false;
    currentEditKey = null;
    createMode = null;
}


function showCreateTray(mode, keyToEdit = null) {
    hideCreateTray(); 
    const createTray = document.getElementById('create-tray');
    const createTitle = document.getElementById('create-title');
    const createIcon = document.getElementById('create-icon');
    const contentArea = document.getElementById('tray-content');
    const saveButton = document.getElementById('create-save');

    createMode = mode;
    const genName = (base) => { let i = 1; while (sceneObjects[`${base}${i}`]) i++; return `${base}${i}`; };
    const objectName = keyToEdit ? keyToEdit : (mode === 'vector' ? genName('v') : genName('M'));
    let contentHTML = `
        <div class="tray-row">
            <label for="create-name" class="tray-label">Name</label>
            <input id="create-name" class="tray-input" type="text" value="${objectName}" ${keyToEdit ? 'disabled' : ''}>
        </div>
    `;

    if (mode === 'vector') {
        createTitle.textContent = keyToEdit ? 'Edit Vector' : 'New Vector';
        createIcon.textContent = '→';
        saveButton.textContent = keyToEdit ? 'Save' : 'Create';
        const existing = keyToEdit && sceneObjects[keyToEdit]?.raw ? `(${sceneObjects[keyToEdit].raw.join(', ')})` : '';
        contentHTML += `
            <div class="tray-row">
                <label for="vec-components" class="tray-label">Components</label>
                <input id="vec-components" class="tray-input" type="text" placeholder="e.g., (1, 2) or (4, 5, 6, 1)" value="${existing}">
            </div>
        `;
    } else if (mode === 'matrix') {
        createTitle.textContent = keyToEdit ? 'Edit Matrix' : 'New Matrix';
        createIcon.textContent = 'M';
        saveButton.textContent = keyToEdit ? 'Save' : 'Create & Edit';
        contentHTML += `
            <div class="tray-row">
                <label class="tray-label">Size</label>
                <div class="tray-mat-inputs" style="display: flex; gap: 8px; align-items: center;">
                    <input id="mat-rows" class="tray-input small" type="number" min="1" value="${sceneObjects[objectName]?.value?.length || 3}">
                    <span class="tray-mult">×</span>
                    <input id="mat-cols" class="tray-input small" type="number" min="1" value="${sceneObjects[objectName]?.value?.[0]?.length || 3}">
                </div>
            </div>
        `;
        if (keyToEdit && sceneObjects[keyToEdit]?.value) {
            
            contentHTML += `<div id="matrix-editor-container"></div>`;
        }
    }

    contentArea.innerHTML = contentHTML;
    if (mode === 'matrix' && keyToEdit && sceneObjects[keyToEdit]?.value) {
        const container = document.getElementById('matrix-editor-container');
        if (container) {
            renderMatrixGrid(container, sceneObjects[keyToEdit].value);
        }
    }
    createTray.classList.remove('hidden');
    contentArea.querySelector('input:not([disabled])')?.focus();
}

function showEditTray(key) {
    const obj = sceneObjects[key];
    if (!obj) return;
    if (obj.type === 'vector') {
        showCreateTray('vector', key);
        currentEditKey = key;
    } else if (obj.type === 'matrix') {
        showCreateTray('matrix', key);
        currentEditKey = key;
    }
}


function parseMatrixFromString(text) {
    
    try {
        const m = JSON.parse(text);
        validateNumericMatrix(m);
        return m;
    } catch (_) {
        
        const rows = text.split(/;|\n/).map(r => r.trim()).filter(Boolean);
        if (rows.length === 0) throw new Error('Empty matrix');
        const matrix = rows.map(r => r.split(/[,\s]+/).map(n => parseFloat(n)).filter(v => !Number.isNaN(v)));
        validateNumericMatrix(matrix);
        return matrix;
    }
}

function validateNumericMatrix(m) {
    if (!Array.isArray(m) || m.length === 0) throw new Error('Matrix must have at least 1 row');
    const cols = Array.isArray(m[0]) ? m[0].length : 0;
    if (cols === 0) throw new Error('Matrix must have at least 1 column');
    for (let i = 0; i < m.length; i++) {
        if (!Array.isArray(m[i]) || m[i].length !== cols) throw new Error('All rows must have the same number of columns');
        for (let j = 0; j < m[i].length; j++) {
            if (Number.isNaN(Number(m[i][j]))) throw new Error('All entries must be numbers');
            m[i][j] = Number(m[i][j]);
        }
    }
}

function updateSceneFromObjects() {
    
    Object.keys(sceneMeshes).forEach(key => {
        if (sceneMeshes[key]) {
            scene.remove(sceneMeshes[key]);
            sceneMeshes[key] = null;
        }
    });

    sceneMeshes = {};

    Object.entries(sceneObjects).forEach(([key, obj]) => {
        if (obj.type === 'vector' && obj.value instanceof THREE.Vector3 && obj.visible) {
            const arrow = createVectorArrow(obj.value, obj.color);
            arrow.userData = { isVector: true, key };
            
            
            const origin = vectorOrigins[key];
            if (origin) {
                
                arrow.position.set(origin.x || 0, origin.z || 0, origin.y || 0);
            }
            
            scene.add(arrow);
            sceneMeshes[key] = arrow;
        } else if (obj.type === 'plane' && obj.visible) {
            
            const dim = Number(obj.dim || (Array.isArray(obj.normal) ? obj.normal.length : 0));
            if (dim !== 3) return; 
            
            const n = Array.isArray(obj.normal) ? obj.normal : [0, 0, 1];
            const d = Number(obj.offset) || 0;
            const nVec = new THREE.Vector3(n[0] || 0, n[2] || 0, n[1] || 0); 
            const len = nVec.length();
            if (len < 1e-8) return; 
            const nHat = nVec.clone().divideScalar(len);
            
            const point = nHat.clone().multiplyScalar(d / len);
            
            const planeKeys = Object.keys(sceneObjects).filter(k => sceneObjects[k].type === 'plane').sort();
            const planeIndex = planeKeys.indexOf(key);
            const colorInfo = PLANE_COLORS[planeIndex % PLANE_COLORS.length];
            const pattern = PLANE_PATTERNS[planeIndex % PLANE_PATTERNS.length];
            
            const color = colorInfo.base;
            const size = Math.max(15, currentGridSize ? currentGridSize * 2.0 : 20);
            const visual = createPlaneVisual(nHat, point, size, color, pattern, colorInfo.name);
            visual.userData = { isPlane: true, key };
            scene.add(visual);
            sceneMeshes[key] = visual;
            try { scheduleIntersectionUpdate(); } catch(_) {}
        }
    });
    
    
    if (!is2DMode) {
        autoDetectPlaneIntersections();
        
        updateMainGridPlane();
    }
}

function setupScene() {
    scene = new THREE.Scene();
    createDynamicBackground();
    setupAtmosphericEffects();
    createGroundBackdrop();
    
    try { scene.add(temporaryVisuals); } catch(_) {}
    try { scene.add(intersectionVisuals); } catch(_) {}
}

function setupCamera() {
    const container = document.querySelector('.scene-container');
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    camera.position.set(8, 6, 8);
    
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
}

function setupRenderer() {
    const canvas = document.getElementById('scene-canvas');
    const container = document.querySelector('.scene-container');
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        logarithmicDepthBuffer: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; 
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding; 
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.physicallyCorrectLights = true;
}


function calculateWeightedColor(vector) {
    if (vector.lengthSq() < 1e-6) {
        return 0xffffff; 
    }

    
    const components = [
        { color: AXIS_COLOR_X, value: Math.abs(vector.x) },
        { color: AXIS_COLOR_Y, value: Math.abs(vector.z) },
        { color: AXIS_COLOR_Z, value: Math.abs(vector.y) }
    ];

    
    components.sort((a, b) => b.value - a.value);

    const dominant = components[0];
    const secondary = components[1];

    
    if (dominant.value < 1e-6 || secondary.value < 1e-6) {
        return dominant.color.getHex();
    }

    
    const mixFactor = Math.pow(secondary.value / dominant.value, 0.75);
    const finalColor = dominant.color.clone().lerp(secondary.color, mixFactor);

    
    const hsl = { h: 0, s: 0, l: 0 };
    finalColor.getHSL(hsl);

    
    hsl.s = Math.max(hsl.s, 0.90); 
    hsl.l = Math.max(hsl.l, 0.65); 

    
    finalColor.setHSL(hsl.h, hsl.s, hsl.l);
    

    return finalColor.getHex();
}

function createAxisLabel(text, position, color = '#94a3b8', size = 12) {
    const canvas = document.createElement('canvas');
    
    const dpr = Math.min(window.devicePixelRatio || 1, 4);
    const ctx = canvas.getContext('2d');

    
    const targetSize = size * 1.8;
    ctx.font = `700 ${targetSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
    const measured = ctx.measureText(text).width;
    const pad = 14;
    const cssW = Math.ceil(measured + pad);
    const cssH = Math.ceil(targetSize + pad);
    
    
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));

    ctx.scale(dpr, dpr);
    ctx.font = `700 ${targetSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    
    ctx.fillText(text, cssW / 2, cssH / 2);

    const texture = new THREE.CanvasTexture(canvas);
    
    texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() || 16;
    texture.encoding = THREE.sRGBEncoding;
    
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;

    const material = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true, 
        alphaTest: 0.1,
        depthTest: false, 
        depthWrite: false 
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    
    
    const baseScale = 0.01;
    sprite.scale.set(cssW * baseScale, cssH * baseScale, 1);
    sprite.renderOrder = 1001; 
    
    
    sprite.userData.cssW = cssW;
    sprite.userData.cssH = cssH;
    
    return sprite;
}

function createPatternTexture(type, accent = '#94a3b8', base = 'rgba(0,0,0,0)') {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);

    
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 64);

    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 3;

    if (type === 'stripes') {
        for (let i = -64; i < 128; i += 16) {
            ctx.beginPath();
            ctx.moveTo(i, 64);
            ctx.lineTo(i + 64, 0);
            ctx.stroke();
        }
    } else if (type === 'dots') {
        for (let y = 8; y < 64; y += 16) {
            for (let x = 8; x < 64; x += 16) {
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else if (type === 'chevrons') {
        ctx.lineWidth = 2.5;
        for (let y = 8; y < 64; y += 16) {
            for (let x = 0; x < 64; x += 16) {
                ctx.beginPath();
                ctx.moveTo(x + 2, y + 6);
                ctx.lineTo(x + 8, y);
                ctx.lineTo(x + 14, y + 6);
                ctx.stroke();
            }
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 1);
    texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() || 1;
    texture.encoding = THREE.sRGBEncoding;
    return texture;
}

function buildAxis(name, dir, length, pattern, accentColor) {
    const group = new THREE.Group();
    group.name = `Axis_${name}`;
    const headLength = 0.25;
    const radius = 0.02;
    const shaftLen = Math.max(2 * length - 2 * headLength, 0.01);

    
    const tex = createPatternTexture(pattern, '#ffffff', '#000000');
    
    tex.repeat.set(1, Math.max(2, Math.floor(shaftLen * 2)));

    
    const shaftMat = new THREE.MeshStandardMaterial({
        color: accentColor,
        emissive: accentColor,
        emissiveIntensity: 0.5,
        roughness: 0.85,
        metalness: 0.0,
        emissiveMap: tex
    });
    const headMat = new THREE.MeshStandardMaterial({
        color: accentColor,
        emissive: accentColor,
        emissiveIntensity: 0.5,
        roughness: 0.85,
        metalness: 0.0
    });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, shaftLen, 20, 1, true), shaftMat);
    const headP = new THREE.Mesh(new THREE.ConeGeometry(radius * 2.2, headLength, 20), headMat);
    const headN = new THREE.Mesh(new THREE.ConeGeometry(radius * 2.2, headLength, 20), headMat);

    headP.position.y = shaftLen / 2 + headLength / 2;
    headN.position.y = -(shaftLen / 2 + headLength / 2);
    headN.rotation.x = Math.PI;

    shaft.castShadow = false; headP.castShadow = false; headN.castShadow = false;
    group.add(shaft, headP, headN);

    
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    group.quaternion.copy(quat);

    
    const labelPlus = createAxisLabel(name, dir.clone().multiplyScalar(length + 0.35), '#cbd5e1', 12);
    const labelMinus = createAxisLabel(name, dir.clone().multiplyScalar(-length - 0.35), '#cbd5e1', 12);

    return { group, labels: [labelPlus, labelMinus] };
}

function createCustomAxes(length) {
    if (axesHelper) { scene.remove(axesHelper); }
    axesHelper = new THREE.Group();
    axesHelper.name = 'CustomAxes';

    
    const xAxis = buildAxis('X', new THREE.Vector3(1, 0, 0), length, 'stripes', AXIS_COLOR_X.getHex());
    const yAxis = buildAxis('Y', new THREE.Vector3(0, 0, 1), length, 'dots',    AXIS_COLOR_Y.getHex());
    const zAxis = buildAxis('Z', new THREE.Vector3(0, 1, 0), length, 'chevrons', AXIS_COLOR_Z.getHex());

    
    axesHelper.add(xAxis.group, yAxis.group, zAxis.group);
    scene.add(axesHelper);
}

function setupLighting() {
    const isDark = !document.documentElement.classList.contains('light-theme');
    
    
    const lightIntensity = isDark ? 1.0 : 1.4;
    const lightColor = isDark ? 0xb3d9ff : 0xffffff;
    
    const directionalLight = new THREE.DirectionalLight(lightColor, lightIntensity);
    directionalLight.position.set(10, 15, 5);
    directionalLight.castShadow = true;
    
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    const s = 20;
    directionalLight.shadow.camera.left = -s;
    directionalLight.shadow.camera.right = s;
    directionalLight.shadow.camera.top = s;
    directionalLight.shadow.camera.bottom = -s;
    scene.add(directionalLight);
    window.mainDirectionalLight = directionalLight;

    
    const skyColor = isDark ? 0x404080 : 0x87ceeb;
    const groundColor = isDark ? 0x1a1a2e : 0xf0f8ff;
    const ambientIntensity = isDark ? 0.4 : 0.6;
    
    const hemisphereLight = new THREE.HemisphereLight(skyColor, groundColor, ambientIntensity);
    scene.add(hemisphereLight);
    window.hemisphereLight = hemisphereLight;
    
    
    const rimLight = new THREE.DirectionalLight(isDark ? 0x6366f1 : 0xfbbf24, 0.3);
    rimLight.position.set(-5, 2, -5);
    scene.add(rimLight);
    window.rimLight = rimLight;
}

function updateLightingForTheme() {
    const isDark = !document.documentElement.classList.contains('light-theme');
    
    if (window.mainDirectionalLight) {
        const lightIntensity = isDark ? 1.0 : 1.4;
        const lightColor = isDark ? 0xb3d9ff : 0xffffff;
        window.mainDirectionalLight.intensity = lightIntensity;
        window.mainDirectionalLight.color.setHex(lightColor);
    }
    
    if (window.hemisphereLight) {
        const skyColor = isDark ? 0x404080 : 0x87ceeb;
        const groundColor = isDark ? 0x1a1a2e : 0xf0f8ff;
        const ambientIntensity = isDark ? 0.4 : 0.6;
        window.hemisphereLight.color.setHex(skyColor);
        window.hemisphereLight.groundColor.setHex(groundColor);
        window.hemisphereLight.intensity = ambientIntensity;
    }
    
    if (window.rimLight) {
        const rimColor = isDark ? 0x6366f1 : 0xfbbf24;
        window.rimLight.color.setHex(rimColor);
    }
}
function setupGridAndAxes() {
    const { major, minor } = getThemeGridColors();
    
    const isDark = !document.documentElement.classList.contains('light-theme');
    gridHelper = new THREE.GridHelper(10, 40, major, minor);
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = isDark ? 0.4 : 0.7; 
    gridHelper.material.linewidth = isDark ? 1.2 : 2.0; 
    scene.add(gridHelper);

    transformationGrid = new THREE.GridHelper(10, 40, major, major);
    transformationGrid.material.transparent = true;
    transformationGrid.material.opacity = isDark ? 0.2 : 0.35; 
    transformationGrid.material.linewidth = isDark ? 1.0 : 1.5;
    scene.add(transformationGrid);
    
    
    createCustomAxes(5);

    const i = createVectorArrow(new THREE.Vector3(1,0,0), 0xff4444);
    const j = createVectorArrow(new THREE.Vector3(0,1,0), 0x44ff44);
    const k = createVectorArrow(new THREE.Vector3(0,0,1), 0x4444ff);
    basisVectors.add(i, j, k);
    basisVectors.visible = false;
}

function calculateOptimalGridSize() {
    
    const vectors = Object.values(sceneObjects)
        .filter(o => o.type === 'vector' && (o.value instanceof THREE.Vector3))
        .map(o => o.value);
    const fallback = { size: 10, divisions: 20 };
    if (vectors.length === 0) return fallback;
    const maxMagnitude = Math.max(...vectors.map(v => v.length()), 5);
    const targetHalfSpan = Math.max(6, maxMagnitude * 1.2);
    
    const targetDivs = 10;
    const rawStep = targetHalfSpan / targetDivs;
    const mag = Math.floor(Math.log10(rawStep));
    const norm = rawStep / Math.pow(10, mag);
    let nice = 1;
    if (norm <= 1.5) nice = 1; else if (norm <= 3) nice = 2; else if (norm <= 7) nice = 5; else nice = 10;
    const step = nice * Math.pow(10, mag);
    
    const halfSize = Math.ceil(targetHalfSpan / step) * step;
    const size = Math.max(halfSize * 2, step * 10);
    const divisions = Math.min(160, Math.max(20, Math.round(size / step)));
    return { size, divisions };
}

function updateGrid(size = 10, divisions = 20, showGrid = true) {
    
    const cameraDistance = camera ? camera.position.length() : 10;
    
    
    const maxGridSize = Math.max(size * 4, 50); 
    const baseAdaptiveSize = Math.max(size * 2, cameraDistance * 2.5);
    const adaptiveSize = Math.min(baseAdaptiveSize, maxGridSize);
    
    let adaptiveDivisions = Math.max(divisions * 2, Math.floor(adaptiveSize * 1.2));
    
    if (adaptiveDivisions % 2 !== 0) adaptiveDivisions += 1;
    
    currentGridSize = adaptiveSize;
    currentGridDivisions = adaptiveDivisions;

    if (gridHelper) scene.remove(gridHelper);
    if (axesHelper) scene.remove(axesHelper);
    if (transformationGrid) scene.remove(transformationGrid);
    gridLabels.forEach(label => scene.remove(label));
    gridLabels.length = 0;

    if (showGrid) {
        const isDark = !document.documentElement.classList.contains('light-theme');
        const { major, minor } = getThemeGridColors();
        gridHelper = new THREE.GridHelper(adaptiveSize, adaptiveDivisions, major, minor);
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = isDark ? 0.4 : 0.7; 
        gridHelper.material.linewidth = isDark ? 1.2 : 2.0; 
        scene.add(gridHelper);
        
        transformationGrid = new THREE.GridHelper(adaptiveSize, adaptiveDivisions, major, major);
        transformationGrid.material.transparent = true;
        transformationGrid.material.opacity = isDark ? 0.2 : 0.35; 
        transformationGrid.material.linewidth = isDark ? 1.0 : 1.5;
        scene.add(transformationGrid);
    }

    
    createCustomAxes(adaptiveSize / 2);
    
    
    if (is2DMode) {
        createGridLabels(adaptiveSize, adaptiveSize / adaptiveDivisions);
    }
}

let gridUpdateTimeout = null;
let lastZoomTime = 0;
function updateResponsiveGrid() {
    
    if (gridUpdateTimeout) clearTimeout(gridUpdateTimeout);
    gridUpdateTimeout = setTimeout(() => {
        const { size, divisions } = calculateOptimalGridSize();
        updateGrid(size, divisions, true);
        gridUpdateTimeout = null;
    }, 150); 
}

function createGridLabels(gridSize, step) {
    if (step < 0.1) return; 
    const labelStep = Math.max(1, Math.floor(gridSize / 10));
    for (let i = labelStep; i <= gridSize / 2; i += labelStep) {
        addTextLabel(i.toString(), new THREE.Vector3(i, 0.05, 0));
        addTextLabel((-i).toString(), new THREE.Vector3(-i, 0.05, 0));
        addTextLabel(i.toString(), new THREE.Vector3(0, 0.05, i));
        addTextLabel((-i).toString(), new THREE.Vector3(0, 0.05, -i));
    }
}

function addTextLabel(text, position, color = '#e2e8f0', size = 10) {
    const canvas = document.createElement('canvas');
    
    const dpr = Math.min(window.devicePixelRatio || 1, 4);
    const ctx = canvas.getContext('2d');

    
    const targetSize = size * 1.5; 
    ctx.font = `Bold ${targetSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
    const measured = ctx.measureText(text).width;
    const pad = 12;
    const cssW = Math.ceil(measured + pad);
    const cssH = Math.ceil(targetSize + pad);
    
    
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));

    ctx.scale(dpr, dpr);
    ctx.font = `Bold ${targetSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    ctx.fillText(text, cssW / 2, cssH / 2);

    const texture = new THREE.CanvasTexture(canvas);
    
    texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() || 16;
    texture.encoding = THREE.sRGBEncoding;
    
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;

    const material = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true,
        alphaTest: 0.1,
        depthTest: false,
        depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    
    
    const baseScale = 0.008; 
    sprite.scale.set(cssW * baseScale, cssH * baseScale, 1.0);
    
    
    sprite.renderOrder = 1000; 
    
    gridLabels.push(sprite);
    scene.add(sprite);
    return sprite;
}

function createVectorArrow(vector, color) {
    const group = new THREE.Group();
    const length = vector.length();
    if (length < 1e-6) return group;

    const baseShaftRadius = 0.03;
    let headLength = 0.18;
    let headWidth = 0.08;
    let shaftLength = Math.max(length - headLength, 0.001);
    const minShaft = 0.05;
    if (length < headLength + minShaft) {
        const factor = Math.max(length / (headLength + minShaft), 0.1);
        headLength *= factor;
        headWidth *= factor;
        shaftLength = Math.max(length - headLength, 0.001);
    }

    const shaftGeometry = new THREE.CylinderGeometry(baseShaftRadius, baseShaftRadius, 1, 16);
    const shaftMaterial = new THREE.MeshStandardMaterial({ color: color,emissive: color,emissiveIntensity: 0.3, metalness: 0.1, roughness: 0.3 });
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
    shaft.castShadow = true;
    shaft.receiveShadow = false;
    
    const headGeometry = new THREE.ConeGeometry(headWidth, headLength, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: color, emissive: color,emissiveIntensity: 0.3, metalness: 0.1, roughness: 0.3 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.castShadow = true;
    head.receiveShadow = false;

    group.add(shaft, head);

    
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, side: THREE.BackSide, depthWrite: false });
    const shaftOutline = new THREE.Mesh(shaftGeometry, outlineMat.clone());
    shaftOutline.scale.set(1.08, 1.0, 1.08);
    shaftOutline.renderOrder = -1;
    const headOutline = new THREE.Mesh(headGeometry.clone(), outlineMat.clone());
    headOutline.renderOrder = -1;
    
    shaftOutline.userData.isOutline = true;
    headOutline.userData.isOutline = true;
    group.add(shaftOutline, headOutline);

    
    if (enh('vectorLabels')) {
        const val = vector.clone();
        const text = `[${val.x.toFixed(2)}, ${val.z.toFixed(2)}, ${val.y.toFixed(2)}]  ‖v‖=${length.toFixed(2)}`;
        const label = addTextLabel(text, new THREE.Vector3(), '#' + new THREE.Color(color).getHexString(), 18);
        label.userData = label.userData || {}; label.userData.isVectorLabel3D = true;
        group.add(label);
    }

    updateVectorArrow(group, vector);
    return group;
}


function createPlaneVisual(normal, point, size, color, pattern = 'solid', colorName = '') {
    const group = new THREE.Group();

    
    const n = normal.clone().normalize();
    
    const arbitrary = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
    const u = new THREE.Vector3().crossVectors(arbitrary, n).normalize();
    const v = new THREE.Vector3().crossVectors(n, u).normalize();

    
    const planeHalf = 3.5; 
    const extendedHalf = Math.max(size, currentGridSize || 20); 
    
    const p00 = new THREE.Vector3().copy(point).addScaledVector(u, -planeHalf).addScaledVector(v, -planeHalf);
    const p10 = new THREE.Vector3().copy(point).addScaledVector(u,  planeHalf).addScaledVector(v, -planeHalf);
    const p11 = new THREE.Vector3().copy(point).addScaledVector(u,  planeHalf).addScaledVector(v,  planeHalf);
    const p01 = new THREE.Vector3().copy(point).addScaledVector(u, -planeHalf).addScaledVector(v,  planeHalf);

    
    const geom = new THREE.BufferGeometry();
    const verts = new Float32Array([
        p00.x, p00.y, p00.z,
        p10.x, p10.y, p10.z,
        p11.x, p11.y, p11.z,

        p00.x, p00.y, p00.z,
        p11.x, p11.y, p11.z,
        p01.x, p01.y, p01.z,
    ]);
    const uvs = new Float32Array([
        0, 0,  1, 0,  1, 1,
        0, 0,  1, 1,  0, 1
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.computeVertexNormals();

    const baseCol = new THREE.Color(color);
    
    
    const texture = createPlaneTexture(pattern, baseCol);
    const meshMat = new THREE.MeshStandardMaterial({
        
        color: baseCol,
        transparent: true,
        opacity: 0.8,
        roughness: 0.3,
        metalness: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
        emissive: baseCol.clone().multiplyScalar(0.2)
    });
    const mesh = new THREE.Mesh(geom, meshMat);
    mesh.receiveShadow = true;
    mesh.renderOrder = 1; 
    group.add(mesh);

    
    const edgeGeom = new THREE.BufferGeometry();
    const edgeVerts = new Float32Array([
        p00.x, p00.y, p00.z,  p10.x, p10.y, p10.z,
        p10.x, p10.y, p10.z,  p11.x, p11.y, p11.z,
        p11.x, p11.y, p11.z,  p01.x, p01.y, p01.z,
        p01.x, p01.y, p01.z,  p00.x, p00.y, p00.z,
    ]);
    edgeGeom.setAttribute('position', new THREE.BufferAttribute(edgeVerts, 3));
    const outline = new THREE.LineSegments(
        edgeGeom,
        new THREE.LineBasicMaterial({ 
            color: baseCol.clone().multiplyScalar(1.2).getHex(), 
            transparent: true, 
            opacity: 0.95, 
            linewidth: 3 
        })
    );
    outline.renderOrder = 2;
    group.add(outline);
    
    
    const glowOutline = new THREE.LineSegments(
        edgeGeom.clone(),
        new THREE.LineBasicMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.2, 
            linewidth: 5 
        })
    );
    glowOutline.renderOrder = 1.8;
    group.add(glowOutline);

    
    const traceGeom = new THREE.BufferGeometry();
    const tracePts = [];
    const maxTrace = extendedHalf;
    
    
    if (Math.abs(n.z) > 1e-6) {
        const t = n.dot(point) / n.z;
        
        const xyDir = new THREE.Vector3(-n.y, n.x, 0).normalize();
        if (xyDir.lengthSq() > 1e-6) {
            const xyCenter = new THREE.Vector3(0, 0, t);
            const xyStart = xyCenter.clone().addScaledVector(xyDir, -maxTrace);
            const xyEnd = xyCenter.clone().addScaledVector(xyDir, maxTrace);
            tracePts.push(xyStart.x, xyStart.y, xyStart.z, xyEnd.x, xyEnd.y, xyEnd.z);
        }
    }
    
    
    if (Math.abs(n.y) > 1e-6) {
        const t = n.dot(point) / n.y;
        const xzDir = new THREE.Vector3(-n.z, 0, n.x).normalize();
        if (xzDir.lengthSq() > 1e-6) {
            const xzCenter = new THREE.Vector3(0, t, 0);
            const xzStart = xzCenter.clone().addScaledVector(xzDir, -maxTrace);
            const xzEnd = xzCenter.clone().addScaledVector(xzDir, maxTrace);
            tracePts.push(xzStart.x, xzStart.y, xzStart.z, xzEnd.x, xzEnd.y, xzEnd.z);
        }
    }
    
    
    if (Math.abs(n.x) > 1e-6) {
        const t = n.dot(point) / n.x;
        const yzDir = new THREE.Vector3(0, -n.z, n.y).normalize();
        if (yzDir.lengthSq() > 1e-6) {
            const yzCenter = new THREE.Vector3(t, 0, 0);
            const yzStart = yzCenter.clone().addScaledVector(yzDir, -maxTrace);
            const yzEnd = yzCenter.clone().addScaledVector(yzDir, maxTrace);
            tracePts.push(yzStart.x, yzStart.y, yzStart.z, yzEnd.x, yzEnd.y, yzEnd.z);
        }
    }
    
    if (tracePts.length > 0) {
        traceGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tracePts), 3));
        const traceMat = new THREE.LineBasicMaterial({ 
            color: baseCol.clone().multiplyScalar(0.7).getHex(), 
            transparent: true, 
            opacity: 0.8,
            linewidth: 2
        });
        const traceLines = new THREE.LineSegments(traceGeom, traceMat);
        traceLines.renderOrder = 1.5;
        group.add(traceLines);
    }

    
    if (enh && enh('planeLabels')) {
        
        const userN = { x: n.x, y: n.z, z: n.y };
        const d = n.dot(point);
        const eq = `${userN.x.toFixed(2)}x + ${userN.y.toFixed(2)}y + ${userN.z.toFixed(2)}z = ${d.toFixed(2)}`;
        const label = addTextLabel(eq, point.clone(), '#ffffff', 18);
        label.position.addScaledVector(u, half * 0.15).addScaledVector(v, half * 0.15).addScaledVector(n, 0.001);
        label.renderOrder = 3;
        group.add(label);
    }

    return group;
}


function createPlaneTexture(pattern, baseColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    
    const colorHex = '#' + baseColor.getHexString();
    const lightColor = baseColor.clone().multiplyScalar(1.3).getHexString();
    const darkColor = baseColor.clone().multiplyScalar(0.7).getHexString();
    
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 256, 256);
    
    switch (pattern) {
        case 'diagonal':
            ctx.strokeStyle = '#' + lightColor;
            ctx.lineWidth = 2;
            for (let i = -256; i < 512; i += 32) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 256, 256);
                ctx.stroke();
            }
            break;
            
        case 'grid':
            ctx.strokeStyle = '#' + darkColor;
            ctx.lineWidth = 1;
            for (let i = 0; i < 256; i += 32) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, 256);
                ctx.moveTo(0, i);
                ctx.lineTo(256, i);
                ctx.stroke();
            }
            break;
            
        case 'dots':
            ctx.fillStyle = '#' + lightColor;
            for (let x = 16; x < 256; x += 32) {
                for (let y = 16; y < 256; y += 32) {
                    ctx.beginPath();
                    ctx.arc(x, y, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            break;
            
        case 'waves':
            ctx.strokeStyle = '#' + lightColor;
            ctx.lineWidth = 3;
            for (let y = 32; y < 256; y += 64) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                for (let x = 0; x < 256; x += 4) {
                    const wave = y + Math.sin(x * 0.05) * 12;
                    ctx.lineTo(x, wave);
                }
                ctx.stroke();
            }
            break;
            
        case 'solid':
        default:
            
            const imageData = ctx.getImageData(0, 0, 256, 256);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const noise = (Math.random() - 0.5) * 10;
                data[i] = Math.max(0, Math.min(255, data[i] + noise));
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
            }
            ctx.putImageData(imageData, 0, 0);
            break;
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
}


function blendPlaneColors(planeKeys) {
    if (!planeKeys || planeKeys.length === 0) return 0x10b981;
    
    const allPlaneKeys = Object.keys(sceneObjects).filter(k => sceneObjects[k].type === 'plane').sort();
    let totalR = 0, totalG = 0, totalB = 0;
    
    planeKeys.forEach(key => {
        const planeIndex = allPlaneKeys.indexOf(key);
        if (planeIndex >= 0) {
            const colorInfo = PLANE_COLORS[planeIndex % PLANE_COLORS.length];
            const color = new THREE.Color(colorInfo.base);
            totalR += color.r;
            totalG += color.g;
            totalB += color.b;
        }
    });
    
    const count = planeKeys.length;
    const blendedColor = new THREE.Color(totalR / count, totalG / count, totalB / count);
    return blendedColor.getHex();
}


let intersectionUpdateTimer = null;
function scheduleIntersectionUpdate(delay = 60) {
    if (intersectionUpdateTimer) clearTimeout(intersectionUpdateTimer);
    intersectionUpdateTimer = setTimeout(() => {
        try { updatePlaneIntersections(); } finally { intersectionUpdateTimer = null; }
    }, delay);
}

function getVisiblePlaneDefs() {
    const planes = [];
    Object.entries(sceneObjects).forEach(([key, obj]) => {
        if (obj && obj.type === 'plane' && obj.visible !== false && sceneMeshes[key]) {
            
            const a = Number(obj.normal?.[0]) || 0;
            const b = Number(obj.normal?.[1]) || 0;
            const c = Number(obj.normal?.[2]) || 0;
            const d = Number(obj.offset) || 0;
            const n = new THREE.Vector3(a,b,c);
            if (n.lengthSq() < 1e-10) return;
            const point = n.clone().multiplyScalar(d / n.lengthSq()); 
            planes.push({ key, n, d, point });
        }
    });
    return planes;
}

function clearExistingIntersections() {
    if (!intersectionVisuals) return;
    const disposeNode = (node) => {
        try { node.geometry?.dispose?.(); } catch(_) {}
        if (Array.isArray(node.material)) node.material.forEach(m=>{ try { m?.dispose?.(); } catch(_) {} });
        else { try { node.material?.dispose?.(); } catch(_) {} }
    };
    while (intersectionVisuals.children.length) {
        const child = intersectionVisuals.children.pop();
        child.traverse?.(disposeNode);
        try { intersectionVisuals.remove(child); } catch(_) {}
    }
}

function updatePlaneIntersections() {
    clearExistingIntersections();
    const planes = getVisiblePlaneDefs();
    if (planes.length < 2) return;
    
    for (let i=0;i<planes.length;i++) {
        for (let j=i+1;j<planes.length;j++) {
            const line = computeTwoPlaneIntersection(planes[i], planes[j]);
            if (line) drawIntersectionLine(line, [planes[i].key, planes[j].key]);
        }
    }
    
    if (planes.length >= 3) {
        outer: for (let i=0;i<planes.length;i++) {
            for (let j=i+1;j<planes.length;j++) {
                for (let k=j+1;k<planes.length;k++) {
                    const p = computeThreePlaneIntersection(planes[i], planes[j], planes[k]);
                    if (p) { drawIntersectionPoint(p, [planes[i].key, planes[j].key, planes[k].key]); break outer; }
                }
            }
        }
    }
}

function computeThreePlaneIntersection(p1, p2, p3) {
    const n1 = p1.n, n2 = p2.n, n3 = p3.n;
    const d1 = p1.d, d2 = p2.d, d3 = p3.d;
    const det = n1.x * (n2.y * n3.z - n2.z * n3.y)
              - n1.y * (n2.x * n3.z - n2.z * n3.x)
              + n1.z * (n2.x * n3.y - n2.y * n3.x);
    if (Math.abs(det) < 1e-10) return null;
    const x = (d1 * (n2.y * n3.z - n2.z * n3.y)
             - n1.y * (d2 * n3.z - d3 * n2.z)
             + n1.z * (d2 * n3.y - d3 * n2.y)) / det;
    const y = (n1.x * (d2 * n3.z - d3 * n2.z)
             - d1  * (n2.x * n3.z - n2.z * n3.x)
             + n1.z * (n2.x * d3   - n3.x * d2)) / det;
    const z = (n1.x * (n2.y * d3   - n3.y * d2)
             - n1.y * (n2.x * d3   - n3.x * d2)
             + d1  * (n2.x * n3.y - n2.y * n3.x)) / det;
    return new THREE.Vector3(x,y,z);
}

function computeTwoPlaneIntersection(p1, p2) {
    const dir = new THREE.Vector3().crossVectors(p1.n, p2.n);
    if (dir.lengthSq() < 1e-12) return null; 
    dir.normalize();
    
    let point;
    if (Math.abs(dir.z) >= Math.max(Math.abs(dir.x), Math.abs(dir.y))) {
        const det = p1.n.x * p2.n.y - p1.n.y * p2.n.x; if (Math.abs(det) < 1e-12) return null;
        const x = (p1.d * p2.n.y - p2.d * p1.n.y) / det;
        const y = (p1.n.x * p2.d - p2.n.x * p1.d) / det;
        point = new THREE.Vector3(x, y, 0);
    } else if (Math.abs(dir.y) >= Math.abs(dir.x)) {
        const det = p1.n.x * p2.n.z - p1.n.z * p2.n.x; if (Math.abs(det) < 1e-12) return null;
        const x = (p1.d * p2.n.z - p2.d * p1.n.z) / det;
        const z = (p1.n.x * p2.d - p2.n.x * p1.d) / det;
        point = new THREE.Vector3(x, 0, z);
    } else {
        const det = p1.n.y * p2.n.z - p1.n.z * p2.n.y; if (Math.abs(det) < 1e-12) return null;
        const y = (p1.d * p2.n.z - p2.d * p1.n.z) / det;
        const z = (p1.n.y * p2.d - p2.n.y * p1.d) / det;
        point = new THREE.Vector3(0, y, z);
    }
    return { point, dir };
}

function drawIntersectionLine(line, planeKeys) {
    const extent = Math.max(currentGridSize || 20, 15);
    const a = line.point.clone().addScaledVector(line.dir, -extent);
    const b = line.point.clone().addScaledVector(line.dir, extent);
    const geom = new THREE.BufferGeometry().setFromPoints([a,b]);
    const color = blendPlaneColors(planeKeys);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Line(geom, mat);
    mesh.renderOrder = 9982;
    mesh.userData = { type: 'intersection_line', planes: planeKeys };
    intersectionVisuals.add(mesh);
}

function drawIntersectionPoint(pos, planeKeys) {
    const group = new THREE.Group();
    group.userData = { type: 'intersection_point', planes: planeKeys };
    const color = blendPlaneColors(planeKeys);
    const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 16, 16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 16, 16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25 })
    );
    core.renderOrder = 9990; glow.renderOrder = 9989;
    
    core.userData = { type: 'intersection_point', planes: planeKeys };
    glow.userData = { type: 'intersection_point', planes: planeKeys };
    core.name = 'intersection_point_core';
    glow.name = 'intersection_point_glow';
    group.add(glow); group.add(core);
    group.position.copy(pos);
    intersectionVisuals.add(group);
}


function updateMainGridPlane() {
    
    if (mainGridPlane) {
        scene.remove(mainGridPlane);
        if (mainGridPlane.geometry) mainGridPlane.geometry.dispose();
        if (mainGridPlane.material) mainGridPlane.material.dispose();
        mainGridPlane = null;
    }
    
    
    const visiblePlanes = Object.values(sceneObjects).filter(obj => 
        obj.type === 'plane' && obj.visible && obj.dim === 3
    );
    
    if (visiblePlanes.length === 0) return; 
    
    
    const avgPlaneSize = visiblePlanes.length > 0 ? 
        Math.max(15, currentGridSize ? currentGridSize * 2.0 : 20) : 20;
    
    
    const gridPlaneSize = avgPlaneSize * 3.0; 
    const geometry = new THREE.PlaneGeometry(gridPlaneSize, gridPlaneSize, 20, 20);
    
    
    const material = new THREE.MeshBasicMaterial({
        color: 0x000000, 
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
        wireframe: false 
    });
    
    mainGridPlane = new THREE.Mesh(geometry, material);
    mainGridPlane.rotation.x = -Math.PI / 2; 
    mainGridPlane.position.set(0, 0, 0); 
    mainGridPlane.renderOrder = -1; 
    
    scene.add(mainGridPlane);
}

function updateVectorArrow(arrow, vector) {
    const length = vector.length();
    if (length < 1e-6 || arrow.children.length < 2) { arrow.visible = false; return; }
    arrow.visible = true;

    let headLength = 0.18;
    let headWidth = 0.08;
    let shaftLength = Math.max(length - headLength, 0.001);
    const minShaft = 0.05;
    if (length < headLength + minShaft) {
        const factor = Math.max(length / (headLength + minShaft), 0.1);
        headLength *= factor;
        headWidth *= factor;
        shaftLength = Math.max(length - headLength, 0.001);
    }

    const shaft = arrow.children[0];
    const head = arrow.children[1];

    shaft.position.y = shaftLength / 2;
    shaft.scale.set(1, shaftLength > 0 ? shaftLength : 0.001, 1);

    const hg = head.geometry;
    const baseRadius = hg.parameters.radius;
    const baseHeight = hg.parameters.height;
    if (baseRadius && baseHeight) {
        head.scale.set(
            headWidth / baseRadius,
            headLength / baseHeight,
            headWidth / baseRadius
        );
    }
    head.position.y = shaftLength + headLength / 2 - 0.001;

    
    const shaftOutline = arrow.children[2];
    const headOutline = arrow.children[3];
    if (shaftOutline && shaftOutline.userData?.isOutline) {
        shaftOutline.position.y = shaft.position.y;
        shaftOutline.scale.set(1.08, shaft.scale.y, 1.08);
    }
    if (headOutline && headOutline.userData?.isOutline) {
        if (baseRadius && baseHeight) {
            headOutline.scale.set(
                (headWidth / baseRadius) * 1.12,
                (headLength / baseHeight) * 1.02,
                (headWidth / baseRadius) * 1.12
            );
        }
        headOutline.position.y = head.position.y;
    }

    const direction = vector.clone().normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    arrow.quaternion.copy(quaternion);
    arrow.position.set(0,0,0);

    
    let label = null;
    if (enh('vectorLabels')) {
        for (let i = 0; i < arrow.children.length; i++) {
            const ch = arrow.children[i];
            if (ch && ch.userData && ch.userData.isVectorLabel3D) { label = ch; break; }
        }
    }
    if (enh('vectorLabels') && label) {
        const val = vector.clone();
        const txt = `[${val.x.toFixed(2)}, ${val.z.toFixed(2)}, ${val.y.toFixed(2)}]  ‖v‖=${length.toFixed(2)}`;
        
        if (!label.userData.lastText || label.userData.lastText !== txt) {
            
            if (label.material?.map) label.material.map.dispose();
            if (label.material) label.material.dispose();
            const newLabel = addTextLabel(txt, new THREE.Vector3(), '#ffffff', 18);
            label.material = newLabel.material;
            label.userData.lastText = txt;
        }
        
        const tip = direction.clone().multiplyScalar(shaftLength + headLength * 0.9);
        const side = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0,1,0));
        if (side.lengthSq() < 1e-6) side.set(1,0,0);
        side.normalize().multiplyScalar(0.12);
        label.position.copy(tip.add(side));
        label.renderOrder = 9998;
        label.frustumCulled = false;
        label.scale.multiplyScalar(0.85);
    }
}

class BasicOrbitControls {
    constructor(camera, domElement) {
        this.camera = camera; this.domElement = domElement; this.enabled = true;
        this.rotateSpeed = 0.4; this.zoomSpeed = 0.8; this.panSpeed = 0.6; this.dampingFactor = 0.08;
        this.isRotating = false; this.isPanning = false; this.mouseStart = new THREE.Vector2();
        this.mouseEnd = new THREE.Vector2(); this.mouseDelta = new THREE.Vector2();
        this.spherical = new THREE.Spherical(); this.sphericalDelta = new THREE.Spherical();
        this.target = new THREE.Vector3(); this.setupEventListeners();
        this.minDistance = 0.1; this.maxDistance = 1000; 
    }
    setupEventListeners() {
        this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this), { passive: false });
        this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    handleMouseDown(event) {
        if (!this.enabled) return; this.mouseStart.set(event.clientX, event.clientY);
        if (event.button === 0) { this.isRotating = true; } else if (event.button === 2) { this.isPanning = true; }
    }
    handleMouseMove(event) {
        if (!this.enabled || (!this.isRotating && !this.isPanning)) return;
        this.mouseEnd.set(event.clientX, event.clientY); this.mouseDelta.subVectors(this.mouseEnd, this.mouseStart);
        if (this.isRotating) {
            const element = this.domElement;
            this.sphericalDelta.theta -= 2 * Math.PI * this.mouseDelta.x / element.clientWidth * this.rotateSpeed;
            this.sphericalDelta.phi -= 2 * Math.PI * this.mouseDelta.y / element.clientHeight * this.rotateSpeed;
        }
        if (this.isPanning) {
            const offset = new THREE.Vector3().copy(this.camera.position).sub(this.target);
            const targetDistance = offset.length();
            const panLeft = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
            const panUp = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
            panLeft.multiplyScalar(-this.mouseDelta.x * targetDistance * 0.0008 * this.panSpeed);
            panUp.multiplyScalar(this.mouseDelta.y * targetDistance * 0.0008 * this.panSpeed);
            this.target.add(panLeft).add(panUp);
        }
        this.mouseStart.copy(this.mouseEnd);
    }
    handleMouseUp(event) { if (!this.enabled) return; this.isRotating = false; this.isPanning = false; }
    onMouseWheel(event) {
        if (!this.enabled) return; event.preventDefault();
        
        
        const delta = event.deltaY;
        const sensitivity = 1.15; 
        const zoomFactor = delta > 0 ? sensitivity : 1 / sensitivity;
        
        const offset = new THREE.Vector3().copy(this.camera.position).sub(this.target);
        const currentDistance = offset.length();
        
        
        offset.multiplyScalar(zoomFactor);
        const newDistance = offset.length();
        
        
        if (newDistance < this.minDistance) {
            offset.setLength(this.minDistance);
        } else if (newDistance > this.maxDistance) {
            offset.setLength(this.maxDistance);
        }
        
        this.camera.position.copy(this.target).add(offset);
        
        try { lastZoomTime = (performance && performance.now) ? performance.now() : Date.now(); } catch(_) { lastZoomTime = Date.now(); }
        try { updateResponsiveGrid(); } catch(_) {}
    }
    update() {
        const offset = new THREE.Vector3().copy(this.camera.position).sub(this.target);
        this.spherical.setFromVector3(offset);
        this.spherical.theta += this.sphericalDelta.theta; this.spherical.phi += this.sphericalDelta.phi;
        this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi));
        this.spherical.makeSafe();
        offset.setFromSpherical(this.spherical);
        this.camera.position.copy(this.target).add(offset);
        this.camera.lookAt(this.target);
        this.sphericalDelta.theta *= (1 - this.dampingFactor); this.sphericalDelta.phi *= (1 - this.dampingFactor);
    }
}

function setupControls() {
    controls = new BasicOrbitControls(camera, renderer.domElement);
    raycaster = new THREE.Raycaster();
    
    try {
        raycaster.params.Line = raycaster.params.Line || {};
        raycaster.params.Line.threshold = 0.15;
    } catch(_) {}
    mouse = new THREE.Vector2();
    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseup', onCanvasMouseUp);
}

function setupEventHandlers() {
    const commandInput = document.getElementById('command-input');
    const commandEnter = document.getElementById('command-enter');
    const opSelect = document.getElementById('op-select');
    const opExecute = document.getElementById('op-execute');
    const opBuilder = document.getElementById('op-builder');
    const themeToggle = document.getElementById('theme-toggle');
    const viewToggle = document.getElementById('view-toggle');
    const presetSelect = document.getElementById('preset-select');
    const presetRun = document.getElementById('preset-run');

    
    const helpOpen = document.getElementById('help-open');
    const helpModal = document.getElementById('help-modal');
    const helpCloseBtn = helpModal?.querySelector('.help-close');
    if (helpOpen && helpModal) {
        helpOpen.addEventListener('click', () => {
            helpModal.classList.add('active');
            helpOpen.setAttribute('aria-expanded', 'true');
        });
    }
    if (helpCloseBtn && helpModal) {
        helpCloseBtn.addEventListener('click', () => {
            helpModal.classList.remove('active');
            helpOpen?.setAttribute('aria-expanded', 'false');
        });
    }
    if (helpModal) {
        
        const commandGuides = {
            inv: 'Requires A: defined square, non-singular matrix. Example: A = [[1,0],[0,1]]',
            det: 'Requires A: defined square matrix. Example: A = [[1,2],[3,4]]',
            rank: 'Requires A: defined matrix. Example: A = [[1,2,3],[0,1,1]]',
            qr: 'Requires A: defined matrix. Example: A = [[1,0],[1,1]]',
            lu: 'Requires A: defined square or factorizable matrix. Example: A = [[2,1],[4,3]]',
            svd: 'Requires A: defined matrix. Example: A = [[1,0,0],[0,2,0]]',
            eigen: 'Requires A: defined square matrix. Example: A = [[2,0],[0,3]]',
            dot: 'Requires u,v: defined vectors. Example: u=(1,2,3), v=(0,1,0)',
            cross: 'Requires u,v: defined 3D vectors. Example: u=(1,0,0), v=(0,1,0)',
            norm: 'Requires v: defined vector. Example: v=(3,4,0)',
            proj: 'Requires v and u (vector) or A (subspace). Example: proj(v,u) with v=(1,2,3), u=(0,1,0)',
            span: 'Requires vectors. Example: span(v1,v2) with v1=(1,0,0), v2=(0,1,0)',
            leastsquares: 'Requires A (matrix) and b (vector). Example: b=(1,2,3)',
            orthcomp: 'Requires v (vector) or A (matrix/subspace).',
            gramschmidt: 'Requires A (columns or list of vectors).',
            gram_schmidt: 'Requires vectors. Example: gram_schmidt(v1,v2,...)',
            quadric: 'Requires symmetric A for x^T A x = 1 visualization.',
            colspace: 'Requires A: defined matrix.',
            nullspace: 'Requires A: defined matrix.',
            basis: 'No external variables. Use basis(on) or basis(off).',
            transform: 'Requires A: defined matrix to apply to scene vectors.',
            reset: 'No arguments. Resets grid / transform.'
        };
        
        function extractIdents(cmd) {
            const m = cmd.match(/^\s*([a-zA-Z_][\w]*)\s*\((.*)\)\s*$/);
            if (!m) return { fn: null, idents: [] };
            const fn = m[1].toLowerCase();
            const inside = m[2];
            
            const parts = inside.split(',').map(s => s.trim()).filter(Boolean);
            const idents = [];
            for (const p of parts) {
                
                if (/^[a-zA-Z_]\w*$/.test(p)) idents.push(p);
            }
            return { fn, idents };
        }
        
        function showArgsGuide(anchorEl, fn, missing) {
            const rect = anchorEl.getBoundingClientRect();
            const tip = document.createElement('div');
            tip.className = 'args-guide-tooltip';
            const guide = commandGuides[fn] || 'Provide required inputs before running.';
            const missText = missing.length ? `Missing: ${missing.join(', ')}` : '';
            tip.innerHTML = `<div class="title">Arguments Guide</div><div class="body">${guide}</div>${missText ? `<div class="missing">${missText}</div>` : ''}`;
            document.body.appendChild(tip);
            const top = window.scrollY + rect.top - tip.offsetHeight - 8;
            const left = window.scrollX + rect.left + Math.max(0, (rect.width - tip.offsetWidth) / 2);
            tip.style.top = `${Math.max(8, top)}px`;
            tip.style.left = `${Math.max(8, left)}px`;
            
            setTimeout(() => tip.remove(), 3500);
            tip.addEventListener('click', () => tip.remove());
        }
        
        helpModal.addEventListener('click', (e) => {
            const presetBtn = e.target.closest('button[data-preset]');
            if (presetBtn) {
                const name = presetBtn.getAttribute('data-preset');
                if (name) runPreset(name);
                return;
            }
            const cmdBtn = e.target.closest('button[data-command]');
            if (cmdBtn) {
                const cmd = cmdBtn.getAttribute('data-command');
                if (cmd) {
                    const { fn, idents } = extractIdents(cmd);
                    
                    const noVarFns = new Set(['basis', 'reset']);
                    if (!fn || noVarFns.has(fn)) { parseCommand(cmd); return; }
                    const missing = [];
                    for (const name of idents) { if (!sceneObjects[name]) missing.push(name); }
                    if (missing.length) {
                        showArgsGuide(cmdBtn, fn, missing);
                        return;
                    }
                    parseCommand(cmd);
                }
                return;
            }
            const actionBtn = e.target.closest('button[data-action]');
            if (actionBtn) {
                const action = actionBtn.getAttribute('data-action');
                switch (action) {
                    case 'toggle-view': document.getElementById('view-toggle')?.click(); break;
                    case 'toggle-theme': document.getElementById('theme-toggle')?.click(); break;
                    case 'toggle-hover': document.getElementById('hover-toggle')?.click(); break;
                    case 'toggle-overlay': document.getElementById('overlay-toggle')?.click(); break;
                    default: break;
                }
                return;
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && helpModal.classList.contains('active')) {
                helpModal.classList.remove('active');
                helpOpen?.setAttribute('aria-expanded', 'false');
            }
        });
    }

    
    const helpToggle = document.getElementById('help-toggle');
    const quickHelp = document.getElementById('quick-help');
    if (helpToggle && quickHelp) {
        helpToggle.addEventListener('click', () => {
            quickHelp.classList.toggle('open');
            const isOpen = quickHelp.classList.contains('open');
            helpToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
        
        quickHelp.addEventListener('click', (e) => {
            const btn = e.target.closest('button.link-btn[data-preset]');
            if (!btn) return;
            const name = btn.getAttribute('data-preset');
            if (name) {
                runPreset(name);
            }
        });
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    
    const resetCamera = document.getElementById('reset-camera');
    const resetZoom = document.getElementById('reset-zoom');
    
    
    const coordinateDisplay = document.getElementById('coordinate-display');
    const coordText = document.getElementById('coord-text');
    const hoverTooltip = document.getElementById('hover-tooltip');
    const tooltipContent = document.getElementById('tooltip-content');
    const canvas = document.getElementById('scene-canvas');
    const hoverToggle = document.getElementById('hover-toggle');
    const overlayToggle = document.getElementById('overlay-toggle');
    const clearOverlaysBtn = document.getElementById('clear-overlays');
    
    let hoveredObject = null;
    let hoverTimeout = null;
    let hoverEnabled = true;
    let lastHoverCheck = 0;
    const HOVER_INTERVAL_MS = 32; 
    const HOVER_HIDE_DELAY_MS = 120; 
    
    if (resetCamera) {
        resetCamera.addEventListener('click', () => {
            if (is2DMode) {
                
                if (camera2D && controls2D) {
                    camera2D.position.set(0, 0, 10);
                    camera2D.zoom = 1;
                    camera2D.updateProjectionMatrix();
                    controls2D.target.set(0, 0, 0);
                    controls2D.update();
                    if (typeof update2DAxisLabels === 'function') update2DAxisLabels();
                    if (typeof update2DGrid === 'function') update2DGrid();
                    if (typeof refreshAll2DVectorArrows === 'function') refreshAll2DVectorArrows();
                }
            } else {
                
                if (camera && controls) {
                    camera.position.set(8, 6, 8);
                    camera.lookAt(0, 0, 0);
                    controls.target.set(0, 0, 0);
                    controls.update();
                }
            }
        });
    }
    
    if (resetZoom) {
        resetZoom.addEventListener('click', () => {
            if (is2DMode) {
                
                if (typeof resetZoom2D === 'function') {
                    resetZoom2D();
                } else {
                    
                    if (camera2D && controls2D) {
                        camera2D.zoom = 1;
                        camera2D.position.set(0, 0, 10);
                        camera2D.updateProjectionMatrix();
                        controls2D.target.set(0, 0, 0);
                        controls2D.update();
                        if (typeof update2DAxisLabels === 'function') update2DAxisLabels();
                        if (typeof update2DGrid === 'function') update2DGrid();
                        if (typeof refreshAll2DVectorArrows === 'function') refreshAll2DVectorArrows();
                    }
                }
            } else {
                
                if (camera && controls) {
                    const direction = new THREE.Vector3();
                    camera.getWorldDirection(direction);
                    const target = controls.target.clone();
                    camera.position.copy(target).add(direction.multiplyScalar(-12));
                    controls.update();
                }
            }
        });
    }
    
    
    if (hoverToggle) {
        hoverToggle.addEventListener('click', toggleHoverAssistant);
        hoverToggle.setAttribute('aria-pressed', 'true');
        hoverToggle.classList.add('active');
    }

    
    function toggleMultiOverlay() {
        multiOverlayEnabled = !multiOverlayEnabled;
        if (overlayToggle) {
            overlayToggle.setAttribute('aria-pressed', String(multiOverlayEnabled));
            overlayToggle.classList.toggle('active', multiOverlayEnabled);
        }
    }
    if (overlayToggle) {
        overlayToggle.addEventListener('click', toggleMultiOverlay);
        overlayToggle.setAttribute('aria-pressed', String(multiOverlayEnabled));
        overlayToggle.classList.toggle('active', multiOverlayEnabled);
        overlayToggle.setAttribute('title', 'Toggle Multi-Overlay (L)');
    }
    if (clearOverlaysBtn) {
        clearOverlaysBtn.addEventListener('click', () => {
            clearAllOverlays();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'h' || e.key === 'H') {
            toggleHoverAssistant();
        }
        if (e.key === 'l' || e.key === 'L') {
            toggleMultiOverlay();
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && e.shiftKey) {
            e.preventDefault();
            clearAllOverlays();
        }
    });

    function toggleHoverAssistant() {
        hoverEnabled = !hoverEnabled;
        if (hoverToggle) {
            hoverToggle.setAttribute('aria-pressed', String(hoverEnabled));
            hoverToggle.classList.toggle('active', hoverEnabled);
        }
        if (!hoverEnabled) {
            
            hoverTooltip.classList.add('hidden');
            clearHoverHighlight();
            canvas.style.cursor = 'default';
        }
    }

    
    if (canvas && coordinateDisplay && coordText && hoverTooltip && tooltipContent) {
        canvas.addEventListener('mousemove', (event) => {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            
            let intersectedObject = null;
            let didRaycast = false;
            const now = (window.performance && performance.now) ? performance.now() : Date.now();
            const canRaycast = hoverEnabled && (now - lastHoverCheck) >= HOVER_INTERVAL_MS;
            if (raycaster && (camera || camera2D) && canRaycast) {
                const mouse = new THREE.Vector2();
                mouse.x = (x / rect.width) * 2 - 1;
                mouse.y = -(y / rect.height) * 2 + 1;
                
                const currentCamera = is2DMode ? camera2D : camera;
                raycaster.setFromCamera(mouse, currentCamera);
                
                
                const currentScene = is2DMode ? scene2D : scene;
                const meshesToCheck = is2DMode
                    ? [...Object.values(sceneMeshes2D), temporaryVisuals2D]
                    : [...Object.values(sceneMeshes), temporaryVisuals, intersectionVisuals];
                const intersects = raycaster.intersectObjects(meshesToCheck.filter(Boolean), true);
                
                if (intersects.length > 0) {
                    
                    const rank = (ud) => {
                        if (!ud) return 1000;
                        if (ud.type === 'intersection_point') return 0;
                        if (ud.type === 'intersection_line') return 1;
                        if (ud.type === 'intersection_area') return 2;
                        if (ud.isVector) return 3;
                        if (ud.isPlane || ud.isPlane2D) return 4;
                        if (ud.key) return 5;
                        return 100;
                    };
                    let obj = null, bestScore = Infinity;
                    for (let i = 0; i < intersects.length; i++) {
                        const candidate = findInteractiveRoot(intersects[i].object) || intersects[i].object;
                        if (candidate.userData && isInteractiveUserData(candidate.userData)) {
                            const s = rank(candidate.userData);
                            if (s < bestScore) { bestScore = s; obj = candidate; if (s === 0) break; }
                        }
                    }
                    if (!obj) {
                        
                        didRaycast = true;
                        lastHoverCheck = now;
                        return;
                    }
                    
                    
                    if (obj.userData && (obj.userData.isVector || obj.userData.key || obj.userData.type || obj.userData.isPlane || obj.userData.isPlane2D)) {
                        intersectedObject = obj;
                        if (hoverTimeout) { clearTimeout(hoverTimeout); hoverTimeout = null; }
                        
                        
                        const objectInfo = getObjectInfo(obj);
                        if (objectInfo) {
                            tooltipContent.innerHTML = objectInfo;
                            hoverTooltip.style.left = `${rect.left + x + 15}px`;
                            hoverTooltip.style.top = `${rect.top + y - 10}px`;
                            hoverTooltip.classList.remove('hidden');
                        }
                        
                        
                        if (hoveredObject !== obj) {
                            clearHoverHighlight();
                            highlightObject(obj);
                            hoveredObject = obj;
                            canvas.style.cursor = 'pointer';
                        }
                    }
                }
                didRaycast = true;
                lastHoverCheck = now;
            }
            
            
            if (didRaycast && !intersectedObject) {
                if (hoverTimeout) clearTimeout(hoverTimeout);
                hoverTimeout = setTimeout(() => {
                    clearHoverHighlight();
                    hoverTooltip.classList.add('hidden');
                    canvas.style.cursor = 'default';
                }, HOVER_HIDE_DELAY_MS);
                
                
                let worldX, worldY;
                
                if (is2DMode && camera2D) {
                    
                    const mouse = new THREE.Vector2();
                    mouse.x = (x / rect.width) * 2 - 1;
                    mouse.y = -(y / rect.height) * 2 + 1;
                    
                    const zoom = camera2D.zoom || 1;
                    const worldWidth = (camera2D.right - camera2D.left) / zoom;
                    const worldHeight = (camera2D.top - camera2D.bottom) / zoom;
                    
                    worldX = camera2D.position.x + (mouse.x * worldWidth / 2);
                    worldY = camera2D.position.y + (mouse.y * worldHeight / 2);
                } else if (camera && raycaster) {
                    
                    const mouse = new THREE.Vector2();
                    mouse.x = (x / rect.width) * 2 - 1;
                    mouse.y = -(y / rect.height) * 2 + 1;
                    
                    raycaster.setFromCamera(mouse, camera);
                    
                    const cameraDistance = camera.position.distanceTo(controls?.target || new THREE.Vector3(0, 0, 0));
                    const rayDirection = raycaster.ray.direction.clone();
                    const rayOrigin = raycaster.ray.origin.clone();
                    
                    const projectedPoint = rayOrigin.add(rayDirection.multiplyScalar(cameraDistance));
                    
                    worldX = projectedPoint.x;
                    worldY = projectedPoint.z;
                    const worldZ = projectedPoint.y;
                    
                    const displayMode = '3D';
                    coordText.textContent = `${displayMode}: x: ${worldX.toFixed(2)}, y: ${worldY.toFixed(2)}, z: ${worldZ.toFixed(2)}`;
                    coordinateDisplay.classList.remove('hidden');
                    return;
                }
                
                if (worldX !== undefined && worldY !== undefined) {
                    const displayMode = is2DMode ? '2D' : '3D';
                    coordText.textContent = `${displayMode}: x: ${worldX.toFixed(2)}, y: ${worldY.toFixed(2)}`;
                    coordinateDisplay.classList.remove('hidden');
                }
            } else {
                coordinateDisplay.classList.add('hidden');
            }
        });
        
        canvas.addEventListener('mouseleave', () => {
            if (hoverTimeout) { clearTimeout(hoverTimeout); hoverTimeout = null; }
            coordinateDisplay.classList.add('hidden');
            hoverTooltip.classList.add('hidden');
            clearHoverHighlight();
            canvas.style.cursor = 'default';
        });
        
        
        canvas.addEventListener('mousedown', () => {
            if (hoverTimeout) { clearTimeout(hoverTimeout); hoverTimeout = null; }
            coordinateDisplay.classList.add('hidden');
            hoverTooltip.classList.add('hidden');
        });
    }
    
    
    function isInteractiveUserData(ud) {
        if (!ud) return false;
        if (ud.isVector || ud.isPlane || ud.isPlane2D) return true;
        if (
            ud.type === 'intersection_line' ||
            ud.type === 'intersection_point' ||
            ud.type === 'intersection_area' ||
            ud.type === 'projection_2d' ||
            ud.type === 'span_2d'
        ) return true;
        if (ud.key) return true;
        return false;
    }
    function findInteractiveRoot(obj) {
        let cur = obj;
        while (cur) {
            if (cur.userData && isInteractiveUserData(cur.userData)) return cur;
            cur = cur.parent;
        }
        return null;
    }

    function getObjectInfo(obj) {
        if (!obj.userData) {
            return null;
        }
        
        
        if (obj.userData.type === 'intersection_point') {
            const wp = new THREE.Vector3();
            
            const root = findInteractiveRoot(obj) || obj;
            (root.getWorldPosition ? root.getWorldPosition(wp) : obj.getWorldPosition?.(wp));
            
            const ux = wp.x, uy = wp.z, uz = wp.y;
            const planes = (obj.userData.planes || root.userData?.planes || []).join(', ');
            return `<strong>Intersection Point</strong><br/>Of: ${planes || '—'}<br/>P = (${ux.toFixed(2)}, ${uy.toFixed(2)}, ${uz.toFixed(2)})`;
        }

        
        if (obj.userData.type === 'intersection_line') {
            
            let dir = null; let pt = null;
            const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
            const candidate = (obj.isLine || obj.isMesh) ? obj : (findInteractiveRoot(obj) || obj);
            if (candidate && candidate.geometry) {
                const posAttr = candidate.geometry.getAttribute && candidate.geometry.getAttribute('position');
                if (posAttr && posAttr.count >= 2) {
                    tmpA.set(posAttr.getX(0), posAttr.getY(0), posAttr.getZ(0)).applyMatrix4(candidate.matrixWorld);
                    tmpB.set(posAttr.getX(1), posAttr.getY(1), posAttr.getZ(1)).applyMatrix4(candidate.matrixWorld);
                    const diff = tmpB.clone().sub(tmpA);
                    if (diff.lengthSq() > 1e-12) {
                        dir = diff.normalize();
                        pt = tmpA.clone();
                    }
                }
            }

            
            let ptStr = '';
            let dirStr = '';
            if (pt) {
                const ux = pt.x, uy = pt.z, uz = pt.y;
                ptStr = `P0 = (${ux.toFixed(2)}, ${uy.toFixed(2)}, ${uz.toFixed(2)})`;
            }
            if (dir) {
                const dx = dir.x, dy = dir.z, dz = dir.y;
                dirStr = `d = (${dx.toFixed(2)}, ${dy.toFixed(2)}, ${dz.toFixed(2)})`;
            }
            const planes = (obj.userData.planes || candidate?.userData?.planes || []).join(', ');
            return `<strong>Intersection Line</strong><br/>Of: ${planes || '—'}${ptStr ? `<br/>${ptStr}` : ''}${dirStr ? `<br/>${dirStr}` : ''}`;
        }

        
        if (obj.userData.isVector && obj.userData.key) {
            const key = obj.userData.key;
            const vObj = sceneObjects[key];
            if (vObj && vObj.type === 'vector') {
                let comps = null;
                if (Array.isArray(vObj.raw) && (vObj.raw.length === 2 || vObj.raw.length === 3)) {
                    comps = vObj.raw.slice();
                } else if (vObj.value && vObj.value.isVector3) {
                    
                    comps = [vObj.value.x, vObj.value.z, vObj.value.y];
                }
                const dim = Array.isArray(comps) ? comps.length : 3;
                const mag = (vObj.value && vObj.value.isVector3)
                    ? vObj.value.length()
                    : (Array.isArray(comps) ? Math.hypot(...(dim === 2 ? [comps[0]||0, comps[1]||0] : [comps[0]||0, comps[1]||0, comps[2]||0])) : 0);
                const fmt = (arr) => `(${arr.map(n => Number(n||0).toFixed(2)).join(', ')})`;
                const compLabel = Array.isArray(comps)
                    ? (dim === 2 ? `v = ${fmt([comps[0], comps[1]])}` : `v = ${fmt([comps[0], comps[1] ?? 0, comps[2] ?? 0])}`)
                    : 'v = (—)';
                const magStr = `‖v‖ = ${Number(mag || 0).toFixed(2)}`;
                const origin = vectorOrigins[key];
                let originStr = '';
                if (origin) {
                    originStr = (dim === 2)
                        ? `Origin: (${Number(origin.x||0).toFixed(2)}, ${Number(origin.y||0).toFixed(2)})`
                        : `Origin: (${Number(origin.x||0).toFixed(2)}, ${Number(origin.y||0).toFixed(2)}, ${Number(origin.z||0).toFixed(2)})`;
                }
                return `<strong>${key}</strong><br/>${compLabel}<br/>${magStr}${originStr ? `<br/>${originStr}` : ''}`;
            }
        }

        
        if (obj.userData.key && sceneObjects[obj.userData.key]) {
            const objData = sceneObjects[obj.userData.key];
            if (objData && objData.type === 'matrix' && Array.isArray(objData.value)) {
                const rows = objData.value.length;
                const cols = objData.value[0]?.length || 0;
                return `<strong>${obj.userData.key}</strong><br/>Matrix: ${rows}×${cols}<br/>Click to edit`;
            }
        }

        
        if (obj.userData.isPlane && obj.userData.key) {
            const p = sceneObjects[obj.userData.key];
            if (p && p.type === 'plane') {
                const n = Array.isArray(p.normal) ? p.normal : [0,0,1];
                const d = Number(p.offset) || 0;
                const eq = `${n[0].toFixed(2)}·x + ${n[1].toFixed(2)}·y + ${n[2].toFixed(2)}·z = ${d.toFixed(2)}`;
                const len = Math.sqrt((n[0]||0)**2 + (n[1]||0)**2 + (n[2]||0)**2);
                return `<strong>${obj.userData.key}</strong><br/>Plane: n·x = d<br/>n = (${n.map(v=>Number(v).toFixed(2)).join(', ')})<br/>|n| = ${len.toFixed(2)}<br/>d = ${d.toFixed(2)}<br/>Equation: ${eq}`;
            }
        }

        
        if (obj.userData.isPlane2D && obj.userData.key) {
            const p = sceneObjects[obj.userData.key];
            if (p && p.type === 'plane') {
                const a = Number(p.normal?.[0]) || 0;
                const b = Number(p.normal?.[1]) || 0;
                const d = Number(p.offset) || 0;
                const eq = `${a.toFixed(2)}·x + ${b.toFixed(2)}·y = ${d.toFixed(2)}`;
                return `<strong>${obj.userData.key}</strong><br/>Line (2D plane): ax + by = d<br/>n = (${a.toFixed(2)}, ${b.toFixed(2)})<br/>d = ${d.toFixed(2)}<br/>Equation: ${eq}`;
            }
        }

        
        if (obj.userData.type === 'intersection_point' || obj.userData.type === 'intersection_line') {
            const isPoint = obj.userData.type === 'intersection_point';
            const label = isPoint ? 'Intersection Point' : 'Intersection Line';
            const planes = Array.isArray(obj.userData.planes) ? obj.userData.planes : [];
            const planesStr = planes.length ? planes.join(' ∩ ') : 'planes';
            const fmt = (arr) => Array.isArray(arr) ? `(${arr.map(n => Number(n||0).toFixed(2)).join(', ')})` : '';
            if (isPoint) {
                const p = obj.userData.point;
                return `<strong>${label}</strong><br/>Of: ${planesStr}${p ? `<br/>Point: ${fmt(p)}` : ''}`;
            } else {
                const p = obj.userData.point;
                const d = obj.userData.direction;
                return `<strong>${label}</strong><br/>Of: ${planesStr}${p ? `<br/>Point on line: ${fmt(p)}` : ''}${d ? `<br/>Direction: ${fmt(d)}` : ''}`;
            }
        }
        if (obj.userData.type === 'intersection_area') {
            const planes = Array.isArray(obj.userData.planes) ? obj.userData.planes : [];
            const planesStr = planes.length ? planes.join(' ∩ ') : 'planes';
            return `<strong>Intersection Region</strong><br/>Of: ${planesStr}`;
        }
        
        
        if (obj.userData.type === 'projection_2d') {
            const fmt = (arr) => Array.isArray(arr) ? `[${arr.map(n => Number(n||0).toFixed(2)).join(', ')}]` : '';
            return `<strong>Projection (2D)</strong><br/>From: ${fmt(obj.userData.from)}<br/>Onto: ${fmt(obj.userData.onto)}<br/>Result: ${fmt(obj.userData.result)}`;
        }
        if (obj.userData.type === 'span_2d') {
            const vecs = Array.isArray(obj.userData.vectors) ? obj.userData.vectors.filter(v => Array.isArray(v)) : [];
            const fmt2 = (v) => `[${Number(v[0]||0).toFixed(2)}, ${Number(v[1]||0).toFixed(2)}]`;
            let kind = 'Line';
            if (vecs.length >= 2) {
                const a = vecs[0], b = vecs[1];
                const det = (Number(a[0])||0)*(Number(b[1])||0) - (Number(a[1])||0)*(Number(b[0])||0);
                if (Math.abs(det) > 1e-6) kind = 'R²';
            }
            return `<strong>Span (2D)</strong><br/>Generators: ${vecs.map(fmt2).join(', ') || '—'}<br/>Span: ${kind}`;
        }
        
        
        if (obj.userData.key) {
            return `<strong>${obj.userData.key}</strong><br/>Object detected`;
        }
        
        if (obj.userData.type) {
            return `<strong>${obj.userData.type}</strong><br/>Interactive object`;
        }
        
        return null;
    }
    
    function highlightObject(obj) {
        if (!obj) return;
        
        
        const targetObj = findInteractiveRoot(obj) || obj;
        
        
        targetObj.traverse((child) => {
            if (child.material) {
                child.userData.originalEmissive = child.material.emissive?.getHex() || 0;
                child.userData.originalEmissiveIntensity = child.material.emissiveIntensity || 0;
                
                if (child.material.emissive) {
                    child.material.emissive.setHex(0xffffff);
                    child.material.emissiveIntensity = 1.0;
                } else if (child.material.color && child.userData.originalColorHex === undefined) {
                    
                    child.userData.originalColorHex = child.material.color.getHex();
                    child.material.color.setHex(0xffff88);
                }
            }
        });

        
        if (targetObj.userData && (
            targetObj.userData.type === 'intersection_point' ||
            targetObj.userData.type === 'intersection_line' ||
            targetObj.userData.type === 'intersection_area' ||
            targetObj.userData.type === 'projection_2d' ||
            targetObj.userData.type === 'span_2d'
        )) {
            if (!targetObj.userData.__origScale) targetObj.userData.__origScale = targetObj.scale.clone();
            targetObj.scale.multiplyScalar(1.15);
        }
        
        
        if (targetObj.element) {
            targetObj.element.classList.add('vector-hover');
        }
    }
    
    function clearHoverHighlight() {
        if (!hoveredObject) return;
        
        const targetObj = findInteractiveRoot(hoveredObject) || hoveredObject;
        
        
        targetObj.traverse((child) => {
            if (child.material && child.userData.originalEmissive !== undefined) {
                if (child.material.emissive) {
                    child.material.emissive.setHex(child.userData.originalEmissive);
                    child.material.emissiveIntensity = child.userData.originalEmissiveIntensity;
                }
                delete child.userData.originalEmissive;
                delete child.userData.originalEmissiveIntensity;
            }
            if (child.material && child.userData.originalColorHex !== undefined) {
                if (child.material.color) {
                    child.material.color.setHex(child.userData.originalColorHex);
                }
                delete child.userData.originalColorHex;
            }
        });
        
        
        if (targetObj.element) {
            targetObj.element.classList.remove('vector-hover');
        }
        
        if (targetObj.userData && targetObj.userData.__origScale) {
            targetObj.scale.copy(targetObj.userData.__origScale);
            delete targetObj.userData.__origScale;
        }
        
        hoveredObject = null;
    }

    
    if (viewToggle) {
        viewToggle.addEventListener('click', toggleView);
        
        viewToggle.textContent = is2DMode ? '2D' : '3D';
    }

    if (opSelect) {
        opSelect.addEventListener('change', () => {
            buildOperationUI(opSelect.value);
        });
        
        initCustomOpSelect();
        
        buildOperationUI(opSelect.value);
    }

    if (opExecute) {
        opExecute.addEventListener('click', () => {
            const op = opSelect.value;
            if (!op) return;
            let args = [];
            if (op === 'gramschmidt') {
                args = Array.from(opBuilder.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
            } else {
                args = Array.from(opBuilder.querySelectorAll('select')).map(select => select.value);
            }
            const command = `${op}(${args.join(',')})`;
            parseCommand(command);
        });
    }

    commandEnter.addEventListener('click', () => parseCommand(commandInput.value));
    commandInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') parseCommand(commandInput.value); });

    
    if (presetRun) {
        presetRun.addEventListener('click', async () => {
            const name = presetSelect && presetSelect.value;
            if (!name) return;
            const originalText = presetRun.textContent;
            presetRun.disabled = true;
            presetRun.textContent = 'Running…';
            try {
                await runPreset(name);
            } catch (err) {
                displayCommandError(err.message || String(err));
            } finally {
                presetRun.disabled = false;
                presetRun.textContent = originalText;
            }
        });
    }

    
    const newVecBtn = document.getElementById('btn-new-vector');
    const newMatBtn = document.getElementById('btn-new-matrix');
    const createTray = document.getElementById('create-tray');
    const createSave = document.getElementById('create-save');
    const createCancel = document.getElementById('create-cancel');

    if (createCancel) createCancel.addEventListener('click', hideCreateTray);
    if (newVecBtn) newVecBtn.addEventListener('click', () => showCreateTray('vector'));
    if (newMatBtn) newMatBtn.addEventListener('click', () => showCreateTray('matrix'));

    if (createTray) {
        createTray.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hideCreateTray();
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                createSave?.click();
            }
        });
    }

    if (createSave) createSave.addEventListener('click', () => {
        const name = (document.getElementById('create-name')?.value || '').trim();
        if (!name) { document.getElementById('create-name')?.focus(); return; }

        
        if (currentEditKey) {
            const obj = sceneObjects[currentEditKey];
            if (!obj) { hideCreateTray(); return; }
            if (obj.type === 'vector') {
                const componentsInput = document.getElementById('vec-components');
                const values = (componentsInput?.value || '')
                    .replace(/[()\[\]\s]/g, '')
                    .split(',')
                    .map(n => parseFloat(n))
                    .filter(n => !isNaN(n));
                updateVectorInScene(currentEditKey, values.length ? values : [0]);
            } else if (obj.type === 'matrix') {
                const grid = document.getElementById('matrix-editor-container');
                if (grid) {
                    const newMatrix = readMatrixGrid(grid);
                    sceneObjects[currentEditKey].value = newMatrix;
                    updateObjectListUI();
                }
            }
            hideCreateTray();
            return;
        }

        
        if (!createMode) return;
        if (createMode === 'vector') {
            const componentsInput = document.getElementById('vec-components');
            const values = (componentsInput?.value || '')
                .replace(/[()\[\]\s]/g, '')
                .split(',')
                .map(n => parseFloat(n))
                .filter(n => !isNaN(n));
            updateVectorInScene(name, values.length ? values : [1, 0, 0]);
            hideCreateTray();
        } else if (createMode === 'matrix') {
            let r = parseInt(document.getElementById('mat-rows')?.value, 10) || 2;
            let c = parseInt(document.getElementById('mat-cols')?.value, 10) || 2;
            const mat = Array.from({ length: r }, () => Array(c).fill(0));
            sceneObjects[name] = { type: 'matrix', value: mat };
            updateObjectListUI();
            hideCreateTray();
            setTimeout(() => showEditTray(name), 100);
        }
    });

    document.addEventListener('click', (e) => {
        
        if (!e.target.closest('.object-item.editing')) {
            closeInPlaceEditor();
            closeOriginEditor();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeInPlaceEditor();
            closeOriginEditor();
        } else if (e.key === 'Enter') {
            if (document.querySelector('.object-item.editing')) {
                const editingItem = document.querySelector('.object-item.editing');
                const key = editingItem?.dataset.key;
                
                const vEditor = editingItem?.querySelector('.inplace-editor-v-col');
                if (vEditor && key) {
                    const originMode = editingItem.querySelector('.origin-editor-v-col');
                    if (originMode) {
                        
                        const vals = {};
                        originMode.querySelectorAll('.edit-input').forEach(inp => {
                            vals[inp.dataset.axis] = parseFloat(inp.value) || 0;
                        });
                        if (!is2DMode && vals.z === undefined) vals.z = 0;
                        vectorOrigins[key] = vals;
                        updateVectorVisuals(key);
                        originalOriginValue = null; 
                        closeOriginEditor();
                        return;
                    } else {
                        const inputs = vEditor.querySelectorAll('.edit-input');
                        const newRaw = Array.from(inputs).map(inp => parseFloat(inp.value) || 0);
                        updateVectorInScene(key, newRaw);
                        originalEditValue = null; 
                        closeInPlaceEditor();
                        return;
                    }
                }
                
                const mEditor = editingItem?.querySelector('.edit-pane');
                if (mEditor && key && !editingItem.querySelector('.origin-editor-v-col')) {
                    try {
                        const updatedMatrix = readMatrixGrid(mEditor);
                        sceneObjects[key].value = updatedMatrix;
                        originalEditValue = null; 
                        
                        closeInPlaceEditor();
                        return;
                    } catch (err) {
                        console.error('Invalid matrix input:', err);
                    }
                }
            }
        }
    });

    window.addEventListener('resize', onWindowResize);
}

function buildOperationUI(operation) {
    const builderContainer = document.getElementById('op-builder');
    builderContainer.innerHTML = '';

    
    const createSelect = (argId, type = 'vector') => {
        const select = document.createElement('select');
        select.id = argId;
        select.className = 'select-input';
        const keys = Object.keys(sceneObjects).filter(k => sceneObjects[k].type === type);
        if (keys.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = `No ${type}s defined`;
            opt.disabled = true;
            select.appendChild(opt);
        } else {
            keys.forEach(k => {
                const opt = document.createElement('option');
                opt.value = k;
                opt.textContent = k;
                select.appendChild(opt);
            });
        }
        return select;
    };
    const makeSpan = (text) => { const s = document.createElement('span'); s.textContent = text; return s; };

    const container = document.createElement('div');
    
    container.className = 'dynamic-op-container';

    switch (operation) {
        case 'dot': {
            const s1 = createSelect('op-arg1', 'vector');
            const s2 = createSelect('op-arg2', 'vector');
            container.appendChild(s1);
            container.appendChild(makeSpan('·'));
            container.appendChild(s2);
            builderContainer.appendChild(container);
            break;
        }
        case 'cross': {
            const s1 = createSelect('op-arg1', 'vector');
            const s2 = createSelect('op-arg2', 'vector');
            container.appendChild(s1);
            container.appendChild(makeSpan('×'));
            container.appendChild(s2);
            builderContainer.appendChild(container);
            break;
        }
        case 'span': {
            const s1 = createSelect('op-arg1', 'vector');
            const s2 = createSelect('op-arg2', 'vector');
            container.appendChild(s1);
            container.appendChild(makeSpan(','));
            container.appendChild(s2);
            builderContainer.appendChild(container);
            break;
        }
        case 'proj': {
            const s1 = createSelect('op-arg1', 'vector');
            const s2 = createSelect('op-arg2', 'vector');
            container.appendChild(makeSpan('proj'));
            container.appendChild(s1);
            container.appendChild(makeSpan('onto'));
            container.appendChild(s2);
            builderContainer.appendChild(container);
            break;
        }
        case 'norm': {
            const s1 = createSelect('op-arg1', 'vector');
            container.appendChild(makeSpan('‖'));
            container.appendChild(s1);
            container.appendChild(makeSpan('‖'));
            builderContainer.appendChild(container);
            break;
        }
        case 'det': case 'eigen': case 'transform': case 'orthcomp': case 'rank': case 'svd': case 'quadric': case 'colspace': case 'nullspace': {
            const s1 = createSelect('op-arg1', 'matrix');
            container.appendChild(s1);
            builderContainer.appendChild(container);
            break;
        }
        case 'leastsquares': {
            const m = createSelect('op-arg1', 'matrix');
            const b = createSelect('op-arg2', 'vector');
            container.appendChild(makeSpan('A'));
            container.appendChild(m);
            container.appendChild(makeSpan('b'));
            container.appendChild(b);
            builderContainer.appendChild(container);
            break;
        }
        case 'gramschmidt': {
            const vectorKeys = Object.keys(sceneObjects).filter(k => sceneObjects[k].type === 'vector');
            if (vectorKeys.length < 2) {
                builderContainer.innerHTML = '<p class="empty-list-info" style="font-size: 12px; color: var(--text-secondary); padding: 0 4px;">Define at least 2 vectors.</p>';
            } else {
                const list = document.createElement('div');
                list.className = 'span-selection';
                vectorKeys.forEach(key => {
                    const row = document.createElement('div');
                    row.className = 'checkbox-group';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.id = `gs-cb-${key}`;
                    cb.value = key;
                    cb.checked = true;
                    const label = document.createElement('label');
                    label.setAttribute('for', `gs-cb-${key}`);
                    label.textContent = key;
                    row.appendChild(cb);
                    row.appendChild(label);
                    list.appendChild(row);
                });
                builderContainer.appendChild(list);
            }
            break;
        }
        case 'reset': {
            
            break;
        }
        default: {
            
            break;
        }
    }
}

function onCanvasMouseDown(event) {
    
    if (is2DMode) {
        
        mouse.x = (event.offsetX / renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = -(event.offsetY / renderer.domElement.clientHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera2D);
        const intersects2D = raycaster.intersectObjects(Object.values(sceneMeshes2D), true);
        if (intersects2D.length > 0) {
            let obj = intersects2D[0].object;
            while (obj.parent && !obj.userData.isVector) { obj = obj.parent; }
            if (obj.userData.isVector && obj.userData.key) {
                
                window.quickOpsSelectedKey = obj.userData.key;
                const list = document.getElementById('object-list');
                if (list) {
                    list.querySelectorAll('.object-item.selected').forEach(el => el.classList.remove('selected'));
                    const card = list.querySelector(`.object-item[data-key="${obj.userData.key}"]`);
                    if (card) card.classList.add('selected');
                }
                isDragging = true;
                selectedVectorKey = obj.userData.key;
                
                if (controls2D) controls2D.enabled = false;
                
                if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                event.preventDefault();
                return;
            }
        }
        
        return;
    }

    
    event.preventDefault();
    mouse.x = (event.offsetX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.offsetY / renderer.domElement.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(Object.values(sceneMeshes), true);
    if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj.parent && !obj.userData.isVector) { obj = obj.parent; }
        if (obj.userData.isVector && obj.userData.key) {
            
            window.quickOpsSelectedKey = obj.userData.key;
            const list = document.getElementById('object-list');
            if (list) {
                list.querySelectorAll('.object-item.selected').forEach(el => el.classList.remove('selected'));
                const card = list.querySelector(`.object-item[data-key="${obj.userData.key}"]`);
                if (card) card.classList.add('selected');
            }
            isDragging = true; selectedVectorKey = obj.userData.key;
            const cameraDirection = new THREE.Vector3();
            camera.getWorldDirection(cameraDirection);
            dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, intersects[0].point);
            controls.enabled = false;
            highlightVector(obj, true);
            return;
        }
    }
    controls.enabled = true; controls.handleMouseDown(event);
}

function onCanvasMouseMove(event) {
    
    if (is2DMode) {
        if (isDragging && selectedVectorKey) {
            
            mouse.x = (event.offsetX / renderer.domElement.clientWidth) * 2 - 1;
            mouse.y = -(event.offsetY / renderer.domElement.clientHeight) * 2 + 1;
            const planeXY = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
            raycaster.setFromCamera(mouse, camera2D);
            const intersection = new THREE.Vector3();
            const intersects = raycaster.ray.intersectPlane(planeXY, intersection);
            if (intersects) {
                if (raycaster.ray.intersectPlane(planeXY, intersection)) {
                    
                    const origin = vectorOrigins[selectedVectorKey];
                    const originVec = origin ? new THREE.Vector3(origin.x || 0, origin.y || 0, 0) : new THREE.Vector3(0, 0, 0);
                    
                    
                    const vectorFromOrigin = intersection.clone().sub(originVec);
                    
                    
                    const obj = sceneObjects[selectedVectorKey];
                    if (obj && obj.type === 'vector') {
                        obj.raw = [vectorFromOrigin.x, vectorFromOrigin.y];
                        
                        const v2 = new THREE.Vector3(vectorFromOrigin.x, vectorFromOrigin.y, 0);
                        const vColor = calculate2DVectorColor(v2);
                        const g = sceneMeshes2D[selectedVectorKey];
                        if (g) {
                            g.userData.vector.copy(v2);
                            g.userData.color = vColor;
                            
                            const isSimple = /^[a-zA-Z_]\w*$/.test(selectedVectorKey);
                            if (!isSimple) {
                                g.userData.labelText = `[${Number(v2.x).toFixed(2)}, ${Number(v2.y).toFixed(2)}]`;
                            }
                            refresh2DVectorArrow(g);
                            
                            
                            if (origin) {
                                g.position.set(origin.x || 0, origin.y || 0, 0);
                            }
                            
                            updateObjectListUI();
                        }
                    }
                }
            }
            
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            event.preventDefault();
            return;
        }
        
        return;
    }

    
    if (isDragging && selectedVectorKey) {
        mouse.x = (event.offsetX / renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = -(event.offsetY / renderer.domElement.clientHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersection = new THREE.Vector3();

        if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
            
            const origin = vectorOrigins[selectedVectorKey];
            const originVec = origin ? new THREE.Vector3(origin.x || 0, origin.z || 0, origin.y || 0) : new THREE.Vector3(0, 0, 0);
            
            
            const vectorFromOrigin = intersection.clone().sub(originVec);
            if (vectorFromOrigin.length() > 15) vectorFromOrigin.setLength(15);

            
            sceneObjects[selectedVectorKey].value.copy(vectorFromOrigin);
            sceneObjects[selectedVectorKey].color = calculateWeightedColor(vectorFromOrigin);
            
            
            const Ex = vectorFromOrigin.x, Ey = vectorFromOrigin.y, Ez = vectorFromOrigin.z;
            sceneObjects[selectedVectorKey].raw = [Ex, Ez, Ey];

            
            updateVectorArrow(sceneMeshes[selectedVectorKey], vectorFromOrigin);
            sceneMeshes[selectedVectorKey].children.forEach(child => {
                if (child.material) child.material.color.setHex(sceneObjects[selectedVectorKey].color);
            });
            
            
            if (origin) {
                sceneMeshes[selectedVectorKey].position.set(origin.x || 0, origin.z || 0, origin.y || 0);
            }

            updateObjectListUI(); 
            updateResponsiveGrid();
            maybeClearTemporaryVisuals();
        }
    } else {
        controls.handleMouseMove(event);
    }
}

function onCanvasMouseUp(event) {
    if (is2DMode) {
        if (isDragging) {
            isDragging = false;
            selectedVectorKey = null;
            if (controls2D) controls2D.enabled = true;
            
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            event.preventDefault();
            return;
        }
        
        return;
    }
    if (isDragging) {
        isDragging = false;
        if (selectedVectorKey && sceneMeshes[selectedVectorKey]) { 
            highlightVector(sceneMeshes[selectedVectorKey], false); 
        }
        selectedVectorKey = null;
    }
    controls.enabled = true; controls.handleMouseUp(event);
}

function highlightVector(vectorGroup, highlight) {
    if (!vectorGroup) return;
    const material = vectorGroup.children[0]?.material;
    if (!material) return;
    if (highlight) {
        material.emissive.setHex(0x888888);
    } else {
        material.emissive.setHex(0x000000);
    }
}

function onWindowResize() {
    const container = document.querySelector('.scene-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const aspect = width / height;
    
    
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    
    
    if (camera2D) {
        
        const frustumSize = (camera2D.top - camera2D.bottom) || 20;
        camera2D.left = -(frustumSize * aspect) / 2;
        camera2D.right = (frustumSize * aspect) / 2;
        camera2D.top = frustumSize / 2;
        camera2D.bottom = -frustumSize / 2;
        camera2D.updateProjectionMatrix();
    }
    
    
    renderer.setSize(width, height);
    composer.setSize(width, height);
    if (composer2D) {
        composer2D.setSize(width, height);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    if (is2DMode) {
        refreshAll2DVectorArrows?.();
        if (USE_CANVAS_OVERLAY_2D) {
            resize2DOverlay();
            draw2DOverlay();
        } else {
            update2DGrid?.();
            update2DAxisLabels?.();
        }
    }
}


let USE_CANVAS_OVERLAY_2D = true;
let overlay2DCanvas = null;
let overlay2DCtx = null;
let overlayDPR = 1;


function createPaperBackgroundTexture({ width = 1024, height = 1024 } = {}) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    const ctx = c.getContext('2d');

    
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0.0, '#2b3a55');  
    g.addColorStop(0.5, '#233047');  
    g.addColorStop(1.0, '#1a2436');  
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    
    const rgrad = ctx.createRadialGradient(
        width / 2, height / 2, width * 0.2,
        width / 2, height / 2, width * 0.8
    );
    rgrad.addColorStop(0.0, 'rgba(0,0,0,0)');
    rgrad.addColorStop(1.0, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = rgrad;
    ctx.fillRect(0, 0, width, height);

    
    const dots = Math.floor(width * height * 0.015);
    for (let i = 0; i < dots; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const gray = 200 + Math.random() * 55;
        ctx.fillStyle = `rgba(${gray},${gray},${gray},0.03)`;
        ctx.fillRect(x, y, 1, 1);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    tex.needsUpdate = true;
    return tex;
}


function setup2DScene() {
    
    scene2D = new THREE.Scene();
    
    
    if (typeof generateSceneBackgroundTexture === 'function') {
        const top = cssVar('--canvas-start') || '#0b1220';
        const bottom = cssVar('--canvas-end') || '#0f172a';
        scene2D.background = generateSceneBackgroundTexture(top, bottom);
    }
    
    
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 20;
    camera2D = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        frustumSize / -2,
        0.1,
        1000
    );
    camera2D.position.set(0, 0, 10);
    camera2D.lookAt(0, 0, 0);
    
    
    renderer2D = renderer; 
    
    
    if (THREE.OrbitControls) {
        controls2D = new THREE.OrbitControls(camera2D, renderer.domElement);
        controls2D.enableRotate = false; 
        controls2D.enableDamping = true;
        controls2D.dampingFactor = 0.06; 
        controls2D.screenSpacePanning = true; 
        controls2D.enablePan = true; 
        controls2D.panSpeed = 1.2; 
        controls2D.zoomSpeed = 2.5; 
        controls2D.minZoom = 0.001; 
        controls2D.maxZoom = 10000; 
        controls2D.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        };
        controls2D.touches = {
            ONE: THREE.TOUCH.PAN,
            TWO: THREE.TOUCH.DOLLY_PAN
        };
        controls2D.enabled = false; 
        
        
        controls2D.addEventListener('change', () => {
            if (is2DMode) {
                if (USE_CANVAS_OVERLAY_2D) {
                    draw2DOverlay();
                } else {
                    update2DGrid();
                    update2DAxisLabels();
                }
                
                refreshAll2DVectorArrows();
            }
        });
        
        if (typeof controls2D.panUp === 'function') {
            const _origPanUp = controls2D.panUp.bind(controls2D);
            controls2D.panUp = function(distance) { return _origPanUp(-distance); };
        }
        
        console.log('2D OrbitControls initialized with grid updates');
    } else {
        console.warn('OrbitControls not available - 2D controls will not work');
    }
    
    
    setup2DGrid();
    setup2DAxes();
    
    if (USE_CANVAS_OVERLAY_2D) {
        if (typeof gridHelper2D !== 'undefined' && gridHelper2D) gridHelper2D.visible = false;
        if (typeof axesHelper2D !== 'undefined' && axesHelper2D) axesHelper2D.visible = false;
    }
    
    
    const ambientLight2D = new THREE.AmbientLight(0xffffff, 0.8);
    scene2D.add(ambientLight2D);
    
    
    setup2DPostProcessing();

    
    ensure2DOverlay();
    resize2DOverlay();
    draw2DOverlay();
}

function setup2DGrid() {
    
    gridHelper2D = new THREE.Group();
    scene2D.add(gridHelper2D);
    
    
    window.grid2DState = {
        minorLines: null,
        majorLines: null,
        labels: [],
        lastZoom: -1,
        lastCenter: new THREE.Vector2(0, 0)
    };
    
    
    transformationGrid2D = new THREE.Group();
    transformationGrid2D.visible = false;
    scene2D.add(transformationGrid2D);
    
    
    update2DGrid();
}

function update2DGrid() {
    if (!camera2D || !gridHelper2D) return;
    
    const state = window.grid2DState;
    const zoom = camera2D.zoom || 1;
    const center = new THREE.Vector2(camera2D.position.x, camera2D.position.y);
    
    
    if (Math.abs(zoom - state.lastZoom) < 0.01 && 
        center.distanceTo(state.lastCenter) < 0.1) {
        return;
    }
    
    state.lastZoom = zoom;
    state.lastCenter.copy(center);
    
    
    if (state.minorLines) {
        gridHelper2D.remove(state.minorLines);
        state.minorLines.geometry.dispose();
        state.minorLines.material.dispose();
    }
    if (state.majorLines) {
        gridHelper2D.remove(state.majorLines);
        state.majorLines.geometry.dispose();
        state.majorLines.material.dispose();
    }
    
    
    state.labels.forEach(label => {
        gridHelper2D.remove(label);
        if (label.geometry) label.geometry.dispose();
        if (label.material) label.material.dispose();
    });
    state.labels = [];
    
    
    const viewSize = 20 / zoom; 
    const baseStep = calculateOptimalGridStep(viewSize);
    const minorStep = baseStep / 5;
    const majorStep = baseStep;
    
    
    const margin = viewSize * 0.5;
    const minX = center.x - viewSize/2 - margin;
    const maxX = center.x + viewSize/2 + margin;
    const minY = center.y - viewSize/2 - margin;
    const maxY = center.y + viewSize/2 + margin;
    
    
    const minorVertices = [];
    const startX = Math.floor(minX / minorStep) * minorStep;
    const startY = Math.floor(minY / minorStep) * minorStep;
    
    for (let x = startX; x <= maxX; x += minorStep) {
        if (Math.abs(x % majorStep) > 1e-10) { 
            minorVertices.push(x, minY, 0, x, maxY, 0);
        }
    }
    
    for (let y = startY; y <= maxY; y += minorStep) {
        if (Math.abs(y % majorStep) > 1e-10) { 
            minorVertices.push(minX, y, 0, maxX, y, 0);
        }
    }
    
    if (minorVertices.length > 0) {
        const minorGeometry = new THREE.BufferGeometry();
        minorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(minorVertices, 3));
        state.minorLines = new THREE.LineSegments(
            minorGeometry,
            new THREE.LineBasicMaterial({ 
                color: cssHexToInt(cssVar('--grid-minor') || '#64748b'),
                transparent: true, 
                opacity: Math.min(0.35, zoom * 0.1)
            })
        );
        gridHelper2D.add(state.minorLines);
    }
    
    
    const majorVertices = [];
    const majorStartX = Math.floor(minX / majorStep) * majorStep;
    const majorStartY = Math.floor(minY / majorStep) * majorStep;
    
    for (let x = majorStartX; x <= maxX; x += majorStep) {
        if (Math.abs(x) > 1e-10) { 
            majorVertices.push(x, minY, 0, x, maxY, 0);
        }
    }
    
    for (let y = majorStartY; y <= maxY; y += majorStep) {
        if (Math.abs(y) > 1e-10) { 
            majorVertices.push(minX, y, 0, maxX, y, 0);
        }
    }
    
    if (majorVertices.length > 0) {
        const majorGeometry = new THREE.BufferGeometry();
        majorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(majorVertices, 3));
        state.majorLines = new THREE.LineSegments(
            majorGeometry,
            new THREE.LineBasicMaterial({ 
                color: cssHexToInt(cssVar('--grid-major') || '#94a3b8'),
                transparent: true, 
                opacity: 0.55
            })
        );
        gridHelper2D.add(state.majorLines);
    }
    
    
    const labelStep = majorStep;
    const labelStartX = Math.floor((center.x - viewSize/4) / labelStep) * labelStep;
    const labelStartY = Math.floor((center.y - viewSize/4) / labelStep) * labelStep;
    const labelEndX = Math.ceil((center.x + viewSize/4) / labelStep) * labelStep;
    const labelEndY = Math.ceil((center.y + viewSize/4) / labelStep) * labelStep;
    
    for (let x = labelStartX; x <= labelEndX; x += labelStep) {
        if (Math.abs(x) > 1e-10) {
            const label = createAxisLabel(
                formatGridValue(x), 
                new THREE.Vector3(x, center.y - viewSize/2 + 0.5, 0), 
                cssVar('--axis-origin') || '#94a3b8', 
                Math.max(8, Math.min(12, zoom * 2))
            );
            state.labels.push(label);
            gridHelper2D.add(label);
        }
    }
    
    for (let y = labelStartY; y <= labelEndY; y += labelStep) {
        if (Math.abs(y) > 1e-10) {
            const label = createAxisLabel(
                formatGridValue(y), 
                new THREE.Vector3(center.x - viewSize/2 + 0.5, y, 0), 
                cssVar('--axis-origin') || '#94a3b8', 
                Math.max(8, Math.min(12, zoom * 2))
            );
            state.labels.push(label);
            gridHelper2D.add(label);
        }
    }
}


function update2DThemeVisuals() {
    try {
        
        update2DGrid();
        
        if (axesHelper2D) {
            const { axis, letter, origin } = getThemeAxisColors2D();
            const axisColor = cssHexToInt(axis);
            
            const lineMats = [];
            axesHelper2D.traverse(obj => { if (obj.material && obj.material.color) lineMats.push(obj.material); });
            lineMats.forEach(m => { try { m.color.setHex(axisColor); } catch(_) {} });
            
            if (window.axisLabels2D) {
                const { xLabel, yLabel, originLabel } = window.axisLabels2D;
                
                const posX = xLabel?.position?.clone();
                const posY = yLabel?.position?.clone();
                const posO = originLabel?.position?.clone();
                if (xLabel) { axesHelper2D.remove(xLabel); }
                if (yLabel) { axesHelper2D.remove(yLabel); }
                if (originLabel) { axesHelper2D.remove(originLabel); }
                window.axisLabels2D.xLabel = createAxisLabel('X', posX || new THREE.Vector3(0.8, 0.08, 0), cssVar('--axis-letter') || '#f8fafc', 14);
                window.axisLabels2D.yLabel = createAxisLabel('Y', posY || new THREE.Vector3(0.08, 0.8, 0), cssVar('--axis-letter') || '#f8fafc', 14);
                window.axisLabels2D.originLabel = createAxisLabel('0', posO || new THREE.Vector3(-0.3, -0.3, 0), cssVar('--axis-origin') || '#94a3b8', 12);
                axesHelper2D.add(window.axisLabels2D.xLabel, window.axisLabels2D.yLabel, window.axisLabels2D.originLabel);
            }
        }
    } catch(_) {}
}

function calculateOptimalGridStep(viewSize) {
    
    const targetDivisions = 10; 
    const rawStep = viewSize / targetDivisions;
    
    
    const magnitude = Math.floor(Math.log10(rawStep));
    const normalized = rawStep / Math.pow(10, magnitude);
    
    let niceStep;
    if (normalized <= 1.5) {
        niceStep = 1;
    } else if (normalized <= 3) {
        niceStep = 2;
    } else if (normalized <= 7) {
        niceStep = 5;
    } else {
        niceStep = 10;
    }
    
    return niceStep * Math.pow(10, magnitude);
}

function formatGridValue(value) {
    
    const absValue = Math.abs(value);
    
    if (absValue === 0) return '0';
    
    if (absValue >= 1000 || absValue < 0.01) {
        
        return value.toExponential(1);
    } else if (absValue >= 1) {
        
        return value % 1 === 0 ? value.toString() : value.toFixed(1);
    } else {
        
        return value.toFixed(2);
    }
}

function setup2DAxes() {
    
    axesHelper2D = new THREE.Group();
    
    
    const axisExtent = 1000; 
    
    
    const xGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-axisExtent, 0, 0),
        new THREE.Vector3(axisExtent, 0, 0)
    ]);
    const xAxis = new THREE.Line(xGeometry, new THREE.LineBasicMaterial({ 
        color: AXIS_COLOR_X,
        linewidth: 2
    }));
    axesHelper2D.add(xAxis);
    
    
    const yGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -axisExtent, 0),
        new THREE.Vector3(0, axisExtent, 0)
    ]);
    const yAxis = new THREE.Line(yGeometry, new THREE.LineBasicMaterial({ 
        color: AXIS_COLOR_Y,
        linewidth: 2
    }));
    axesHelper2D.add(yAxis);
    
    
    window.axisLabels2D = {
        xLabel: createAxisLabel('X', new THREE.Vector3(0, 0, 0), '#f8fafc', 16),
        yLabel: createAxisLabel('Y', new THREE.Vector3(0, 0, 0), '#f8fafc', 16),
        originLabel: createAxisLabel('0', new THREE.Vector3(-0.3, -0.3, 0), '#64748b', 12)
    };
    
    axesHelper2D.add(window.axisLabels2D.xLabel);
    axesHelper2D.add(window.axisLabels2D.yLabel);
    axesHelper2D.add(window.axisLabels2D.originLabel);
    
    axesHelper2D.renderOrder = 9999;
    window.axisLabels2D.xLabel.renderOrder = 9999;
    window.axisLabels2D.yLabel.renderOrder = 9999;
    window.axisLabels2D.originLabel.renderOrder = 9999;
    window.axisLabels2D.xLabel.frustumCulled = false;
    window.axisLabels2D.yLabel.frustumCulled = false;
    window.axisLabels2D.originLabel.frustumCulled = false;
    
    scene2D.add(axesHelper2D);
    
    
    update2DAxisLabels();
}

function update2DAxisLabels() {
    if (!camera2D || !window.axisLabels2D) return;
    
    const zoom = camera2D.zoom || 1;
    const center = new THREE.Vector2(camera2D.position.x, camera2D.position.y);
    const viewSize = (camera2D.top - camera2D.bottom) / zoom;
    
    
    const labelOffset = viewSize * 0.4;
    
    
    window.axisLabels2D.xLabel.position.set(
        center.x + labelOffset, 
        center.y - viewSize * 0.45, 
        0
    );
    
    
    window.axisLabels2D.yLabel.position.set(
        center.x - viewSize * 0.45, 
        center.y + labelOffset, 
        0
    );
    
    
    const originVisible = Math.abs(center.x) < viewSize/2 && Math.abs(center.y) < viewSize/2;
    window.axisLabels2D.originLabel.visible = originVisible;

    
    const wupp = getWorldUnitsPerPixel();
    const rescale = (s) => {
        if (!s || !s.userData) return;
        const cssW = s.userData.cssW || 24;
        const cssH = s.userData.cssH || 14;
        s.scale.set(cssW * wupp, cssH * wupp, 1);
    };
    rescale(window.axisLabels2D.xLabel);
    rescale(window.axisLabels2D.yLabel);
    rescale(window.axisLabels2D.originLabel);
}

function setup2DPostProcessing() {
    const renderScene = new THREE.RenderPass(scene2D, camera2D);
    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.4, 0.3, 0.95
    );
    const smaaPass = new THREE.SMAAPass(
        window.innerWidth * renderer.getPixelRatio(),
        window.innerHeight * renderer.getPixelRatio()
    );
    
    composer2D = new THREE.EffectComposer(renderer);
    composer2D.addPass(renderScene);
    composer2D.addPass(bloomPass);
    composer2D.addPass(smaaPass);
}


function ensure2DOverlay() {
    if (overlay2DCanvas) return;
    const container = document.querySelector('.scene-container');
    if (!container) return;
    overlay2DCanvas = document.createElement('canvas');
    overlay2DCanvas.className = 'overlay-canvas';
    Object.assign(overlay2DCanvas.style, {
        position: 'absolute',
        inset: '0',
        zIndex: '3',
        pointerEvents: 'none',
        width: '100%',
        height: '100%'
    });
    container.appendChild(overlay2DCanvas);
    overlay2DCtx = overlay2DCanvas.getContext('2d');
}

function resize2DOverlay() {
    if (!overlay2DCanvas) return;
    const container = document.querySelector('.scene-container');
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    overlayDPR = Math.min(window.devicePixelRatio || 1, 2);
    overlay2DCanvas.width = Math.max(1, Math.floor(w * overlayDPR));
    overlay2DCanvas.height = Math.max(1, Math.floor(h * overlayDPR));
    overlay2DCtx.setTransform(1, 0, 0, 1, 0, 0);
    overlay2DCtx.scale(overlayDPR, overlayDPR);
}

function setOverlay2DVisible(v) {
    if (!overlay2DCanvas) return;
    overlay2DCanvas.style.display = v ? 'block' : 'none';
}

function draw2DOverlay() {
    if (!is2DMode || !camera2D || !overlay2DCtx) return;
    const container = document.querySelector('.scene-container');
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (overlay2DCanvas.width !== Math.floor(width * overlayDPR) || overlay2DCanvas.height !== Math.floor(height * overlayDPR)) {
        resize2DOverlay();
    }

    const ctx = overlay2DCtx;
    ctx.clearRect(0, 0, width, height);

    
    const rs = getComputedStyle(document.documentElement);
    const colMinor = (rs.getPropertyValue('--grid-minor') || '#334155').trim();
    const colMajor = (rs.getPropertyValue('--grid-major') || '#475569').trim();
    const colAxis = (rs.getPropertyValue('--axis-2d') || '#f8fafc').trim();
    const colAxisLetter = (rs.getPropertyValue('--axis-letter') || '#f8fafc').trim();
    const colOrigin = (rs.getPropertyValue('--axis-origin') || '#64748b').trim();
    const colText = (rs.getPropertyValue('--text-secondary') || '#94a3b8').trim();

    
    const zoom = camera2D.zoom || 1;
    const worldHeight = (camera2D.top - camera2D.bottom) / zoom;
    const worldWidth = (camera2D.right - camera2D.left) / zoom;
    const centerX = camera2D.position.x;
    const centerY = camera2D.position.y;
    const leftWorld = centerX - worldWidth / 2;
    const bottomWorld = centerY - worldHeight / 2;

    const pxPerWorldX = width / worldWidth;
    const pxPerWorldY = height / worldHeight;

    const baseStep = calculateOptimalGridStep(worldHeight);
    const minorStep = baseStep / 5;
    const majorStep = baseStep;

    
    const isMajor = (v) => Math.abs((v / majorStep) - Math.round(v / majorStep)) < 1e-6;
    const crisp = (p) => Math.round(p) + 0.5; 

    
    let startX = Math.ceil(leftWorld / minorStep) * minorStep;
    for (let x = startX; x <= leftWorld + worldWidth + 1e-9; x += minorStep) {
        const sx = (x - leftWorld) * pxPerWorldX;
        if (sx < -1 || sx > width + 1) continue;
        const major = isMajor(x);
        ctx.beginPath();
        ctx.strokeStyle = major ? colMajor : colMinor;
        ctx.globalAlpha = major ? 0.28 : 0.18;
        ctx.lineWidth = 1;
        const xx = crisp(sx);
        ctx.moveTo(xx, 0);
        ctx.lineTo(xx, height);
        ctx.stroke();
    }

    
    let startY = Math.ceil(bottomWorld / minorStep) * minorStep;
    for (let y = startY; y <= bottomWorld + worldHeight + 1e-9; y += minorStep) {
        const sy = height - (y - bottomWorld) * pxPerWorldY; 
        if (sy < -1 || sy > height + 1) continue;
        const major = isMajor(y);
        ctx.beginPath();
        ctx.strokeStyle = major ? colMajor : colMinor;
        ctx.globalAlpha = major ? 0.28 : 0.18;
        ctx.lineWidth = 1;
        const yy = crisp(sy);
        ctx.moveTo(0, yy);
        ctx.lineTo(width, yy);
        ctx.stroke();
    }

    ctx.globalAlpha = 1;

    
    const sy0 = height - (0 - bottomWorld) * pxPerWorldY; 
    const sx0 = (0 - leftWorld) * pxPerWorldX;
    ctx.lineWidth = 2;
    if (sy0 >= 0 && sy0 <= height) {
        ctx.strokeStyle = colAxis;
        ctx.beginPath();
        ctx.moveTo(0, crisp(sy0));
        ctx.lineTo(width, crisp(sy0));
        ctx.stroke();
    }
    if (sx0 >= 0 && sx0 <= width) {
        ctx.strokeStyle = colAxis;
        ctx.beginPath();
        ctx.moveTo(crisp(sx0), 0);
        ctx.lineTo(crisp(sx0), height);
        ctx.stroke();
    }

    
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillStyle = colText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tick = 6; 

    
    if (sy0 >= 0 && sy0 <= height) {
        let txStart = Math.ceil(leftWorld / majorStep) * majorStep;
        for (let x = txStart; x <= leftWorld + worldWidth + 1e-9; x += majorStep) {
            const sx = (x - leftWorld) * pxPerWorldX;
            if (sx < -1 || sx > width + 1) continue;
            ctx.beginPath();
            ctx.strokeStyle = colAxis;
            ctx.lineWidth = 1.5;
            const xx = crisp(sx);
            ctx.moveTo(xx, sy0 - tick);
            ctx.lineTo(xx, sy0 + tick);
            ctx.stroke();
            
            const atZero = Math.abs(x) < 1e-12;
            const originVisible = sy0 >= 0 && sy0 <= height && sx0 >= 0 && sx0 <= width;
            if (!(atZero && originVisible)) {
                const label = formatGridValue(x);
                ctx.fillText(label, sx, sy0 + tick + 2);
            }
        }
    }

    
    if (sx0 >= 0 && sx0 <= width) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        let tyStart = Math.ceil(bottomWorld / majorStep) * majorStep;
        for (let y = tyStart; y <= bottomWorld + worldHeight + 1e-9; y += majorStep) {
            const sy = height - (y - bottomWorld) * pxPerWorldY; 
            if (sy < -1 || sy > height + 1) continue;
            ctx.beginPath();
            ctx.strokeStyle = colAxis;
            ctx.lineWidth = 1.5;
            const yy = crisp(sy);
            ctx.moveTo(sx0 - tick, yy);
            ctx.lineTo(sx0 + tick, yy);
            ctx.stroke();
            const atZero = Math.abs(y) < 1e-12;
            const originVisible = sy0 >= 0 && sy0 <= height && sx0 >= 0 && sx0 <= width;
            if (!(atZero && originVisible)) {
                const label = formatGridValue(y);
                ctx.fillText(label, sx0 - tick - 4, sy);
            }
        }
    }

    
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 1.5;
    ctx.shadowOffsetY = 0.5;
    ctx.fillStyle = colAxisLetter;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = '600 16px Inter, system-ui, sans-serif';
    ctx.fillText('X', width - 10, height - 8);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Y', 8, 8);
    
    if (sx0 >= 0 && sx0 <= width && sy0 >= 0 && sy0 <= height) {
        ctx.fillStyle = colOrigin;
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('0', sx0 + 6, sy0 + 4);
    }
    ctx.restore();
}


function update2DThemeVisuals() {
    if (scene2D) {
        const top = cssVar('--canvas-start') || '#0b1220';
        const bottom = cssVar('--canvas-end') || '#0f172a';
        if (typeof generateSceneBackgroundTexture === 'function') {
            scene2D.background = generateSceneBackgroundTexture(top, bottom);
        }
    }
    if (USE_CANVAS_OVERLAY_2D) {
        resize2DOverlay();
        draw2DOverlay();
    } else {
        update2DGrid?.();
        update2DAxisLabels?.();
    }
}


function toggleView() {
    if (!controls2D) {
        console.warn('2D controls not available - cannot switch to 2D mode');
        return;
    }
    
    is2DMode = !is2DMode;
    const toggleBtn = document.getElementById('view-toggle');
    
    if (is2DMode) {
        
        if (toggleBtn) {
            toggleBtn.textContent = '2D';
            toggleBtn.classList.add('active');
            toggleBtn.setAttribute('aria-pressed', 'true');
        }
        if (controls) controls.enabled = false;
        controls2D.enabled = true;
        
        
        update2DSceneFromObjects();
        
        refreshAll2DVectorArrows();
        
        if (USE_CANVAS_OVERLAY_2D) {
            ensure2DOverlay();
            setOverlay2DVisible(true);
            resize2DOverlay();
            draw2DOverlay();
        }
        
        
        clearTemporaryVisuals();
    } else {
        
        if (toggleBtn) {
            toggleBtn.textContent = '3D';
            toggleBtn.classList.remove('active');
            toggleBtn.setAttribute('aria-pressed', 'false');
        }
        if (controls) controls.enabled = true;
        controls2D.enabled = false;
        
        
        updateSceneFromObjects();
        
        
        clear2DTemporaryVisuals();
        
        if (USE_CANVAS_OVERLAY_2D) {
            setOverlay2DVisible(false);
        }
    }
    
    updateObjectListUI();
}

function update2DSceneFromObjects() {
    
    for (const key in sceneMeshes2D) {
        scene2D.remove(sceneMeshes2D[key]);
        delete sceneMeshes2D[key];
    }
    
    
    for (const key in sceneObjects) {
        const obj = sceneObjects[key];
        if (obj.type === 'vector' && obj.raw) {
            const dim = obj.raw.length;
            if (dim === 2) {
                
                const vec2D = new THREE.Vector3(obj.raw[0], obj.raw[1], 0);
                
                const vColor = calculate2DVectorColor(vec2D);
                const labelText = (/^[a-zA-Z_]\w*$/.test(key))
                    ? key
                    : `[${Number(obj.raw[0]).toFixed(2)}, ${Number(obj.raw[1]).toFixed(2)}]`;
                const arrow2D = create2DVectorArrow(vec2D, vColor, labelText);
                
                
                const origin = vectorOrigins[key];
                if (origin) {
                    arrow2D.position.set(origin.x || 0, origin.y || 0, 0);
                }
                
                
                arrow2D.userData.isVector = true;
                arrow2D.userData.key = key;
                arrow2D.visible = obj.visible !== false;
                sceneMeshes2D[key] = arrow2D;
                scene2D.add(arrow2D);
            }
        }
        
        if (obj.type === 'plane' && obj.visible) {
            const dim = Number(obj.dim || (Array.isArray(obj.normal) ? obj.normal.length : 0));
            if (dim === 2) {
                const a = Number(obj.normal[0]) || 0;
                const b = Number(obj.normal[1]) || 0;
                const d = Number(obj.offset) || 0;
                const eps = 1e-9;
                if (Math.abs(a) < eps && Math.abs(b) < eps) continue;

                
                const zoom = camera2D?.zoom || 1;
                const worldH = camera2D ? (camera2D.top - camera2D.bottom) / zoom : 20;
                const worldW = camera2D ? (camera2D.right - camera2D.left) / zoom : 20;
                const halfW = worldW / 2, halfH = worldH / 2;

                
                const pts = [];
                
                if (Math.abs(b) > eps) {
                    const y1 = (d - a * (-halfW)) / b;
                    const y2 = (d - a * ( halfW)) / b;
                    if (isFinite(y1)) pts.push(new THREE.Vector3(-halfW, y1, 0));
                    if (isFinite(y2)) pts.push(new THREE.Vector3( halfW, y2, 0));
                }
                
                if (Math.abs(a) > eps) {
                    const x1 = (d - b * (-halfH)) / a;
                    const x2 = (d - b * ( halfH)) / a;
                    if (isFinite(x1)) pts.push(new THREE.Vector3(x1, -halfH, 0));
                    if (isFinite(x2)) pts.push(new THREE.Vector3(x2,  halfH, 0));
                }

                
                const inBounds = pts.filter(p => Math.abs(p.x) <= halfW * 1.2 && Math.abs(p.y) <= halfH * 1.2);
                if (inBounds.length >= 2) {
                    let pA = inBounds[0], pB = inBounds[1], maxd = -1;
                    for (let i = 0; i < inBounds.length; i++) {
                        for (let j = i + 1; j < inBounds.length; j++) {
                            const d2 = inBounds[i].distanceToSquared(inBounds[j]);
                            if (d2 > maxd) { maxd = d2; pA = inBounds[i]; pB = inBounds[j]; }
                        }
                    }
                    const geom = new THREE.BufferGeometry().setFromPoints([pA, pB]);
                    const mat = new THREE.LineBasicMaterial({ color: obj.color ?? 0x60a5fa, transparent: true, opacity: 0.75 });
                    const line = new THREE.Line(geom, mat);
                    line.renderOrder = 9980;
                    line.userData.isPlane2D = true;
                    line.userData.key = key;
                    sceneMeshes2D[key] = line;
                    scene2D.add(line);
                }
            }
        }
    }
}

function getWorldUnitsPerPixel() {
    if (!renderer || !camera2D) return 1 / 150;
    const h = renderer.domElement?.clientHeight || window.innerHeight || 800;
    const worldHeight = (camera2D.top - camera2D.bottom) / (camera2D.zoom || 1);
    return worldHeight / h;
}

function adjustColorBrightness(hex, factor = 1.0) {
    const c = new THREE.Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    hsl.l = Math.min(1, Math.max(0, hsl.l * factor));
    c.setHSL(hsl.h, hsl.s, hsl.l);
    return c.getHex();
}

function calculate2DVectorColor(vec) {
    const ax = Math.abs(vec.x);
    const ay = Math.abs(vec.y);
    if (ax < 1e-6 && ay < 1e-6) return 0x94a3b8; 
    const total = ax + ay;
    const wx = ax / total;
    const wy = ay / total;

    
    if (wx >= 0.88) return AXIS_COLOR_X.getHex();
    if (wy >= 0.88) return AXIS_COLOR_Y.getHex();

    
    const cx = AXIS_COLOR_X.clone().multiplyScalar(wx);
    const cy = AXIS_COLOR_Y.clone().multiplyScalar(wy);
    const col = new THREE.Color(0, 0, 0).add(cx).add(cy);

    const hsl = { h: 0, s: 0, l: 0 };
    col.getHSL(hsl);
    hsl.s = Math.min(0.8, Math.max(0.55, hsl.s));
    hsl.l = Math.min(0.68, Math.max(0.52, hsl.l));
    col.setHSL(hsl.h, hsl.s, hsl.l);
    return col.getHex();
}


const VECTOR_LABEL_STYLE_VERSION = 9; 
const VECTOR_LABEL_PIXEL_SIZE = 28;   

function createVectorLabel2D(text, color = '#e2e8f0', pixelSize = VECTOR_LABEL_PIXEL_SIZE) {
    const canvas = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ctx = canvas.getContext('2d');
    const padX = 2, padY = 2; 
    ctx.font = `800 ${pixelSize}px Inter, system-ui, sans-serif`;
    const textW = ctx.measureText(text).width;
    const cssW = Math.ceil(textW + padX * 2);
    const cssH = Math.ceil(pixelSize + padY * 2);
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    ctx.scale(dpr, dpr);

    
    const isLightTheme = document.documentElement.classList.contains('light-theme');
    const base = new THREE.Color(color);
    const baseStyle = base.getStyle();
    const outlineStyle = isLightTheme ? 'rgba(15, 23, 42, 0.75)' : 'rgba(2, 6, 23, 0.75)'; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    
    ctx.lineWidth = 3.0;
    ctx.strokeStyle = outlineStyle;
    ctx.strokeText(text, cssW / 2, cssH / 2);

    
    ctx.fillStyle = baseStyle;
    ctx.fillText(text, cssW / 2, cssH / 2);

    
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = baseStyle;
    ctx.strokeText(text, cssW / 2, cssH / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() || 1;
    texture.encoding = THREE.sRGBEncoding;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    
    const wupp = getWorldUnitsPerPixel();
    sprite.scale.set(cssW * wupp, cssH * wupp, 1);
    sprite.renderOrder = 9998;
    sprite.frustumCulled = false;
    sprite.userData.labelStyleVersion = VECTOR_LABEL_STYLE_VERSION;
    sprite.userData.baseColorHex = (new THREE.Color(color)).getHex();
    return sprite;
}

function update2DVectorGeometry(group) {
    
    const v = group.userData.vector?.clone() || new THREE.Vector3();
    const color = group.userData.color ?? 0xffffff;
    const length = v.length();
    if (length < 0.01) { group.visible = false; return; } else { group.visible = true; }
    const dir = v.clone().normalize();
    const perp = new THREE.Vector3(-dir.y, dir.x, 0);
    const wupp = getWorldUnitsPerPixel();
    const shaftPixels = 3; 
    const headPixels = 7; 
    const halfShaft = (shaftPixels * wupp) / 2;
    const headLength = Math.min(0.35, Math.max(length * 0.18, 0.015));
    const headWidth = Math.max(halfShaft * 4, headPixels * wupp);

    
    let shaft = group.children[0];
    let head = group.children[1];
    let label = group.children[2];
    if (!shaft || !(shaft instanceof THREE.Mesh)) {
        shaft = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.98 }));
        group.add(shaft);
    }
    if (!head || !(head instanceof THREE.Mesh)) {
        head = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1.0 }));
        group.add(head);
    }
    
    shaft.material.depthTest = false; shaft.material.depthWrite = false; shaft.renderOrder = 9990;
    head.material.depthTest = false; head.material.depthWrite = false; head.renderOrder = 9991;

    
    const baseColorHex = (new THREE.Color(color)).getHex();
    const labelText = (group.userData.labelText || '').trim();
    const wantLabel = labelText.length > 0;
    if (!wantLabel) {
        
        if (label) {
            if (label.material) { if (label.material.map) label.material.map.dispose(); label.material.dispose(); }
            group.remove(label);
        }
        label = null;
    } else {
        const needNewLabel = !label || !(label instanceof THREE.Sprite) || label.userData.labelStyleVersion !== VECTOR_LABEL_STYLE_VERSION || label.userData.baseColorHex !== baseColorHex;
        if (needNewLabel) {
            if (label && label.material) {
                if (label.material.map) label.material.map.dispose();
                label.material.dispose();
            }
            const lp = group.userData.labelPixelSize || VECTOR_LABEL_PIXEL_SIZE;
            label = createVectorLabel2D(labelText, color, lp);
            if (group.children[2]) group.children[2] = label; else group.add(label);
        }
    }

    
    const end = v.clone().sub(dir.clone().multiplyScalar(headLength));
    const v0 = perp.clone().multiplyScalar(halfShaft); 
    const v1 = perp.clone().multiplyScalar(-halfShaft); 
    const v2 = end.clone().add(perp.clone().multiplyScalar(halfShaft));
    const v3 = end.clone().sub(perp.clone().multiplyScalar(halfShaft));
    const shaftPos = new Float32Array([
        v0.x, v0.y, 0,  v1.x, v1.y, 0,  v2.x, v2.y, 0,
        v2.x, v2.y, 0,  v1.x, v1.y, 0,  v3.x, v3.y, 0
    ]);
    const base = new THREE.Color(color);
    const cDark = new THREE.Color(adjustColorBrightness(color, 0.85));
    const cLight = new THREE.Color(adjustColorBrightness(color, 1.08));
    const shaftCol = new Float32Array([
        cDark.r, cDark.g, cDark.b,
        cDark.r, cDark.g, cDark.b,
        cLight.r, cLight.g, cLight.b,
        cLight.r, cLight.g, cLight.b,
        cDark.r, cDark.g, cDark.b,
        cDark.r, cDark.g, cDark.b,
    ]);
    const sg = shaft.geometry;
    sg.setAttribute('position', new THREE.BufferAttribute(shaftPos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(shaftCol, 3));
    sg.attributes.position.needsUpdate = true;
    sg.attributes.color.needsUpdate = true;
    sg.computeBoundingSphere();

    
    const basePoint = v.clone().sub(dir.clone().multiplyScalar(headLength));
    const left = basePoint.clone().add(perp.clone().multiplyScalar(headWidth / 2));
    const right = basePoint.clone().sub(perp.clone().multiplyScalar(headWidth / 2));
    const headPos = new Float32Array([
        v.x, v.y, 0,
        left.x, left.y, 0,
        right.x, right.y, 0
    ]);
    head.geometry.setAttribute('position', new THREE.BufferAttribute(headPos, 3));
    head.geometry.attributes.position.needsUpdate = true;
    head.geometry.computeBoundingSphere();
    head.material.color.set(color);

    
    const alongPx = 18; 
    const sidePx = 12;  
    const alongWU = alongPx * wupp;
    const sideWU = sidePx * wupp;
    if (label) {
        label.position.copy(
            v.clone()
             .add(dir.clone().multiplyScalar(alongWU))
             .add(perp.clone().multiplyScalar(sideWU))
        );
        
        const sprite = label;
        const tex = sprite.material.map;
        const cssW = tex.image ? tex.image.width / (Math.min(window.devicePixelRatio || 1, 2)) : 64;
        const cssH = tex.image ? tex.image.height / (Math.min(window.devicePixelRatio || 1, 2)) : 24;
        sprite.scale.set(cssW * wupp, cssH * wupp, 1);
    }
}


function resetZoom2D() {
    if (!camera2D || !controls2D) return;
    camera2D.zoom = 1;
    camera2D.position.set(0, 0, 10);
    controls2D.target.set(0, 0, 0);
    camera2D.updateProjectionMatrix();
    controls2D.update();
    refreshAll2DVectorArrows?.();
    if (USE_CANVAS_OVERLAY_2D) draw2DOverlay();
}

function resetZoom3D() {
    if (controls && typeof controls.reset === 'function') {
        controls.reset();
    }
}


function ensureResetZoomUI() {
    const header = document.querySelector('.header-controls');
    if (!header || document.getElementById('reset-zoom')) return;
    const btn = document.createElement('button');
    btn.id = 'reset-zoom';
    btn.className = 'btn-icon';
    btn.title = 'Reset Zoom (Ctrl+0)';
    btn.textContent = '⟲';
    btn.style.marginLeft = '8px';
    btn.addEventListener('click', () => {
        if (is2DMode) resetZoom2D(); else resetZoom3D();
    });
    header.appendChild(btn);
}


window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        if (is2DMode) resetZoom2D(); else resetZoom3D();
    }
});

function refresh2DVectorArrow(group) {
    if (!group || !group.userData) return;
    update2DVectorGeometry(group);
}

function refreshAll2DVectorArrows() {
    for (const key in sceneMeshes2D) {
        const g = sceneMeshes2D[key];
        refresh2DVectorArrow(g);
    }
}

function create2DVectorArrow(vector, color, labelText = '', labelPixelSize) {
    const group = new THREE.Group();
    
    group.position.set(0, 0, 0);
    group.userData.vector = vector.clone();
    group.userData.color = color;
    group.userData.labelText = labelText;
    group.userData.labelPixelSize = labelPixelSize || VECTOR_LABEL_PIXEL_SIZE;
    group.renderOrder = 9990;
    update2DVectorGeometry(group);
    return group;
}

function clear2DTemporaryVisuals() {
    function disposeDeep(obj) {
        obj.traverse((node) => {
            if (node.geometry) {
                node.geometry.dispose();
            }
            if (node.material) {
                if (Array.isArray(node.material)) {
                    node.material.forEach(m => {
                        if (m.map) m.map.dispose();
                        m.dispose();
                    });
                } else {
                    if (node.material.map) node.material.map.dispose();
                    node.material.dispose();
                }
            }
        });
    }
    while (temporaryVisuals2D.children.length > 0) {
        const child = temporaryVisuals2D.children[0];
        disposeDeep(child);
        temporaryVisuals2D.remove(child);
    }
}


function maybeClear2DTemporaryVisuals() {
    if (!multiOverlayEnabled) clear2DTemporaryVisuals();
}


function vectorFromArray2D(arr) {
    if (!Array.isArray(arr)) return new THREE.Vector3();
    const x = Number(arr[0] || 0);
    const y = Number(arr[1] || 0);
    return new THREE.Vector3(x, y, 0);
}

function ensureBasisVectors2D() {
    if (!basisVectors2D) return;
    if (basisVectors2D.userData.initialized) return;
    basisVectors2D.clear();
    const e1 = new THREE.Vector3(1, 0, 0);
    const e2 = new THREE.Vector3(0, 1, 0);
    const a1 = create2DVectorArrow(e1, AXIS_COLOR_X.getHex(), 'e1');
    const a2 = create2DVectorArrow(e2, AXIS_COLOR_Y.getHex(), 'e2');
    basisVectors2D.add(a1);
    basisVectors2D.add(a2);
    basisVectors2D.userData.initialized = true;
}

function toggleBasisVectors2D(show) {
    ensureBasisVectors2D();
    basisVectors2D.visible = !!show;
    refreshAll2DVectorArrows?.();
}

function visualizeProjection2D(from, onto, result) {
    
    const fromVec = vectorFromArray2D(from);
    const projVec = vectorFromArray2D(result);
    const color = 0xff00ff; 
    const projGroup = new THREE.Group();
    projGroup.userData = {
        type: 'projection_2d',
        from: Array.isArray(from) ? from.slice(0,2) : undefined,
        onto: Array.isArray(onto) ? onto.slice(0,2) : undefined,
        result: Array.isArray(result) ? result.slice(0,2) : undefined
    };
    const projArrow = create2DVectorArrow(projVec, color, 'proj', 22);
    projArrow.userData = Object.assign({}, projArrow.userData, { role: 'projection_result_arrow' });
    projGroup.add(projArrow);

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([fromVec, projVec]);
    const lineMaterial = new THREE.LineDashedMaterial({ color, dashSize: 0.2, gapSize: 0.15, transparent: true, opacity: 0.65 });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.computeLineDistances();
    line.renderOrder = 100; 
    line.material.depthTest = false;
    line.material.depthWrite = false;
    line.userData = Object.assign({}, line.userData, { role: 'projection_connector' });
    projGroup.add(line);

    temporaryVisuals2D.add(projGroup);
    refreshAll2DVectorArrows?.();
}

function visualizeSpan2D(vectors) {
    const spanGroup = new THREE.Group();
    const vectorsRaw = Array.isArray(vectors) ? vectors.map(v => Array.isArray(v) ? v.slice(0,2) : v) : [];
    spanGroup.userData = { type: 'span_2d', vectors: vectorsRaw };
    const vecs = (vectors || []).map(v => vectorFromArray2D(v)).filter(v => v.length() > 1e-6);
    if (vecs.length === 0) { temporaryVisuals2D.add(spanGroup); return spanGroup; }

    
    const zoom = camera2D?.zoom || 1;
    const worldH = camera2D ? (camera2D.top - camera2D.bottom) / zoom : 20;
    const worldW = camera2D ? (camera2D.right - camera2D.left) / zoom : 20;
    const L = Math.sqrt(worldW * worldW + worldH * worldH) * 0.75;

    const blue = 0x339af0;

    function addInfiniteLine(dir, color = blue) {
        const d = dir.clone().normalize();
        const p1 = d.clone().multiplyScalar(-L);
        const p2 = d.clone().multiplyScalar(L);
        const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 });
        const line = new THREE.Line(geom, mat);
        spanGroup.add(line);
    }

    if (vecs.length === 1) {
        
        addInfiniteLine(vecs[0], blue);
        
        const a = create2DVectorArrow(vecs[0], blue, 'Span');
        a.userData = Object.assign({}, a.userData, { role: 'span_generator' });
        spanGroup.add(a);
        
        const label = createVectorLabel2D('Span: Line', blue, 20);
        label.position.set(0, Math.max(worldH, worldW) * 0.25, 0);
        spanGroup.add(label);
    } else {
        
        let independent = false;
        for (let i = 0; i < vecs.length && !independent; i++) {
            for (let j = i + 1; j < vecs.length && !independent; j++) {
                const v1 = vecs[i], v2 = vecs[j];
                const det = v1.x * v2.y - v1.y * v2.x;
                independent = Math.abs(det) > 1e-6;
                if (independent) {
                    
                    const a1 = create2DVectorArrow(v1, blue, 'v1'); a1.userData = Object.assign({}, a1.userData, { role: 'span_generator' });
                    const a2 = create2DVectorArrow(v2, blue, 'v2'); a2.userData = Object.assign({}, a2.userData, { role: 'span_generator' });
                    spanGroup.add(a1);
                    spanGroup.add(a2);
                }
            }
        }
        if (independent) {
            const label = createVectorLabel2D('Span: R²', blue, 22);
            label.position.set(0, Math.max(worldH, worldW) * 0.25, 0);
            spanGroup.add(label);
        } else {
            
            addInfiniteLine(vecs[0], blue);
            const a = create2DVectorArrow(vecs[0], blue, 'Span');
            a.userData = Object.assign({}, a.userData, { role: 'span_generator' });
            spanGroup.add(a);
            const label = createVectorLabel2D('Span: Line', blue, 20);
            label.position.set(0, Math.max(worldH, worldW) * 0.25, 0);
            spanGroup.add(label);
        }
    }

    temporaryVisuals2D.add(spanGroup);
    refreshAll2DVectorArrows?.();
    return spanGroup;
}

function animate() {
    requestAnimationFrame(animate);
    
    if (is2DMode) {
        controls2D.update();
        composer2D.render();
    } else {
        controls.update();
        composer.render();
        if (enh('axisTicks')) updateAxisTicks3D();
    }

}


function updateAxisTicks3D() {
    if (!axisTicks3D || !camera || !controls) return;
    
    while (axisTicks3D.children.length) {
        const c = axisTicks3D.children.pop();
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
    }
    const target = controls.target || new THREE.Vector3(0,0,0);
    const camDist = camera.position.distanceTo(target);
    
    const steps = [0.5, 1, 2, 5];
    let step = 1;
    if (camDist < 4) step = 0.5; else if (camDist < 8) step = 1; else if (camDist < 16) step = 2; else step = 5;
    const range = Math.min(10, Math.ceil(camDist * 1.2));
    const tickSize = Math.max(0.04, Math.min(0.12, camDist * 0.01));

    
    const makeTicks = (axis) => {
        for (let v = -range; v <= range; v += step) {
            if (Math.abs(v) < 1e-9) continue;
            const geo = new THREE.BufferGeometry();
            let a = new THREE.Vector3(), b = new THREE.Vector3();
            if (axis === 'x') { a.set(v, 0, -tickSize); b.set(v, 0, tickSize); }
            if (axis === 'y') { a.set(-tickSize, v, 0); b.set(tickSize, v, 0); }
            if (axis === 'z') { a.set(-tickSize, 0, v); b.set(tickSize, 0, v); }
            geo.setFromPoints([a,b]);
            const mat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.6 });
            axisTicks3D.add(new THREE.Line(geo, mat));

            
            if (Math.round((v/step)) % 2 === 0) {
                let pos = new THREE.Vector3();
                if (axis === 'x') pos.set(v, 0, tickSize*3);
                if (axis === 'y') pos.set(tickSize*3, v, 0);
                if (axis === 'z') pos.set(-tickSize*3, 0, v);
                const lbl = addTextLabel(String(v), pos, '#94a3b8', 16);
                axisTicks3D.add(lbl);
            }
        }
    };
    makeTicks('x'); makeTicks('y'); makeTicks('z');
}


function presetFilePath(name) {
    const map = {
        'basics': 'presets/basics.txt',
        'gram_schmidt_demo': 'presets/gram_schmidt_demo.txt',
        'qr_lu_bench': 'presets/qr_lu_bench.txt',
        'transformations': 'presets/transformations.txt',
        'eigen_quadrics': 'presets/eigen_quadrics.txt',
        
        'dot_product_demo': 'presets/dot_product_demo.txt',
        'cross_product_demo': 'presets/cross_product_demo.txt',
        'vector_norms': 'presets/vector_norms.txt',
        'inverse_2x2': 'presets/inverse_2x2.txt',
        'inverse_3x3': 'presets/inverse_3x3.txt',
        'determinant_3x3': 'presets/determinant_3x3.txt',
        'rank_demo': 'presets/rank_demo.txt',
        'rref_demo': 'presets/rref_demo.txt',
        'projection_onto_line': 'presets/projection_onto_line.txt',
        'projection_onto_plane': 'presets/projection_onto_plane.txt',
        'span_explorer': 'presets/span_explorer.txt',
        'least_squares_line_fit': 'presets/least_squares_line_fit.txt',
        'least_squares_overdetermined': 'presets/least_squares_overdetermined.txt',
        'orthogonal_complement_plane': 'presets/orthogonal_complement_plane.txt',
        'orthogonal_complement_line': 'presets/orthogonal_complement_line.txt',
        'svd_demo': 'presets/svd_demo.txt',
        'solve_linear_system': 'presets/solve_linear_system.txt',
        'qr_demo_4x4': 'presets/qr_demo_4x4.txt',
        'lu_demo': 'presets/lu_demo.txt',
        'eigen_symmetric_2x2': 'presets/eigen_symmetric_2x2.txt',
        'eigen_nonsymmetric_3x3': 'presets/eigen_nonsymmetric_3x3.txt',
        'gram_schmidt_vectors': 'presets/gram_schmidt_vectors.txt'
    };
    return map[name] || '';
}

async function runPreset(name) {
    const path = presetFilePath(name);
    if (!path) throw new Error(`Unknown preset '${name}'`);
    let text = '';
    try {
        
        if (location.protocol === 'file:') {
            throw new Error('Presets require running from a local server. Please serve the folder (e.g., with "npx serve" or a VS Code Live Server) and open via http://');
        }
        const res = await fetch(path, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load preset (${res.status})`);
        text = await res.text();
    } catch (e) {
        throw new Error(`Could not fetch preset: ${e.message || e}`);
    }
    const lines = text.split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length && !l.startsWith('#'));
    if (lines.length === 0) {
        displayCommandError(`The '${name}' preset has no commands yet.`);
        return;
    }
    for (const line of lines) {
        await parseCommand(line);
        await new Promise(r => setTimeout(r, 150));
    }
}

document.addEventListener('DOMContentLoaded', init);
